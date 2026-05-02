/**
 * Server-side STAR fetchers. These run only in SvelteKit endpoints.
 * The browser hits our /api/* routes; never these helpers directly.
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { Line, Stop, Vehicle } from './types';

const ODS_BASE = 'https://data.explore.star.fr/api/explore/v2.1/catalog/datasets';
const GTFS_RT_VEHICLE_POSITIONS =
	'https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position';

interface OdsRecord<T> {
	results: T[];
	total_count: number;
}

interface OdsLine {
	id?: string;
	nomcourt?: string;
	nomlong?: string;
	couleurligne?: string;
	couleurtexteligne?: string;
	estversionactive?: string;
	visibilite?: string;
	nomfamillecommerciale?: string;
	route_id?: string;
}

interface OdsStop {
	id?: string;
	code?: string;
	nom?: string;
	nomcommune?: string;
	coordonnees?: { lon: number; lat: number };
	estaccessiblepmr?: string;
	stop_id?: string;
}

function normalizeColor(raw: string | undefined): string {
	// MapLibre v4 paint accepts only legacy CSS colors (hex/rgb/hsl), not oklch.
	if (!raw) return '#736d6c';
	const v = raw.trim();
	if (v.startsWith('#')) return v;
	if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`;
	return v;
}

function isActive(r: OdsLine): boolean {
	if (r.estversionactive == null) return true;
	return /oui|true|1/i.test(r.estversionactive);
}

async function fetchAllRecords<T>(fetchImpl: typeof fetch, datasetId: string, pageSize = 100): Promise<T[]> {
	const out: T[] = [];
	let offset = 0;
	for (;;) {
		const url = `${ODS_BASE}/${datasetId}/records?limit=${pageSize}&offset=${offset}`;
		const res = await fetchImpl(url);
		if (!res.ok) break;
		const data = (await res.json()) as OdsRecord<T>;
		out.push(...data.results);
		if (data.results.length < pageSize) break;
		offset += pageSize;
		if (offset >= data.total_count) break;
		if (offset >= 2000) break;
	}
	return out;
}

export async function fetchLines(fetchImpl: typeof fetch): Promise<Line[]> {
	const [bus, metro] = await Promise.all([
		fetchAllRecords<OdsLine>(fetchImpl, 'tco-bus-topologie-lignes-td'),
		fetchAllRecords<OdsLine>(fetchImpl, 'tco-metro-topologie-lignes-td')
	]);

	const lines: Line[] = [];

	for (const r of metro) {
		if (!isActive(r)) continue;
		const code = (r.nomcourt ?? r.id ?? '').toString();
		if (!code) continue;
		lines.push({
			id: code,
			code,
			name: prettifyName(r.nomlong, `Métro ${code}`),
			mode: 'metro',
			color: normalizeColor(r.couleurligne),
			textColor: normalizeColor(r.couleurtexteligne) || '#fff',
			gtfsRouteId: r.route_id
		});
	}

	for (const r of bus) {
		if (!isActive(r)) continue;
		if (r.visibilite && !/grand\s*public/i.test(r.visibilite)) continue;
		const code = (r.nomcourt ?? r.id ?? '').toString();
		if (!code) continue;
		lines.push({
			id: code,
			code,
			name: prettifyName(r.nomlong, `Ligne ${code}`),
			mode: 'bus',
			color: normalizeColor(r.couleurligne),
			textColor: normalizeColor(r.couleurtexteligne) || '#fff',
			gtfsRouteId: r.route_id
		});
	}

	const seen = new Set<string>();
	return lines.filter((l) => {
		if (seen.has(l.code)) return false;
		seen.add(l.code);
		return true;
	});
}

export async function fetchStops(fetchImpl: typeof fetch, limit = 1000): Promise<Stop[]> {
	const records = await fetchAllRecords<OdsStop>(
		fetchImpl,
		'tco-bus-topologie-pointsarret-td',
		Math.min(100, limit)
	);
	return records
		.slice(0, limit)
		.map((r): Stop | null => {
			const point = r.coordonnees;
			if (!point) return null;
			const id = (r.id ?? r.code ?? r.stop_id ?? '').toString();
			if (!id) return null;
			return {
				id,
				code: r.code ?? id,
				name: r.nom ?? id,
				lng: point.lon,
				lat: point.lat,
				lineCodes: [],
				wheelchair: /true|oui|1/i.test(r.estaccessiblepmr ?? '')
			};
		})
		.filter((s): s is Stop => s !== null);
}

let linesCache: { lines: Line[]; routeIndex: Map<string, string>; expires: number } | null = null;
const LINES_TTL_MS = 6 * 60 * 60 * 1000;

export async function getLinesAndIndex(
	fetchImpl: typeof fetch
): Promise<{ lines: Line[]; routeIndex: Map<string, string> }> {
	const now = Date.now();
	if (linesCache && linesCache.expires > now) {
		return { lines: linesCache.lines, routeIndex: linesCache.routeIndex };
	}
	const lines = await fetchLines(fetchImpl);
	const routeIndex = new Map<string, string>();
	for (const l of lines) {
		if (l.gtfsRouteId) routeIndex.set(l.gtfsRouteId, l.code);
	}
	linesCache = { lines, routeIndex, expires: now + LINES_TTL_MS };
	return { lines, routeIndex };
}

export async function fetchVehiclePositions(
	fetchImpl: typeof fetch
): Promise<{ vehicles: Vehicle[]; updatedAt: number }> {
	const [{ routeIndex }, res] = await Promise.all([
		getLinesAndIndex(fetchImpl).catch(() => ({ routeIndex: new Map<string, string>() })),
		fetchImpl(GTFS_RT_VEHICLE_POSITIONS, { headers: { Accept: 'application/x-protobuf' } })
	]);
	if (!res.ok) {
		throw new Error(`GTFS-RT VehiclePositions ${res.status}`);
	}
	const buffer = await res.arrayBuffer();
	const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

	const updatedAt =
		feed.header?.timestamp != null ? Number(feed.header.timestamp) * 1000 : Date.now();

	const vehicles: Vehicle[] = [];
	for (const entity of feed.entity ?? []) {
		const v = entity.vehicle;
		if (!v?.position) continue;
		const lng = v.position.longitude;
		const lat = v.position.latitude;
		if (typeof lng !== 'number' || typeof lat !== 'number') continue;
		const routeId = v.trip?.routeId ?? undefined;
		const lineCode = routeId ? (routeIndex.get(routeId) ?? deriveLineCode(routeId)) : undefined;
		vehicles.push({
			id: v.vehicle?.id ?? entity.id,
			tripId: v.trip?.tripId ?? undefined,
			routeId,
			lineCode,
			bearing: typeof v.position.bearing === 'number' ? v.position.bearing : undefined,
			speed: typeof v.position.speed === 'number' ? v.position.speed : undefined,
			lng,
			lat,
			timestamp: v.timestamp != null ? Number(v.timestamp) * 1000 : updatedAt
		});
	}
	return { vehicles, updatedAt };
}

function deriveLineCode(routeId: string): string | undefined {
	const m = routeId.match(/(?:^|-)0*([A-Za-z]?\d{1,4}[A-Za-z]?)$/);
	return m ? m[1] : undefined;
}

/**
 * STAR's `nomlong` lists every terminus of every direction joined by " <> ".
 * For UI, that reads as raw data. We prettify with a real arrow and trim
 * city-name redundancy so the row is scannable at a glance.
 */
function prettifyName(raw: string | undefined, fallback: string): string {
	if (!raw) return fallback;
	return raw.replace(/\s*<>\s*/g, ' ↔ ').trim();
}
