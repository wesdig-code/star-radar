---
title: Fiche ligne — détail des bus en circulation
date: 2026-05-09
status: validated
---

# Fiche ligne — détail des bus en circulation

## Objectif

Permettre à un voyageur qui ouvre une ligne (depuis le menu `LineList`) de voir, en un coup d'œil, **où se trouvent ses bus à cet instant** : combien sont en circulation et, pour chacun, l'arrêt précédent (ou desservi) et celui vers lequel il roule, groupés par direction.

Inscription dans les principes produit :

- _Glance, don't browse_ : la fiche est lisible en 3 s.
- _Aliveness comes from data_ : la liste se met à jour automatiquement au tick 12 s du `vehiclesStore`, pas de bouton "rafraîchir".
- _Civic, not corporate_ : registre voyageur, pas marketing.

## Comportement attendu

### Ouverture

- L'utilisateur tape une ligne dans `LineList` → `selectionStore.selectLine(code)`.
- `+page.svelte` rend la fiche `DrillLine` (en-tête déjà existant : LineChip + nom + compteur de véhicules).
- `VehicleLayer` atténue les bus des autres lignes (`circle-opacity` 0.25, transition 120 ms `ease-out-quart`). Les bus de la ligne sélectionnée gardent leur couleur livrée pleine, +1 px de rayon.

### Liste des bus (corps de la fiche)

Groupée par sens, en-tête par direction : `« VERS <headsign> · <n> »` en mono / petites caps, neutre.

Tri intra-section : `currentStopSequence` décroissant (les bus les plus proches du terminus sont en haut — c'est ce qu'un voyageur cherche d'abord).

Format de row :

| État | Format |
|---|---|
| `IN_TRANSIT_TO` / `INCOMING_AT` | `<prev_name>  →  <next_name>` |
| `STOPPED_AT` | `● <stop_name>` (pastille tinted-neutral, pas de flèche) |
| Premier arrêt du pattern | `Départ · → <next>` |
| Dernier arrêt du pattern | `<prev> → Terminus` |

Le `→` est une vraie flèche unicode. Les compteurs et codes ligne sont en mono à chiffres tabulaires (Tabular-Mono Rule).

Tap row → `selectionStore.selectVehicle(id)` (passe à `DrillBus`) + `map.flyTo` sur le bus. Pas de navigation historisée pour la v1 : le back de `DrillBus` retombe sur `« Tout voir »`.

### Animations

`animate:flip` Svelte sur les rows pour fluidifier les changements de séquence quand un poll arrive. Pas d'animation JS — `transform` / `opacity` uniquement.

### Cas limites

| Cas | Comportement v1 |
|---|---|
| Bus sans `tripId` | Section dédiée `« Position GPS uniquement »` en bas, sans prev/next. |
| `tripId` absent de l'index (trip ajouté depuis le dernier build) | Idem + `console.warn` côté client pour estimer la fréquence. |
| `currentStopSequence === 0` | Pas de prev → row affiche `Départ · → <next>`. |
| Dernier arrêt du pattern | Pas de next → row affiche `<prev> → Terminus`. |
| 0 bus en circulation | Empty state : « Aucun bus en circulation pour cette ligne pour le moment. » |
| Ligne monodirectionnelle | Une seule section, sans changement de mise en forme. |
| `trip-stops.json` échoue à charger | Skeleton court puis fallback global sur « Position GPS uniquement ». |

## Architecture

### Build-time

`scripts/build-trip-stops.mjs` :

- Télécharge le GTFS statique de STAR (zip publié sur `transport.data.gouv.fr`).
- Parse `trips.txt` + `stop_times.txt`.
- Dédup les schémas de course (~100–300 patterns vs ~30 k trips/jour).
- Écrit `static/trip-stops.json` :

```json
{
  "patterns": [
    { "stops": ["1003", "1004", "1007"], "headsign": "Vers République", "direction": 0 }
  ],
  "trips": { "<trip_id>": 0 }
}
```

- Taille attendue : ~200 Ko gzippé (à confirmer au premier run).
- Chaîné dans `pnpm build` (comme `build:stops` aujourd'hui), exposé aussi en `pnpm build:trip-stops` pour rafraîchir hors build.

### Runtime serveur

`src/lib/star/api.ts` — extension de `fetchVehiclePositions` :

- Extraction de `currentStopSequence`, `stopId`, `currentStatus` (`STOPPED_AT` / `IN_TRANSIT_TO` / `INCOMING_AT`) du protobuf VehiclePosition.
- Mise à jour du type `Vehicle` dans `src/lib/star/types.ts` avec ces trois champs optionnels.
- Aucune sous-requête supplémentaire — c'est le même protobuf déjà fetché.

### Runtime client

- **`src/lib/stores/trip-stops.svelte.ts`** — store lazy, fetch `/trip-stops.json` au premier mount d'une `DrillLine`. Cache mémoire pour la session, le navigateur cache sur le long.
- **`src/lib/ui/DrillLine.svelte`** — corps ajouté sous l'en-tête : groupes par direction, rows construites en croisant `vehiclesStore` × `tripStopsStore` × `stopsStore`.
- **`src/lib/map/VehicleLayer.svelte`** — lit `selectionStore.current` ; quand `kind === 'line'`, applique l'atténuation décrite plus haut.

## Critères d'acceptation v1

- L'ouverture d'une ligne ayant ≥1 véhicule actif affiche les rows attendues en <1 s sur le déploiement Cloudflare.
- L'atténuation des autres bus est visible, fluide (≤120 ms) et réversible quand on revient à `« Tout voir »`.
- Bus sans `tripId` → row dans la section « Position GPS uniquement », pas de crash.
- `pnpm build` produit `static/trip-stops.json` et termine en <30 s additionnels.
- L'index gzippé sert à <500 Ko sur le wire.

## Hors scope (features séparées)

- **Tracés de lignes** (polylines sur la carte + clic ouvre la fiche) — issue dédiée.
- **Navigation historisée** `DrillBus → retour DrillLine` quand on est entré par une ligne.
- **ETA** par bus via le feed `TripUpdates`.
- **Tri par proximité utilisateur** (la geoloc est déjà en place côté store).
- **Sélecteur de sens** dans la fiche pour filtrer à un seul terminus.
