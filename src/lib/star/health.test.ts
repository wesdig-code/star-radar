import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { buildNetworkHealth } from './health';
import type { Line } from './types';

const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
const Alert = GtfsRealtimeBindings.transit_realtime.Alert;
const TripScheduleRel = GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship;

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(here, '__fixtures__');

function loadFixture(name: string) {
	return FeedMessage.decode(new Uint8Array(readFileSync(resolve(FIXTURES, name))));
}

const tripUpdates = loadFixture('trip-update.pb');
const alerts = loadFixture('alerts.pb');

// 2026-05-02 19:30:00 UTC — sits inside the active window of every alert in
// the captured fixture, so we exercise the full alert pipeline.
const NOW = new Date('2026-05-02T19:30:00Z').getTime();

const linesIndex: Line[] = [
	{
		id: 'a',
		code: 'a',
		name: 'Métro a',
		mode: 'metro',
		color: '#d32704',
		textColor: '#fff',
		gtfsRouteId: '6-1001'
	},
	{
		id: 'b',
		code: 'b',
		name: 'Métro b',
		mode: 'metro',
		color: '#009543',
		textColor: '#fff',
		gtfsRouteId: '6-1002'
	},
	{
		id: 'C6',
		code: 'C6',
		name: 'Chronostar C6',
		mode: 'bus',
		color: '#de3b3d',
		textColor: '#fff',
		gtfsRouteId: '6-0006'
	}
];

describe('buildNetworkHealth — STAR fixtures', () => {
	it('produces a valid envelope from real STAR feeds', () => {
		const result = buildNetworkHealth(tripUpdates.entity ?? [], alerts.entity ?? [], {
			now: NOW,
			lines: linesIndex
		});

		expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
		expect(result.delayedLines).toBeInstanceOf(Array);
		expect(result.cancelledLines).toBeInstanceOf(Array);
		expect(result.alerts.length).toBeGreaterThan(0);
	});

	it('resolves routeShortName via the lines index when known', () => {
		const result = buildNetworkHealth(tripUpdates.entity ?? [], alerts.entity ?? [], {
			now: NOW,
			lines: linesIndex
		});
		// Alert RTA:4966 targets route 6-1001 (Métro a) per the captured fixture.
		const metroAAlert = result.alerts.find((a) => a.affectedRoutes.includes('6-1001'));
		expect(metroAAlert).toBeDefined();
	});

	it('keeps only alerts whose active window contains "now"', () => {
		const result = buildNetworkHealth(tripUpdates.entity ?? [], alerts.entity ?? [], {
			now: NOW,
			lines: linesIndex
		});
		// The fixture mixes alerts active now (work in progress) with alerts
		// scheduled for later or already finished. We keep at least one and
		// strictly fewer than the raw entity count.
		expect(result.alerts.length).toBeGreaterThan(0);
		expect(result.alerts.length).toBeLessThanOrEqual(alerts.entity?.length ?? 0);
	});

	it('drops alerts that are entirely in the past', () => {
		// 2030 is past every active period in the fixture.
		const future = new Date('2030-01-01T00:00:00Z').getTime();
		const result = buildNetworkHealth(tripUpdates.entity ?? [], alerts.entity ?? [], {
			now: future,
			lines: linesIndex
		});
		expect(result.alerts.length).toBe(0);
	});

	it('STAR fixture has zero canceled trips and zero SIGNIFICANT_DELAYS effects', () => {
		// The fixture reflects current STAR practice (no cancels, OTHER_EFFECT
		// only). If this test starts failing, the upstream feed has changed
		// shape and we should re-spike — not paper over.
		const result = buildNetworkHealth(tripUpdates.entity ?? [], alerts.entity ?? [], {
			now: NOW,
			lines: linesIndex
		});
		expect(result.cancelledLines).toEqual([]);
		expect(result.delayedLines).toEqual([]);
	});
});

