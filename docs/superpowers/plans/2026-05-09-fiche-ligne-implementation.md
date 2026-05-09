# Fiche ligne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show, in the existing `DrillLine` panel, every active bus on a line — grouped by direction, with the previous and next stop per bus — and dim the other lines on the map while the panel is open.

**Architecture:** Bake a deduped `trip_id → pattern` index at build time (`static/trip-stops.json`), enrich `Vehicle` with three GTFS-RT fields the server already has access to (`currentStopSequence`, `stopId`, `currentStatus`), and combine them in pure helpers consumed by `DrillLine.svelte`. No new runtime sub-requests; everything reads from already-loaded state.

**Tech Stack:** Node 22 + `pnpm`, SvelteKit 2 / Svelte 5 runes, TypeScript strict, Vitest, MapLibre GL v4, GTFS-Realtime via `gtfs-realtime-bindings`, Cloudflare Pages assets binding.

**Spec:** `docs/superpowers/specs/2026-05-09-fiche-ligne-design.md`. **Issue:** [#7](https://github.com/wesdig-code/star-radar/issues/7).

---

## File Map

**Created:**
- `scripts/build-trip-stops.mjs` — fetches STAR's GTFS static zip, dedups patterns, writes the index.
- `static/trip-stops.json` — generated artifact, committed.
- `src/lib/star/line-detail.ts` — pure helpers (`computeVehicleStops`, `groupByDirection`).
- `src/lib/star/line-detail.test.ts` — Vitest unit tests.
- `src/lib/stores/trip-stops.svelte.ts` — lazy client store.

**Modified:**
- `src/lib/star/types.ts` — add `currentStopSequence`, `stopId`, `currentStatus` to `Vehicle`; add `TripPattern`, `TripStopsIndex`.
- `src/lib/star/api.ts` — extend `fetchVehiclePositions` to extract the three new fields.
- `src/lib/stores/stops.svelte.ts` — add `byId` derived getter.
- `src/lib/ui/DrillLine.svelte` — render the body (sections by direction, rows, empty + fallback states, `animate:flip`).
- `src/lib/map/VehicleLayer.svelte` — bump selected-line bus radius `+1 px`.
- `package.json` — add `build:trip-stops` script, chain in `build`, add `adm-zip` and `csv-parse` devDeps.
- `.prettierignore` — exclude `static/trip-stops.json`.

---

## Task 1 — Enrich `Vehicle` and extract GTFS-RT stop fields

**Files:**
- Modify: `src/lib/star/types.ts`
- Modify: `src/lib/star/api.ts`
- Test: `src/lib/star/api.test.ts` (new — small unit test using a synthetic protobuf)

- [ ] **Step 1: Extend the `Vehicle` interface**

In `src/lib/star/types.ts`, replace the `Vehicle` interface (currently at lines 28–38) with:

```ts
export type VehicleStopStatus = 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO';

export interface Vehicle {
	id: string;
	tripId?: string;
	routeId?: string;
	lineCode?: string;
	bearing?: number;
	speed?: number;
	lng: number;
	lat: number;
	timestamp: number;
	currentStopSequence?: number;
	stopId?: string;
	currentStatus?: VehicleStopStatus;
}
```

- [ ] **Step 2: Map the protobuf enum to our string union**

In `src/lib/star/api.ts`, just above `fetchVehiclePositions` (around line 200), add:

```ts
const VehicleStopStatusEnum =
	GtfsRealtimeBindings.transit_realtime.VehiclePosition.VehicleStopStatus;

function vehicleStatus(raw: number | null | undefined): VehicleStopStatus | undefined {
	if (raw == null) return undefined;
	switch (raw) {
		case VehicleStopStatusEnum.INCOMING_AT:
			return 'INCOMING_AT';
		case VehicleStopStatusEnum.STOPPED_AT:
			return 'STOPPED_AT';
		case VehicleStopStatusEnum.IN_TRANSIT_TO:
			return 'IN_TRANSIT_TO';
		default:
			return undefined;
	}
}
```

Add the import for the type alias at the top of the same file (near the existing `import type { Line, Vehicle } from './types';`):

```ts
import type { Line, Vehicle, VehicleStopStatus } from './types';
```

- [ ] **Step 3: Push the three fields when assembling the `Vehicle` payload**

In `fetchVehiclePositions`, modify the loop body that builds each `Vehicle` (currently around lines 217–235) so the pushed object also carries the new fields:

```ts
vehicles.push({
	id: v.vehicle?.id ?? entity.id,
	tripId: v.trip?.tripId ?? undefined,
	routeId,
	lineCode,
	bearing: typeof v.position.bearing === 'number' ? v.position.bearing : undefined,
	speed: typeof v.position.speed === 'number' ? v.position.speed : undefined,
	lng,
	lat,
	timestamp: v.timestamp != null ? Number(v.timestamp) * 1000 : updatedAt,
	currentStopSequence:
		typeof v.currentStopSequence === 'number' ? v.currentStopSequence : undefined,
	stopId: v.stopId ?? undefined,
	currentStatus: vehicleStatus(v.currentStatus)
});
```

- [ ] **Step 4: Write a failing test**

Create `src/lib/star/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { fetchVehiclePositions } from './api';

const FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
const VehicleStopStatus = GtfsRealtimeBindings.transit_realtime.VehiclePosition.VehicleStopStatus;

function makeFetchReturning(buf: Uint8Array): typeof fetch {
	return (async (url: string) => {
		// Lines endpoint not needed for this test — return an empty ODS response.
		if (typeof url === 'string' && url.includes('explore/v2.1/catalog/datasets')) {
			return new Response(JSON.stringify({ results: [], total_count: 0 }), { status: 200 });
		}
		return new Response(buf, { status: 200 });
	}) as unknown as typeof fetch;
}

describe('fetchVehiclePositions — stop fields', () => {
	it('extracts currentStopSequence, stopId, currentStatus from VehiclePosition', async () => {
		const message = FeedMessage.create({
			header: { gtfsRealtimeVersion: '2.0', timestamp: 1_700_000_000 },
			entity: [
				{
					id: 'e1',
					vehicle: {
						vehicle: { id: 'bus-42' },
						trip: { tripId: 't-1', routeId: '6-0006' },
						position: { latitude: 48.1, longitude: -1.6 },
						timestamp: 1_700_000_000,
						currentStopSequence: 4,
						stopId: 'stop-7',
						currentStatus: VehicleStopStatus.STOPPED_AT
					}
				}
			]
		});
		const buf = FeedMessage.encode(message).finish();

		const { vehicles } = await fetchVehiclePositions(makeFetchReturning(buf));
		expect(vehicles).toHaveLength(1);
		expect(vehicles[0]).toMatchObject({
			id: 'bus-42',
			tripId: 't-1',
			currentStopSequence: 4,
			stopId: 'stop-7',
			currentStatus: 'STOPPED_AT'
		});
	});

	it('omits the three fields when the protobuf does not carry them', async () => {
		const message = FeedMessage.create({
			header: { gtfsRealtimeVersion: '2.0', timestamp: 1_700_000_000 },
			entity: [
				{
					id: 'e1',
					vehicle: {
						vehicle: { id: 'bus-only-position' },
						position: { latitude: 48.1, longitude: -1.6 }
					}
				}
			]
		});
		const buf = FeedMessage.encode(message).finish();

		const { vehicles } = await fetchVehiclePositions(makeFetchReturning(buf));
		expect(vehicles[0].currentStopSequence).toBeUndefined();
		expect(vehicles[0].stopId).toBeUndefined();
		expect(vehicles[0].currentStatus).toBeUndefined();
	});
});
```

- [ ] **Step 5: Run the test — it must pass**

```bash
pnpm test -- src/lib/star/api.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Run check and lint**

```bash
pnpm check && pnpm lint
```

Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/star/types.ts src/lib/star/api.ts src/lib/star/api.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: enrichit Vehicle avec currentStopSequence/stopId/currentStatus
EOF
)"
```

---

## Task 2 — Add CSV/zip dev-deps and write `build-trip-stops.mjs`

**Files:**
- Modify: `package.json`
- Create: `scripts/build-trip-stops.mjs`

- [ ] **Step 1: Install dev-deps**

```bash
pnpm add -D adm-zip csv-parse
```

- [ ] **Step 2: Write the build script**

Create `scripts/build-trip-stops.mjs`:

```js
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

// STAR's static GTFS feed is mirrored on transport.data.gouv.fr alongside the
// realtime feeds we already use in src/lib/star/api.ts. If this URL ever
// 404s, look up the current resource id on transport.data.gouv.fr and update.
const GTFS_ZIP_URL = 'https://proxy.transport.data.gouv.fr/resource/star-rennes-static-gtfs';

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
```

- [ ] **Step 3: Run it once**

```bash
node scripts/build-trip-stops.mjs
```

Expected: a final line `✓ wrote N patterns / M trips to static/trip-stops.json in X.Xs`. If the GTFS URL 404s, lookup the current STAR resource on `transport.data.gouv.fr` and update the constant.

- [ ] **Step 4: Verify the artifact size**

```bash
ls -lh static/trip-stops.json && gzip -c static/trip-stops.json | wc -c
```

Expected: raw under 5 MB, gzipped under 500 KB. If gzipped > 500 KB, file an issue and tighten the dedup before merging.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/build-trip-stops.mjs static/trip-stops.json
git commit -m "$(cat <<'EOF'
:sparkles: pré-bâtit static/trip-stops.json depuis le GTFS statique STAR
EOF
)"
```

---

## Task 3 — Wire `build:trip-stops` and ignore the JSON in Prettier

**Files:**
- Modify: `package.json`
- Modify: `.prettierignore`

- [ ] **Step 1: Extend the build chain**

In `package.json`, replace the current `"build"` and the `"build:stops"` lines with:

```json
		"build": "node scripts/build-stops.mjs && node scripts/build-trip-stops.mjs && vite build",
		"build:stops": "node scripts/build-stops.mjs",
		"build:trip-stops": "node scripts/build-trip-stops.mjs",
