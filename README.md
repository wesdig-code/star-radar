# star-radar

Carte vivante du réseau STAR à Rennes — positions des bus en temps réel, à coup d'œil.

Pas un calculateur d'itinéraire : un **radar** pour voir d'un coup ce qui roule.

## Stack

- SvelteKit 2 + Svelte 5 (runes) + TypeScript strict
- MapLibre GL JS pour la carto
- Tailwind CSS v4 (tokens OKLCH)
- Cloudflare Pages + Workers
- Données : GTFS statique + GTFS-Realtime de `data.explore.star.fr`

## Démarrage

```bash
pnpm install
cp .env.example .env   # renseigner MAPTILER_KEY
pnpm dev
```

## Scripts

| Commande                    | Rôle                                  |
| --------------------------- | ------------------------------------- |
| `pnpm dev`                  | serveur Vite                          |
| `pnpm build`                | build production (adapter Cloudflare) |
| `pnpm preview`              | aperçu local du build                 |
| `pnpm check`                | `svelte-check` (types + templates)    |
| `pnpm lint` / `pnpm format` | Prettier + ESLint                     |
| `pnpm test:visual`          | tests Playwright                      |

## Documentation

- [`PRODUCT.md`](PRODUCT.md) — vision produit et principes stratégiques
- [`DESIGN.md`](DESIGN.md) — système visuel, tokens, doctrines
- [`CLAUDE.md`](CLAUDE.md) — conventions de code et contexte pour l'IA
