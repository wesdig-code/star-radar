// Pre-build script: downloads STAR's GTFS static zip, parses trips.txt and
// stop_times.txt, dedups course patterns, and writes static/trip-stops.json.
// Mirrors the strategy used by build-stops.mjs: bake at build, no runtime
// sub-requests.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'static', 'trip-stops.json');

// STAR's static GTFS feed. transport.data.gouv.fr's `proxy.../resource/...`
// pattern only covers the realtime feeds (used in src/lib/star/api.ts); the
// static zip is published via data.gouv.fr's stable resource UUID URL, which
// 302-redirects to STAR's opendatasoft FTP today
// (https://eu.ftp.opendatasoft.com/star/gtfs/GTFS_STAR_BUS_METRO_EN_COURS.zip).
// Dataset page:
//   https://transport.data.gouv.fr/datasets/versions-des-horaires-theoriques-des-lignes-de-bus-et-de-metro-du-reseau-star-au-format-gtfs
// If this URL ever 404s, find the current "GTFS (Version en cours)" resource
// UUID from that page and update the constant.
const GTFS_ZIP_URL =
	'https://www.data.gouv.fr/api/1/datasets/r/0644f537-575e-4cce-9570-06165d6f3b27';

async function downloadZip(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`GTFS download ${url} ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

function readZipEntry(zip, name) {
	const entry = zip.getEntry(name);
	if (!entry) throw new Error(`Missing ${name} in GTFS zip`);
	return entry.getData().toString('utf8');
}

function parseCsv(csv) {
	return parse(csv, { columns: true, skip_empty_lines: true, trim: true });
}

function indexStopsByTrip(stopTimes) {
	const byTrip = new Map();
	for (const row of stopTimes) {
		const arr = byTrip.get(row.trip_id) ?? [];
		arr.push({ seq: Number(row.stop_sequence), stop_id: row.stop_id });
		byTrip.set(row.trip_id, arr);
	}
	for (const arr of byTrip.values()) arr.sort((a, b) => a.seq - b.seq);
	return byTrip;
}

function buildIndex(trips, stopsByTrip) {
	const patternKey = new Map();
	const patterns = [];
	const tripsMap = {};

	for (const t of trips) {
		const ordered = stopsByTrip.get(t.trip_id);
		if (!ordered || ordered.length === 0) continue;
		const stops = ordered.map((s) => s.stop_id);
		const headsign = (t.trip_headsign ?? '').trim();
		const direction = Number(t.direction_id ?? 0);
		const key = `${direction}|${headsign}|${stops.join(',')}`;
		let idx = patternKey.get(key);
		if (idx === undefined) {
			idx = patterns.length;
			patterns.push({ stops, headsign, direction });
			patternKey.set(key, idx);
		}
		tripsMap[t.trip_id] = idx;
	}

	return { patterns, trips: tripsMap };
}

const start = Date.now();
console.log(`Downloading ${GTFS_ZIP_URL} …`);
const buf = await downloadZip(GTFS_ZIP_URL);
const zip = new AdmZip(buf);
const trips = parseCsv(readZipEntry(zip, 'trips.txt'));
const stopTimes = parseCsv(readZipEntry(zip, 'stop_times.txt'));
console.log(`Parsed ${trips.length} trips, ${stopTimes.length} stop_times rows`);

const stopsByTrip = indexStopsByTrip(stopTimes);
const index = buildIndex(trips, stopsByTrip);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(index));

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(
	`✓ wrote ${index.patterns.length} patterns / ${Object.keys(index.trips).length} trips ` +
		`to static/trip-stops.json in ${elapsed}s`
);