```

- [ ] **Step 2: Ignore the generated JSON for Prettier**

In `.prettierignore`, append a line just below `static/stops.json`:

```
static/trip-stops.json
```

- [ ] **Step 3: Re-run lint and check**

```bash
pnpm check && pnpm lint
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add package.json .prettierignore
git commit -m "$(cat <<'EOF'
:wrench: branche build:trip-stops dans pnpm build
EOF
)"
```

---

## Task 4 — Pure helpers `computeVehicleStops` and `groupByDirection`

**Files:**
- Modify: `src/lib/star/types.ts`
- Create: `src/lib/star/line-detail.ts`
- Create: `src/lib/star/line-detail.test.ts`

- [ ] **Step 1: Add the index types**

Append to `src/lib/star/types.ts` (after `Vehicle`):

```ts
export interface TripPattern {
	stops: string[];
	headsign: string;
	direction: number;
}

export interface TripStopsIndex {
	patterns: TripPattern[];
	trips: Record<string, number>;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/star/line-detail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeVehicleStops, groupByDirection } from './line-detail';
import type { Stop, TripStopsIndex, Vehicle } from './types';

const stopsById = new Map<string, Stop>(
	[
		{ id: 's1', code: 's1', name: 'Donzelot', lng: 0, lat: 0, lineCodes: [], wheelchair: false },
		{ id: 's2', code: 's2', name: 'Gallet', lng: 0, lat: 0, lineCodes: [], wheelchair: false },
		{ id: 's3', code: 's3', name: 'Métro Cesson', lng: 0, lat: 0, lineCodes: [], wheelchair: false }
	].map((s) => [s.id, s])
);

