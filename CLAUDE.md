# star-radar

Live map of the STAR public transport network in Rennes, France. Real-time bus positions on a map — a glance-first **radar**, not a trip planner.

Strategic context lives in `PRODUCT.md`. Visual system lives in `DESIGN.md` (currently a seed — re-run `/impeccable document` once components exist to capture real tokens).

## Stack

- **SvelteKit 2** (Svelte 5, runes mode) + **TypeScript** (strict)
- **Vite** + **pnpm**, Node 22
- **MapLibre GL JS v4** for cartography
- **Tailwind CSS v4** (CSS-first `@theme` config) — design tokens in OKLCH inline at `src/app.css`
- **Cloudflare Pages + Workers** via `@sveltejs/adapter-cloudflare` (`wrangler.toml`)
- **`gtfs-realtime-bindings`** for protobuf decode (server-only); GTFS static unpacked at build time with `adm-zip` + `csv-parse`
- **Vitest** for unit tests; **Playwright** for visual/E2E (`pnpm test:visual`)
- **ESLint + Prettier** with Svelte plugins, `svelte-check` for template types

Copy is French-first inline (no i18n framework yet — keep strings centralized in component scope so Paraglide can be slotted in later without surgery).

## Real-time data

The STAR network (Keolis Rennes) publishes open data at `data.explore.star.fr`.

- **GTFS static** (routes, stops, schedules): unpacked at build time by `scripts/build-stops.mjs` and `scripts/build-trip-stops.mjs` into `static/stops.json` and `static/trip-stops.json`. Re-run via `pnpm build:stops` / `pnpm build:trip-stops`. See `docs/gtfs-rt.md` for the GTFS-RT feed notes.
- **GTFS-Realtime VehiclePositions** (protobuf): fetched server-side, decoded with `gtfs-realtime-bindings`, served as plain JSON via `/api/vehicles`.
- All STAR calls go through SvelteKit endpoints under `src/routes/api/`:
  - `/api/vehicles` — decoded GTFS-RT vehicle positions
  - `/api/lines` — line metadata (refines runtime line colors per Operator-Truth Rule)
  - `/api/mapconfig` — basemap config (tile URL with server-side `MAPTILER_KEY`)
  - `/api/network/health` — feed freshness + degradation signal (drives `FreshnessIndicator` / `NetworkHealthDrawer`)
- The browser never hits STAR or MapTiler directly — protobuf decode and any API keys stay server-side.
- Cache edge responses briefly (5–10s) to avoid hammering STAR.

## Dev conventions

- **Strict TypeScript.** No `any` without a one-line `// why:` justification.
- **Server-only secrets** (`MAPTILER_KEY`, etc.) are read from `$env/dynamic/private`, never from `$env/static/public`.
- **Easing:** `ease-out-quart` / `quint` / `expo` only. No bounce, no elastic.
- **Animate `transform` and `opacity` only.** Never animate layout properties.
- **Bus position interpolation:** linear between two GTFS-RT ticks; ease-out only for corrective jumps when an update arrives mid-interpolation.
- **Prefer Svelte transitions/animations** (`transition:`, `animate:flip`) over JS-driven motion — they're framework-native and cheaper.
- **Copy is French-first**, civic register. No "Try Pro", no engagement-marketing voice.
- **No `#000` or `#fff` anywhere** — every neutral is tinted toward STAR red. See DESIGN.md _Tinted-Neutrals Rule_.

## Design context (quick reference)

The five strategic principles from PRODUCT.md, in priority order:

1. **Glance, don't browse** — optimize for the 3-second check at a bus stop.
2. **The map is the product** — cartography is the hero; chrome is supporting cast.
3. **Rennes, not "a French city"** — local specificity (real STAR livery, real line shapes, real geography).
4. **Aliveness comes from data, not decoration** — motion encodes real-time signal, never vibes.
5. **Civic, not corporate** — public-service tone, citizens not leads.

Two doctrines from DESIGN.md to remember by name:

- **The Operator-Truth Rule** — STAR's official line colors are sacred; never adjust them for "design coherence".
- **The Tabular-Mono Rule** — anything that ticks (ETAs, codes, IDs) renders in mono with tabular figures.

## Scripts

- `pnpm dev` — Vite dev server
- `pnpm build` — rebuilds stop snapshots, then production build (Cloudflare adapter)
- `pnpm build:stops` / `pnpm build:trip-stops` — regenerate the GTFS static snapshots independently
- `pnpm preview` — local preview of the production build
- `pnpm check` — `svelte-check` (template + type errors)
- `pnpm lint` / `pnpm format` — ESLint + Prettier
- `pnpm test` / `pnpm test:watch` — Vitest
- `pnpm test:visual` — Playwright

## Code map

- `src/lib/map/` — `Map.svelte`, `VehicleLayer.svelte`, `StopLayer.svelte`, `basemap.ts`. Cartography lives here; everything else is supporting cast.
- `src/lib/ui/` — chrome and panels: `BottomSheet`, `DrillBus`, `DrillLine`, `LineChip` / `LineList`, `SearchField`, `FreshnessIndicator`, `NetworkHealthDrawer`, `MetroBanner`, `GeoNudge`, `CenterButton`, `StarToggle`, `EmptyState`.
- `src/lib/star/` — STAR data layer: `api.ts`, `lines.ts`, `line-detail.ts`, `health.ts`, `types.ts`, with co-located tests + `__fixtures__/`.
- `src/lib/stores/` — Svelte 5 runes stores (`*.svelte.ts`): `vehicles`, `stops`, `trip-stops`, `lines`, `network`, `selection`, `favorites`, `geo`, `tick`.
- `src/lib/utils/` — `eta.ts` (ETA formatting), `pollable.ts` (polling primitive used by realtime stores).
- `src/routes/+page.svelte` — single-page shell hosting the map + UI.
- `scripts/` — build-time GTFS snapshot generators.
- `static/` — `stops.json`, `trip-stops.json` (generated), `glyphs/` for MapLibre fonts.

When adding a feature, route through `/impeccable shape <feature>` before writing UI code.
