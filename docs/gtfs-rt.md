# GTFS-Realtime — STAR Rennes

Spike #1 — disponibilité, fraîcheur et qualité des flux temps-réel publiés par
Keolis Rennes. Cette note alimente la suite (endpoint `/api/network/health`,
tiroir « État du réseau », bandeau métro, surbrillance des arrêts impactés).

## Flux et URLs

Les trois flux GTFS-RT sont relayés par le proxy `transport.data.gouv.fr` (préféré au
domaine STAR direct : pas d'auth, mise en cache, support HTTP standardisé,
`Content-Type` correct).

| Flux             | URL                                                                                              | Statut                |
| ---------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| VehiclePositions | `https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position` | ✅ déjà consommé      |
| TripUpdates      | `https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update`      | ✅ disponible (v1 OK) |
| Alerts           | `https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-alerts`           | ✅ disponible (v1 OK) |

`Content-Type` retourné : `application/x-protobuf` (alerts) ou
`application/octet-stream` (trip-update). Décodage avec
`gtfs-realtime-bindings` v1.x — la même lib qu'on utilise déjà pour
`VehiclePositions`.

## Fraîcheur observée

Snapshot capté le 2026-05-02 à 19:26 UTC.

- VehiclePositions : header `timestamp` à T-0s, on poll en 12s côté serveur.
- TripUpdates : header `timestamp` à T-0s. La page transport.data.gouv.fr
  documente une mise à jour `~30s`. Polling cible : 15s côté serveur, cache edge 10s.
- Alerts : header `timestamp` à T-0s. Mises à jour rares (admin manuel STAR).
  Polling cible : 60s côté serveur, cache edge 30s.

## Champs réellement remplis

### TripUpdates

Échantillon : 154 trips actifs, 33 lignes couvertes simultanément.

- `trip.tripId`, `trip.routeId`, `trip.directionId` : remplis.
- `trip.scheduleRelationship` : `SCHEDULED` partout dans l'échantillon. La doc
  GTFS-RT autorise `CANCELED` (3) → notre code doit le gérer même si on ne
  l'a pas observé. Le snapshot ne suffit pas pour confirmer la fréquence
  d'utilisation, mais la structure est là.
- `vehicle.id` / `vehicle.label` : remplis.
- `timestamp` (par TripUpdate) : rempli (epoch s).

`stopTimeUpdate[]` (3743 au total dans l'échantillon) :

- `stopId` : rempli.
- `arrival.time` / `departure.time` : remplis (epoch s, prédiction).
- **`arrival.delay` / `departure.delay` : JAMAIS remplis** (toujours 0).
  STAR publie des **temps absolus prédits**, pas des deltas vs horaire théorique.
  → cf. Plan B ci-dessous.
- `scheduleRelationship` : `SCHEDULED` (3726) ou `SKIPPED` (17) dans
  l'échantillon. Pas de `NO_DATA` ni `UNSCHEDULED` observés.
- `arrival.uncertainty` / `departure.uncertainty` : rempli (souvent `0` ou
  `120`s pour les arrêts éloignés du bus).

### Alerts

Échantillon : 41 alertes actives.

- `cause` : `10 = CONSTRUCTION` partout dans l'échantillon (toutes les alertes
  actuelles sont des travaux). La proto autorise tout l'enum (`ACCIDENT`,
  `STRIKE`, `MEDICAL_EMERGENCY`, etc.) — notre code ne doit pas se reposer
  sur cette homogénéité.
- `effect` : `8 = UNKNOWN_EFFECT` partout dans l'échantillon (cf. la proto
  GTFS-RT — `OTHER_EFFECT = 7`, `UNKNOWN_EFFECT = 8`). STAR ne renseigne
  jamais ce champ : c'est la valeur d'enum par défaut. **Conséquence
  pratique** : on ne peut pas distinguer une « ligne fermée » d'une
  « rénovation d'ascenseur » uniquement par `effect`. Les valeurs
  significatives qu'on doit savoir filtrer **si elles apparaissent un
  jour** : `1 NO_SERVICE`, `2 REDUCED_SERVICE`, `3 SIGNIFICANT_DELAYS`,
  `4 DETOUR`. **Conséquence pour #6 (bandeau métro)** : se baser
  uniquement sur `effect` ne déclencherait jamais le bandeau dans l'état
  actuel des données. C'est volontaire : tant que STAR ne fournit pas
  d'effet typé, on préfère manquer un bandeau que d'en afficher un pour
  une déviation cosmétique. À ré-évaluer si la qualité des effets
  s'améliore côté STAR.