const index: TripStopsIndex = {
	patterns: [
		{ stops: ['s1', 's2', 's3'], headsign: 'Vers République', direction: 0 },
		{ stops: ['s3', 's2', 's1'], headsign: 'Vers Cesson', direction: 1 }
	],
	trips: { 'trip-A': 0, 'trip-B': 1 }
};

function v(over: Partial<Vehicle>): Vehicle {
	return { id: 'v', lng: 0, lat: 0, timestamp: 0, ...over };
}

describe('computeVehicleStops', () => {
	it('returns prev=null and next=stopId when bus is at the first stop, in transit', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's1', currentStatus: 'IN_TRANSIT_TO' }),
			index,
			stopsById
		);
		expect(r.status).toBe('departure');
		expect(r.prev).toBeNull();
		expect(r.next).toEqual({ id: 's1', name: 'Donzelot' });
	});

	it('returns prev = previous stop and next = stopId in transit mid-trip', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			index,
			stopsById
		);
		expect(r.status).toBe('transit');
		expect(r.prev).toEqual({ id: 's1', name: 'Donzelot' });
		expect(r.next).toEqual({ id: 's2', name: 'Gallet' });
	});

	it('returns stopped state when STOPPED_AT, with prev = previous and next = next-after', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'STOPPED_AT' }),
			index,
			stopsById
		);
		expect(r.status).toBe('stopped');
		expect(r.prev).toEqual({ id: 's1', name: 'Donzelot' });
		expect(r.next).toEqual({ id: 's3', name: 'Métro Cesson' });
	});

	it('returns terminus state when next stop is the last in the pattern, in transit', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's3', currentStatus: 'IN_TRANSIT_TO' }),
			index,
			stopsById
		);
		expect(r.status).toBe('arrived');
		expect(r.prev).toEqual({ id: 's2', name: 'Gallet' });
		expect(r.next).toEqual({ id: 's3', name: 'Métro Cesson' });
	});

	it('returns unknown when tripId is missing', () => {
		const r = computeVehicleStops(v({ stopId: 's2' }), index, stopsById);
		expect(r.status).toBe('unknown');
		expect(r.prev).toBeNull();
		expect(r.next).toBeNull();
	});

	it('returns unknown when tripId is not in the index', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-Z', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			index,
			stopsById
		);
		expect(r.status).toBe('unknown');
	});

	it('returns unknown when stopId is not present in the trip pattern', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 'unknown-stop', currentStatus: 'IN_TRANSIT_TO' }),
			index,
			stopsById
		);
		expect(r.status).toBe('unknown');
	});

	it('falls back to the stop id as name when the stop is not in stopsById', () => {
		const r = computeVehicleStops(
			v({ tripId: 'trip-A', stopId: 's2', currentStatus: 'IN_TRANSIT_TO' }),
			index,
			new Map()
		);
		expect(r.next).toEqual({ id: 's2', name: 's2' });
	});
});

