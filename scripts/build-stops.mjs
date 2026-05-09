// Pre-build script: fetches stops + dessertes from STAR's open-data API
// and writes static/stops.json. Run at build time so the deployed Worker
// never has to paginate ~109 sub-requests on the hot path (Cloudflare's
// free-tier subrequest cap is 50 per invocation).
//
// Mirror of `fetchStops` in src/lib/star/api.ts. Keep the two in sync.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'static', 'stops.json');
const ODS_BASE = 'https://data.explore.star.fr/api/explore/v2.1/catalog/datasets';

async function fetchAllRecords(datasetId, pageSize = 100, hardCap = 2000) {
	const out = [];
	let offset = 0;
	for (;;) {
		const url = `${ODS_BASE}/${datasetId}/records?limit=${pageSize}&offset=${offset}`;
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`ODS ${datasetId} ${res.status} at offset ${offset}`);
		}
		const data = await res.json();
		out.push(...data.results);
		if (data.results.length < pageSize) break;
		offset += pageSize;
		if (offset >= data.total_count) break;
		if (offset >= hardCap) break;
	}
	return out;
}

async function fetchStops(limit = 2000) {
	const [records, dessertes] = await Promise.all([
		fetchAllRecords('tco-bus-topologie-pointsarret-td', Math.min(100, limit), 2500),
		fetchAllRecords('tco-bus-topologie-dessertes-td', 100, 12_000)
	]);

	const linesByStop = new Map();
	for (const d of dessertes) {
		const stopId = (d.idarret ?? d.stop_id ?? '').toString();
		const lineCode = d.nomcourtligne ?? d.idligne;
		if (!stopId || !lineCode) continue;
		const set = linesByStop.get(stopId) ?? new Set();
		set.add(lineCode);
		linesByStop.set(stopId, set);
	}

	return records
		.slice(0, limit)
		.map((r) => {
			const point = r.coordonnees;
			if (!point) return null;
			const id = (r.id ?? r.code ?? r.stop_id ?? '').toString();
			if (!id) return null;
			const lines = linesByStop.get(id) ?? new Set();
			return {
				id,
				code: r.code ?? id,
				name: r.nom ?? id,
				lng: point.lon,
				lat: point.lat,
				lineCodes: [...lines].sort((a, b) =>
					a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
				),
				wheelchair: /true|oui|1/i.test(r.estaccessiblepmr ?? '')
			};
		})
		.filter((s) => s !== null);
}

const start = Date.now();
const stops = await fetchStops(2000);
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(stops));
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`✓ wrote ${stops.length} stops to static/stops.json in ${elapsed}s`);
