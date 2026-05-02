/**
 * Pure aggregation: takes decoded GTFS-RT TripUpdates + Alerts entity arrays
 * and builds the NetworkHealth payload served by /api/network/health.
 *
 * No I/O. No SvelteKit. Easy to test against fixture protobufs (cf.
 * `src/lib/star/health.test.ts`).
 *
 * Plan B for delays (cf. docs/gtfs-rt.md): STAR ships absolute predicted
 * `time`, never `delay`. Without GTFS-static schedules we can't compute a
 * trustworthy `avgDelayMin`, so the v1 emits `null` for that field — the
 * line still surfaces in `delayedLines` only when an alert with effect
 * `SIGNIFICANT_DELAYS` is active on that route. Pure schedule-skip / cancel
 * lives elsewhere (`cancelledLines`).
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { NetworkHealth, NetworkAlert, DelayedLine, CancelledLine, Line } from './types';

type FeedEntity = GtfsRealtimeBindings.transit_realtime.IFeedEntity;

const Effect = GtfsRealtimeBindings.transit_realtime.Alert.Effect;
const Cause = GtfsRealtimeBindings.transit_realtime.Alert.Cause;
const TripScheduleRel = GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship;

export const SIGNIFICANT_ALERT_EFFECTS = new Set([
	'NO_SERVICE',
	'REDUCED_SERVICE',
	'SIGNIFICANT_DELAYS',
	'DETOUR'
]);

function effectName(n: number | null | undefined): NetworkAlert['effect'] {
	switch (n) {
		case Effect.NO_SERVICE:
			return 'NO_SERVICE';
		case Effect.REDUCED_SERVICE:
			return 'REDUCED_SERVICE';
		case Effect.SIGNIFICANT_DELAYS:
			return 'SIGNIFICANT_DELAYS';
		case Effect.DETOUR:
			return 'DETOUR';
		case Effect.ADDITIONAL_SERVICE:
			return 'ADDITIONAL_SERVICE';
		case Effect.MODIFIED_SERVICE:
			return 'MODIFIED_SERVICE';
		case Effect.OTHER_EFFECT:
			return 'OTHER_EFFECT';
		case Effect.STOP_MOVED:
			return 'STOP_MOVED';
		case Effect.ACCESSIBILITY_ISSUE:
			return 'ACCESSIBILITY_ISSUE';
		default:
			return 'UNKNOWN_EFFECT';
	}
}

function causeName(n: number | null | undefined): string | undefined {
	if (n == null) return undefined;
	for (const [k, v] of Object.entries(Cause)) {
		if (v === n && typeof v === 'number') return k;
	}
	return undefined;
}

function translation(
	t: { translation?: ({ text?: string | null } | null)[] | null } | null | undefined
): string | undefined {
	const text = t?.translation?.[0]?.text;
	return text ? text : undefined;
}

function toEpochSeconds(now: Date | number): number {
	return Math.floor((typeof now === 'number' ? now : now.getTime()) / 1000);
}

interface BuildOptions {
	now?: Date | number;
	lines?: Line[];
}

export function buildNetworkHealth(
	tripEntities: FeedEntity[],
	alertEntities: FeedEntity[],
	{ now = Date.now(), lines = [] }: BuildOptions = {}
): NetworkHealth {
	const nowSec = toEpochSeconds(now);
	const routeShortByRouteId = new Map<string, string>();
	for (const l of lines) {
		if (l.gtfsRouteId) routeShortByRouteId.set(l.gtfsRouteId, l.code);
	}

	const cancelledByRoute = new Map<string, number>();

	for (const e of tripEntities) {
		const tu = e.tripUpdate;
		if (!tu) continue;
		const routeId = tu.trip?.routeId ?? '';
		if (!routeId) continue;
		if (tu.trip?.scheduleRelationship === TripScheduleRel.CANCELED) {
			cancelledByRoute.set(routeId, (cancelledByRoute.get(routeId) ?? 0) + 1);
		}
	}

	const cancelledLines: CancelledLine[] = [];
	for (const [routeId, cancelledTrips] of cancelledByRoute) {
		cancelledLines.push({
			routeId,
			routeShortName: routeShortByRouteId.get(routeId) ?? routeId,
			cancelledTrips
		});
	}
	cancelledLines.sort(
		(a, b) =>
			b.cancelledTrips - a.cancelledTrips ||
			a.routeShortName.localeCompare(b.routeShortName, 'fr', { numeric: true })
	);

	const activeAlerts: NetworkAlert[] = [];
	const delayRoutesFromAlerts = new Set<string>();

	for (const e of alertEntities) {
		const a = e.alert;
		if (!a) continue;
		if (!isAlertActive(a, nowSec)) continue;

		const effect = effectName(a.effect);
		const informed = a.informedEntity ?? [];
		const affectedRoutes: string[] = [];
		const affectedStops: string[] = [];
		for (const ie of informed) {
			if (ie.routeId) affectedRoutes.push(ie.routeId);
			if (ie.stopId) affectedStops.push(ie.stopId);
		}

		if (effect === 'SIGNIFICANT_DELAYS') {
			for (const r of affectedRoutes) delayRoutesFromAlerts.add(r);
		}

		activeAlerts.push({
			id: e.id ?? '',
			header: translation(a.headerText) ?? '',
			description: translation(a.descriptionText),
			url: translation(a.url),
			effect,
			cause: causeName(a.cause),
			affectedRoutes: dedupe(affectedRoutes),
			affectedStops: dedupe(affectedStops),
			start: pickPeriod(a, nowSec, 'start'),
			end: pickPeriod(a, nowSec, 'end')
		});
	}

	activeAlerts.sort(alertSortKey);

	const delayActiveTrips = new Map<string, number>();
	for (const e of tripEntities) {
		const tu = e.tripUpdate;
		const routeId = tu?.trip?.routeId ?? '';
		if (!routeId || !delayRoutesFromAlerts.has(routeId)) continue;
		if (tu?.trip?.scheduleRelationship === TripScheduleRel.CANCELED) continue;
		const upcoming = (tu?.stopTimeUpdate ?? []).find((s) => {
			const t = Number(s.arrival?.time ?? s.departure?.time ?? 0);
			return t > nowSec;
		});
		if (upcoming) {
			delayActiveTrips.set(routeId, (delayActiveTrips.get(routeId) ?? 0) + 1);
		}
	}

	const delayedLines: DelayedLine[] = [];
	for (const routeId of delayRoutesFromAlerts) {
		delayedLines.push({
			routeId,
			routeShortName: routeShortByRouteId.get(routeId) ?? routeId,
			avgDelayMin: null,
			affectedTrips: delayActiveTrips.get(routeId) ?? 0
		});
	}
	delayedLines.sort(
		(a, b) =>
			b.affectedTrips - a.affectedTrips ||
			a.routeShortName.localeCompare(b.routeShortName, 'fr', { numeric: true })
	);

	return {
		updatedAt: new Date(nowSec * 1000).toISOString(),
		delayedLines,
		cancelledLines,
		alerts: activeAlerts
	};
}

interface ActivePeriod {
	start?: number | null | bigint | Long;
	end?: number | null | bigint | Long;
}

interface Long {
	toNumber(): number;
}

function periodsOf(a: { activePeriod?: ActivePeriod[] | null }): ActivePeriod[] {
	return a.activePeriod ?? [];
}

function asNumber(v: number | bigint | Long | null | undefined): number | undefined {
	if (v == null) return undefined;
	if (typeof v === 'number') return v;
	if (typeof v === 'bigint') return Number(v);
	return v.toNumber();
}

function isAlertActive(a: { activePeriod?: ActivePeriod[] | null }, nowSec: number): boolean {
	const periods = periodsOf(a);
	if (periods.length === 0) return true;
	for (const p of periods) {
		const start = asNumber(p.start) ?? -Infinity;
		const end = asNumber(p.end) ?? Infinity;
		if (nowSec >= start && nowSec <= end) return true;
	}
	return false;
}

function pickPeriod(
	a: { activePeriod?: ActivePeriod[] | null },
	nowSec: number,
	field: 'start' | 'end'
): number | undefined {
	const periods = periodsOf(a);
	for (const p of periods) {
		const start = asNumber(p.start) ?? -Infinity;
		const end = asNumber(p.end) ?? Infinity;
		if (nowSec >= start && nowSec <= end) return asNumber(p[field]);
	}
	return periods[0] ? asNumber(periods[0][field]) : undefined;
}

function dedupe(arr: string[]): string[] {
	return [...new Set(arr)];
}

const EFFECT_PRIORITY: Record<NetworkAlert['effect'], number> = {
	NO_SERVICE: 0,
	REDUCED_SERVICE: 1,
	DETOUR: 2,
	SIGNIFICANT_DELAYS: 3,
	MODIFIED_SERVICE: 4,
	STOP_MOVED: 5,
	ADDITIONAL_SERVICE: 6,
	ACCESSIBILITY_ISSUE: 7,
	OTHER_EFFECT: 8,
	UNKNOWN_EFFECT: 9
};

function alertSortKey(a: NetworkAlert, b: NetworkAlert): number {
	return EFFECT_PRIORITY[a.effect] - EFFECT_PRIORITY[b.effect];
}