describe('groupByDirection', () => {
	it('groups vehicles by (direction, headsign), preserves all matched, sorts by direction asc', () => {
		const vehicles = [
			v({ id: 'va', tripId: 'trip-A' }),
			v({ id: 'vb', tripId: 'trip-B' }),
			v({ id: 'va2', tripId: 'trip-A' })
		];
		const groups = groupByDirection(vehicles, index);
		expect(groups).toHaveLength(2);
		expect(groups[0]).toMatchObject({ headsign: 'Vers République', direction: 0 });
		expect(groups[0].vehicles.map((x) => x.id)).toEqual(['va', 'va2']);
		expect(groups[1]).toMatchObject({ headsign: 'Vers Cesson', direction: 1 });
	});

	it('returns vehicles with unknown trip in a separate "orphans" array', () => {
		const vehicles = [
			v({ id: 'va', tripId: 'trip-A' }),
			v({ id: 'vorphan' }),
			v({ id: 'vbad', tripId: 'trip-Z' })
		];
		const { orphans } = groupByDirection(vehicles, index, { withOrphans: true });
		expect(orphans?.map((x) => x.id).sort()).toEqual(['vbad', 'vorphan']);
	});
});
```

- [ ] **Step 3: Run the test — it must fail**

```bash
pnpm test -- src/lib/star/line-detail.test.ts
```

Expected: FAIL with "Cannot find module './line-detail'".

- [ ] **Step 4: Implement the helpers**

Create `src/lib/star/line-detail.ts`:

```ts
import type { Stop, TripStopsIndex, Vehicle } from './types';