- `headerText.translation[0].text` : rempli en français. Ex : `Travaux`,
  `Rénovation ascenseur - Triangle`.
- `descriptionText.translation[0].text` : rempli en français, multi-ligne,
  parfois avec URL en clair dans le corps.
- `url.translation[0].text` : rempli quand STAR a une page de détail
  (`https://www.star.fr/se-deplacer/info-trafic/ligne/<code>`). Souvent
  rempli, pas systématique.
- `informedEntity[]` : `routeId` toujours présent ; `stopId` parfois
  (alertes liées à un arrêt précis). `agencyId` jamais rempli.
- `activePeriod[]` : `start`/`end` (epoch s) remplis ; les deux peuvent
  s'étendre sur des mois (rénovation d'ascenseur) ou quelques heures
  (déviation ponctuelle).

## Décision — go / no-go

**GO** sur les deux flux pour l'endpoint `/api/network/health`, avec deux
nuances :

1. **Cancellations** (`schedule_relationship: CANCELED`) : structure supportée,
   on l'expose dans la réponse. Plus rare en pratique — pas observé dans cet
   échantillon. À monitorer une fois en prod.
2. **Délais moyens** : pas livrables tels quels (cf. Plan B). On expose les
   `SKIPPED` (saut d'arrêt) et l'`uncertainty` comme proxy de fidélité. Le
   champ `avgDelayMin` du contrat #2 est implémenté en best-effort (déduit
   du `time` prédit vs heure courante pour les arrêts proches du bus, sinon
   `null`).

## Plan B — calcul de retard

STAR ne remplit pas `delay`. Trois approches, par ordre de coût croissant :

1. **v1, retenue** : pour les arrêts dont la prédiction a `uncertainty: 0`
   et qui sont les premiers à venir (`arrival.time > now`, plus proche), on
   considère que la différence avec l'horaire théorique GTFS statique
   correspond au retard. Si l'horaire statique n'est pas chargé en mémoire,
   on retombe sur **`null`** pour `avgDelayMin` et on classe la ligne en
   « état nominal » sauf alerte explicite. **C'est ce que fait l'endpoint
   v1 : le champ `avgDelayMin` n'est rempli que si on a la base GTFS
   statique en cache, sinon il est omis et la ligne ne remonte pas dans
   `delayedLines`.**
2. **v2 (issue future)** : charger `stop_times.txt` du GTFS statique au build,
   indexer `(tripId, stopSequence) → scheduledTime`, recalculer les retards
   serveur-side à chaque tick, agréger par `routeId`.
3. **v3** : passer à un fournisseur tiers (Navitia, Transport.data.gouv API
   v2) qui pré-calcule les retards. Hors-stack, à éviter.

Pour le tiroir #3 et la sidebar #4, les sources d'information « ligne
perturbée » dans l'ordre de fiabilité :

- alerte active (`Alerts.informedEntity.routeId`) → fiable, on affiche
- trip annulé (`TripUpdates.trip.schedule_relationship == CANCELED`) → fiable, on affiche
- arrêts sautés (`stopTimeUpdate.schedule_relationship == SKIPPED`) → fiable, on affiche
- retard moyen calculé → best-effort v1, fiable v2 (cf. Plan B)

## Impact sur les issues suivantes

- **#2** : peut s'implémenter dès maintenant. Le contrat reste celui de
  l'issue, mais `avgDelayMin` peut être absent (number | null) pour la v1.
  À documenter dans le type TS.
- **#3** : peut afficher « X trajets annulés » et « N alertes » sans
  dépendre de `avgDelayMin`.
- **#5** (arrêts impactés) : `Alerts.informedEntity.stopId` est rempli pour
  certaines alertes, mais Plan B (alerte sur la ligne qui dessert l'arrêt)
  reste plus robuste pour la v1.
- **#6** : `Alerts.url` est souvent rempli vers la page STAR par ligne, ce
  qui simplifie le lien externe. Fallback sur `https://www.star.fr/`
  comme prévu par l'issue.

## Pour rejouer le spike

```sh
curl -s -o /tmp/feed_trip-update.bin \
  https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update
curl -s -o /tmp/feed_alerts.bin \
  https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-alerts

# Décodage rapide (depuis le repo, pour résoudre node_modules) :
node -e "
const G = require('gtfs-realtime-bindings');
const fs = require('node:fs');
const f = G.transit_realtime.FeedMessage.decode(fs.readFileSync('/tmp/feed_alerts.bin'));
console.log('entities:', f.entity.length);
console.log(JSON.stringify(f.entity[0], null, 2));
"
```