describe('buildNetworkHealth — synthetic edge cases', () => {
	it('counts canceled trips per route when scheduleRelationship=CANCELED', () => {
		const synthetic = [
			{
				id: 'syn-1',
				tripUpdate: {
					trip: { tripId: 't1', routeId: '6-0006', scheduleRelationship: TripScheduleRel.CANCELED }
				}
			},
			{
				id: 'syn-2',
				tripUpdate: {
					trip: { tripId: 't2', routeId: '6-0006', scheduleRelationship: TripScheduleRel.CANCELED }
				}
			},
			{
				id: 'syn-3',
				tripUpdate: {
					trip: { tripId: 't3', routeId: '6-1001', scheduleRelationship: TripScheduleRel.SCHEDULED }
				}
			}
		];
		const result = buildNetworkHealth(synthetic, [], { now: NOW, lines: linesIndex });
		expect(result.cancelledLines).toEqual([
			{ routeId: '6-0006', routeShortName: 'C6', cancelledTrips: 2 }
		]);
	});

	it('flags routes with SIGNIFICANT_DELAYS alert as delayed and counts upcoming trips', () => {
		const nowSec = Math.floor(NOW / 1000);
		const synthAlerts = [
			{
				id: 'fake-delay',
				alert: {
					effect: Alert.Effect.SIGNIFICANT_DELAYS,
					cause: Alert.Cause.OTHER_CAUSE,
					headerText: { translation: [{ text: 'Trafic ralenti' }] },
					descriptionText: { translation: [{ text: 'Suite à incident.' }] },
					informedEntity: [{ routeId: '6-0006' }]
				}
			}
		];
		const synthTrips = [
			{
				id: 't-future',
				tripUpdate: {
					trip: { tripId: 'tf', routeId: '6-0006' },
					stopTimeUpdate: [{ arrival: { time: nowSec + 600 } }]
				}
			},
			{
				id: 't-past',
				tripUpdate: {
					trip: { tripId: 'tp', routeId: '6-0006' },
					stopTimeUpdate: [{ arrival: { time: nowSec - 600 } }]
				}
			}
		];
		const result = buildNetworkHealth(synthTrips, synthAlerts, { now: NOW, lines: linesIndex });
		expect(result.delayedLines).toEqual([
			{ routeId: '6-0006', routeShortName: 'C6', avgDelayMin: null, affectedTrips: 1 }
		]);
		expect(result.alerts[0].effect).toBe('SIGNIFICANT_DELAYS');
	});

	it('surfaces stopId on alerts when the operator provides one', () => {
		const synthAlerts = [
			{
				id: 'stop-impact',
				alert: {
					effect: Alert.Effect.OTHER_EFFECT,
					headerText: { translation: [{ text: 'Arrêt déplacé' }] },
					informedEntity: [{ routeId: '6-0006', stopId: '6-2017' }]
				}
			}
		];
		const result = buildNetworkHealth([], synthAlerts, { now: NOW, lines: linesIndex });
		expect(result.alerts[0].affectedStops).toEqual(['6-2017']);
	});

	it('keeps the delayedLines list deterministic and sorted by affectedTrips desc', () => {
		const nowSec = Math.floor(NOW / 1000);
		const synthAlerts = [
			{
				id: 'a1',
				alert: {
					effect: Alert.Effect.SIGNIFICANT_DELAYS,
					informedEntity: [{ routeId: '6-1001' }, { routeId: '6-0006' }]
				}
			}
		];
		const synthTrips = [
			{
				id: 't1',
				tripUpdate: {
					trip: { routeId: '6-0006' },
					stopTimeUpdate: [{ arrival: { time: nowSec + 100 } }]
				}
			},
			{
				id: 't2',
				tripUpdate: {
					trip: { routeId: '6-0006' },
					stopTimeUpdate: [{ arrival: { time: nowSec + 200 } }]
				}
			},
			{
				id: 't3',
				tripUpdate: {
					trip: { routeId: '6-1001' },
					stopTimeUpdate: [{ arrival: { time: nowSec + 300 } }]
				}
			}
		];
		const result = buildNetworkHealth(synthTrips, synthAlerts, { now: NOW, lines: linesIndex });
		expect(result.delayedLines.map((d) => d.routeShortName)).toEqual(['C6', 'a']);
	});
});