type StopRef = { id: string; name: string };

export type VehicleStopStatus = 'transit' | 'stopped' | 'departure' | 'arrived' | 'unknown';

export interface VehicleStops {
	prev: StopRef | null;
	next: StopRef | null;
	status: VehicleStopStatus;
}

function refOf(stopId: string | null, stopsById: Map<string, Stop>): StopRef | null {
	if (!stopId) return null;
	const s = stopsById.get(stopId);
	return { id: stopId, name: s?.name ?? stopId };
}

export function computeVehicleStops(
	vehicle: Vehicle,
	index: TripStopsIndex,
	stopsById: Map<string, Stop>
): VehicleStops {
	const tripId = vehicle.tripId;
	if (!tripId) return { prev: null, next: null, status: 'unknown' };
	const patternIdx = index.trips[tripId];
	if (patternIdx === undefined) return { prev: null, next: null, status: 'unknown' };
	const pattern = index.patterns[patternIdx];
	if (!pattern || !vehicle.stopId) return { prev: null, next: null, status: 'unknown' };

	const idx = pattern.stops.indexOf(vehicle.stopId);
	if (idx < 0) return { prev: null, next: null, status: 'unknown' };

	if (vehicle.currentStatus === 'STOPPED_AT') {
		const prev = idx > 0 ? pattern.stops[idx - 1] : null;
		const next = idx < pattern.stops.length - 1 ? pattern.stops[idx + 1] : null;
		return {
			prev: refOf(prev, stopsById),
			next: refOf(next, stopsById),
			status: 'stopped'
		};
	}

	// IN_TRANSIT_TO / INCOMING_AT / unspecified — stopId is the upcoming stop.
	const isStart = idx === 0;
	const isEnd = idx === pattern.stops.length - 1;
	const prev = isStart ? null : pattern.stops[idx - 1];
	return {
		prev: refOf(prev, stopsById),
		next: refOf(pattern.stops[idx], stopsById),
		status: isStart ? 'departure' : isEnd ? 'arrived' : 'transit'
	};
}

export interface DirectionGroup {
	headsign: string;
	direction: number;
	vehicles: Vehicle[];
}

export function groupByDirection(
	vehicles: Vehicle[],
	index: TripStopsIndex
): DirectionGroup[];
export function groupByDirection(
	vehicles: Vehicle[],
	index: TripStopsIndex,
	options: { withOrphans: true }
): { groups: DirectionGroup[]; orphans: Vehicle[] };
export function groupByDirection(
	vehicles: Vehicle[],
	index: TripStopsIndex,
	options?: { withOrphans?: boolean }
): DirectionGroup[] | { groups: DirectionGroup[]; orphans: Vehicle[] } {
	const map = new Map<string, DirectionGroup>();
	const orphans: Vehicle[] = [];
	for (const v of vehicles) {
		const tripId = v.tripId;
		const patternIdx = tripId != null ? index.trips[tripId] : undefined;
		if (patternIdx === undefined) {
			orphans.push(v);
			continue;
		}
		const pattern = index.patterns[patternIdx];
		const key = `${pattern.direction}|${pattern.headsign}`;
		const g = map.get(key) ?? {
			headsign: pattern.headsign,
			direction: pattern.direction,
			vehicles: []
		};
		g.vehicles.push(v);
		map.set(key, g);
	}
	const groups = [...map.values()].sort((a, b) => a.direction - b.direction);
	if (options?.withOrphans) return { groups, orphans };
	return groups;
}
```

- [ ] **Step 5: Run the tests — they must pass**

```bash
pnpm test -- src/lib/star/line-detail.test.ts
```

Expected: 9 passed.

- [ ] **Step 6: Run check and lint**

```bash
pnpm check && pnpm lint
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/star/types.ts src/lib/star/line-detail.ts src/lib/star/line-detail.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: ajoute les helpers prev/next + groupBy direction
EOF
)"
```

---

## Task 5 — Stop lookup map and `tripStopsStore`

**Files:**
- Modify: `src/lib/stores/stops.svelte.ts`
- Create: `src/lib/stores/trip-stops.svelte.ts`

- [ ] **Step 1: Add a `byId` derived getter on the stops store**

Replace the contents of `src/lib/stores/stops.svelte.ts` with:

```ts
import type { Stop } from '$lib/star/types';

