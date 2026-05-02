# star-radar

Live map of the STAR public transport network in Rennes, France. Real-time bus positions on a map — a glance-first **radar**, not a trip planner.

Strategic context lives in `PRODUCT.md`. Visual system lives in `DESIGN.md` (currently a seed — re-run `/impeccable document` once components exist to capture real tokens).

## Stack

- **SvelteKit 2** (Svelte 5, runes mode) + **TypeScript** (strict)
- **Vite** + **pnpm**
- **MapLibre GL JS v4** for cartography
- **Tailwind CSS v4** (CSS-first `@theme` config) — design tokens in OKLCH at `src/lib/styles/tokens.css`
- **Cloudflare Pages + Workers** via `@sveltejs/adapter-cloudflare`
- **Paraglide JS** (`@inlang/paraglide-sveltekit`) for i18n — French primary, English optional
- **`@vite-pwa/sveltekit`** for PWA shell + offline
- **Vitest** for unit tests; Playwright added when a flow earns it
- **ESLint + Prettier** with Svelte plugins (the `sv create` defaults), `svelte-check` for template types

## Real-time data

The STAR network (Keolis Rennes) publishes open data at `data.explore.star.fr`.

- **GTFS static** (routes, stops, schedules): fetched at build time or via a daily cron, cached.
- **GTFS-Realtime VehiclePositions** (protobuf): polled every 10–15s server-side, decoded with `gtfs-realtime-bindings`, served as plain JSON to the client.
- All STAR calls go through SvelteKit endpoints (`src/routes/api/...`). The browser never hits STAR directly — protobuf decode and any API keys stay server-side, request volume stays predictable.
- Cache edge responses for 5–10s to avoid hammering STAR.

## Dev conventions

- **Strict TypeScript.** No `any` without a one-line `// why:` justification.
- **Server-only secrets** (`MAPTILER_KEY`, etc.) are read from `$env/dynamic/private`, never from `$env/static/public`.
- **Easing:** `ease-out-quart` / `quint` / `expo` only. No bounce, no elastic.
- **Animate `transform` and `opacity` only.** Never animate layout properties.
- **Bus position interpolation:** linear between two GTFS-RT ticks; ease-out only for corrective jumps when an update arrives mid-interpolation.
- **Prefer Svelte transitions/animations** (`transition:`, `animate:flip`) over JS-driven motion — they're framework-native and cheaper.
- **Copy is French-first**, civic register. No "Try Pro", no engagement-marketing voice.
- **No `#000` or `#fff` anywhere** — every neutral is tinted toward STAR red. See DESIGN.md *Tinted-Neutrals Rule*.

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

## Scripts (after scaffolding)

- `pnpm dev` — Vite dev server
- `pnpm build` — production build (Cloudflare adapter)
- `pnpm preview` — local preview of the production build
- `pnpm check` — `svelte-check` (template + type errors)
- `pnpm lint` / `pnpm format` — ESLint + Prettier
- `pnpm test` — Vitest
- `pnpm wrangler:dev` — local Worker + edge runtime simulation

## Status

The project root currently contains only `.git`, `.claude`, `PRODUCT.md`, `DESIGN.md`, and this file. SvelteKit scaffolding has not been run yet. First step before any feature work:

```bash
pnpm create svelte@latest .
```

After scaffolding, route through `/impeccable shape <feature>` to design the first surface (the live map) before writing UI code.