class StopsStore {
	stops = $state<Stop[]>([]);
	loaded = $state(false);
	error = $state<string | null>(null);

	byId = $derived.by(() => {
		const m = new Map<string, Stop>();
		for (const s of this.stops) m.set(s.id, s);
		return m;
	});

	async load(): Promise<void> {
		if (this.loaded) return;
		try {
			const res = await fetch('/stops.json');
			if (!res.ok) {
				this.error = `status ${res.status}`;
				return;
			}
			this.stops = (await res.json()) as Stop[];
			this.loaded = true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
	}
}

export const stopsStore = new StopsStore();
```

- [ ] **Step 2: Create the trip-stops store**

Create `src/lib/stores/trip-stops.svelte.ts`:

```ts
import type { TripStopsIndex } from '$lib/star/types';

class TripStopsStore {
	index = $state<TripStopsIndex | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);

	async load(): Promise<void> {
		if (this.index || this.loading) return;
		this.loading = true;
		try {
			const res = await fetch('/trip-stops.json');
			if (!res.ok) {
				this.error = `status ${res.status}`;
				return;
			}
			this.index = (await res.json()) as TripStopsIndex;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.loading = false;
		}
	}
}

export const tripStopsStore = new TripStopsStore();
```

- [ ] **Step 3: Run check**

```bash
pnpm check
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/stops.svelte.ts src/lib/stores/trip-stops.svelte.ts
git commit -m "$(cat <<'EOF'
:sparkles: ajoute byId sur stopsStore et tripStopsStore lazy
EOF
)"
```

---

## Task 6 — Render the body of `DrillLine`

**Files:**
- Modify: `src/lib/ui/DrillLine.svelte`

- [ ] **Step 1: Replace the file**

Replace the full contents of `src/lib/ui/DrillLine.svelte` with the version below. The header section (button + chip + name + counter) is preserved; the body is new.

```svelte
<script lang="ts">
	import { flip } from 'svelte/animate';
	import LineChip from './LineChip.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { stopsStore } from '$lib/stores/stops.svelte';
	import { tripStopsStore } from '$lib/stores/trip-stops.svelte';
	import { computeVehicleStops, groupByDirection } from '$lib/star/line-detail';
	import type { Vehicle } from '$lib/star/types';

	type Props = { lineCode: string };
	let { lineCode }: Props = $props();

	$effect(() => {
		void tripStopsStore.load();
		void stopsStore.load();
	});

	const line = $derived(linesStore.byCode.get(lineCode));
	const lineVehicles = $derived(
		vehiclesStore.vehicles.filter((v) => v.lineCode === lineCode)
	);
	const onlineCount = $derived(lineVehicles.length);

	const grouped = $derived.by(() => {
		const idx = tripStopsStore.index;
		if (!idx) return { groups: [], orphans: lineVehicles };
		return groupByDirection(lineVehicles, idx, { withOrphans: true });
	});

	function rowOf(v: Vehicle) {
		const idx = tripStopsStore.index;
		if (!idx) return { status: 'unknown' as const, prev: null, next: null };
		return computeVehicleStops(v, idx, stopsStore.byId);
	}

	function sequenceFor(v: Vehicle): number {
		// Sort key: descending currentStopSequence keeps buses near terminus on top.
		// Vehicles missing the field fall to the bottom.
		return v.currentStopSequence ?? -1;
	}

	function selectVehicle(id: string): void {
		selectionStore.selectVehicle(id);
	}
</script>

<header class="drill">
	<button class="back" type="button" onclick={() => selectionStore.clear()} aria-label="Tout voir">
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
			<path
				d="M14.5 5.5 8 12l6.5 6.5"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		Tout voir
	</button>
	<div class="title">
		<LineChip code={lineCode} size="lg" />
		<div class="meta">
			<h2>{line?.name ?? `Ligne ${lineCode}`}</h2>
			<p class="tick">
				{onlineCount} véhicule{onlineCount > 1 ? 's' : ''} en circulation
			</p>
		</div>
	</div>
</header>

<div class="body">
	{#if onlineCount === 0}
		<p class="empty">Aucun bus en circulation pour cette ligne pour le moment.</p>
	{:else if !tripStopsStore.index && tripStopsStore.loading}
		<p class="skeleton">Chargement des trajets…</p>
	{:else}
		{#each grouped.groups as group (group.direction + '|' + group.headsign)}
			<section class="group">
				<h3 class="group-head">
					<span class="head-label">{group.headsign || `Sens ${group.direction}`}</span>
					<span class="head-count">· {group.vehicles.length}</span>
				</h3>
				<ul class="rows">
					{#each [...group.vehicles].sort((a, b) => sequenceFor(b) - sequenceFor(a)) as v (v.id)}
						{@const r = rowOf(v)}
						<li animate:flip={{ duration: 200 }}>
							<button class="row" type="button" onclick={() => selectVehicle(v.id)}>
								{#if r.status === 'stopped'}
									<span class="dot stopped" aria-hidden="true"></span>
									<span class="stop">{r.next?.name ?? r.prev?.name ?? '—'}</span>
									<span class="muted">à l'arrêt</span>
								{:else if r.status === 'departure'}
									<span class="muted">Départ</span>
									<span class="arrow" aria-hidden="true">→</span>
									<span class="stop">{r.next?.name ?? '—'}</span>
								{:else if r.status === 'arrived'}
									<span class="stop">{r.prev?.name ?? '—'}</span>
									<span class="arrow" aria-hidden="true">→</span>
									<span class="muted">Terminus</span>
								{:else if r.status === 'transit'}
									<span class="stop">{r.prev?.name ?? '—'}</span>
									<span class="arrow" aria-hidden="true">→</span>
									<span class="stop">{r.next?.name ?? '—'}</span>
								{:else}
									<span class="muted">Position GPS uniquement</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		{#if grouped.orphans && grouped.orphans.length > 0}
			<section class="group">
				<h3 class="group-head">
					<span class="head-label">Position GPS uniquement</span>
					<span class="head-count">· {grouped.orphans.length}</span>
				</h3>
				<ul class="rows">
					{#each grouped.orphans as v (v.id)}
						<li>
							<button class="row" type="button" onclick={() => selectVehicle(v.id)}>
								<span class="muted">Bus #{v.id}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.drill {
		padding: 4px 18px 0;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px 8px 8px;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--surface-fg-soft);
		border-radius: 999px;
		transition: background 140ms var(--ease-out-quart);
	}
	.back:hover {
		background: var(--color-cream-deep);
		color: var(--surface-fg);
	}
	.title {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 6px 0 12px;
	}
	.meta {
		min-width: 0;
		flex: 1;
	}
	h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--surface-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tick {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--surface-fg-soft);
		font-variant-numeric: tabular-nums;
	}
	.body {
		padding: 4px 18px 16px;
	}
	.empty,
	.skeleton {
		margin: 12px 0;
		font-size: 13px;
		color: var(--surface-fg-soft);
	}
	.group + .group {
		margin-top: 14px;
	}
	.group-head {
		margin: 6px 0 6px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--surface-fg-soft);
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 6px;
	}
	.head-count {
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
	}
	.rows {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		font-size: 13.5px;
		text-align: left;
		color: var(--surface-fg);
		border-radius: 8px;
		background: transparent;
		transition: background 120ms var(--ease-out-quart);
	}
	.row:hover {
		background: var(--color-cream-deep);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.dot.stopped {
		background: var(--surface-fg-soft);
	}
	.stop {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.arrow {
		flex: 0 0 auto;
		color: var(--surface-fg-soft);
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
	}
	.muted {
		color: var(--surface-fg-soft);
		font-size: 12.5px;
	}
</style>
```

- [ ] **Step 2: Run check**

```bash
pnpm check
```

Expected: pass.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ui/DrillLine.svelte
git commit -m "$(cat <<'EOF'
:sparkles: affiche les bus en circulation par sens dans la fiche ligne
EOF
)"
```

---

## Task 7 — Bump radius `+1 px` for selected-line buses

**Files:**
- Modify: `src/lib/map/VehicleLayer.svelte`

The dim-on-line-selection logic already exists (lines 155–184). We only refine the radius for the selected line so its buses feel emphasized.

- [ ] **Step 1: Modify the radius expression in the `if (filterCode)` branch**

In `src/lib/map/VehicleLayer.svelte`, locate the call to `map.setPaintProperty(LAYER_DOT, 'circle-radius', …)` inside the `if (filterCode)` block (currently a default expression at lines 172–183). Replace it with the case expression below so matched buses get a tiny size bump:

```ts
			map.setPaintProperty(LAYER_DOT, 'circle-radius', [
				'case',
				['==', ['get', 'lineCode'], filterCode],
				['interpolate', ['linear'], ['zoom'], 10, 6, 14, 10, 17, 15],
				['interpolate', ['linear'], ['zoom'], 10, 5, 14, 9, 17, 14]
			] as never);
```

- [ ] **Step 2: Run check and lint**

```bash
pnpm check && pnpm lint
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/map/VehicleLayer.svelte
git commit -m "$(cat <<'EOF'
:lipstick: grossit les bus de la ligne sélectionnée d'un pixel
EOF
)"
```

---

## Task 8 — Smoke test in dev and verify the deployed flow

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: In a browser, click a line that has live vehicles**

Pick a Chronostar (e.g. C1, C4, C6) — they're frequent. Verify:

- The fiche shows the count and at least one section header `« VERS … · N »`.
- Rows render in either `prev → next` or `● <stop> à l'arrêt` form.
- The other lines' buses on the map dim to ~0.18 opacity, the selected line's buses bump up.
- Tapping a row pans the map and switches the panel to `DrillBus`.
- Tapping back from `DrillBus` returns to "Tout voir" (expected v1 behavior).

- [ ] **Step 3: Click a line with no live vehicles (e.g. a night-only line during the day)**

Verify the empty state copy matches: « Aucun bus en circulation pour cette ligne pour le moment. ».

- [ ] **Step 4: Run the full test + check + lint suite**

```bash
pnpm test && pnpm check && pnpm lint
```

Expected: green across the board.

- [ ] **Step 5: Push**

```bash
git push
```

- [ ] **Step 6: Close the loop on issue #7**

Comment on `https://github.com/wesdig-code/star-radar/issues/7` with the head commit SHA and tick the boxes corresponding to the tasks above. Close the issue once the production deploy on Cloudflare is verified visually.

---

## Self-review summary

- **Spec coverage:** every requirement of `2026-05-09-fiche-ligne-design.md` maps to a task — protobuf extraction (Task 1), build script + JSON (Tasks 2–3), pure helpers (Task 4), stores (Task 5), DrillLine UI (Task 6), map dim refinement (Task 7), smoke (Task 8).
- **Hors-scope guarantees** (line shapes, history navigation, ETA, proximity, direction selector) are explicitly NOT touched here — they live in their own future issues.
- **Frequent commits:** one per task, gitmoji style consistent with the repo.
- **TDD where it pays:** Task 1 and Task 4 carry full Vitest coverage. UI components (`DrillLine`, `VehicleLayer`) rely on `pnpm check` + visual smoke (Task 8) — pragmatic given the existing test posture in this repo.
