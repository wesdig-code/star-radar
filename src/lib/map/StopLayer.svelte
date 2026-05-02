<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import { stopsStore } from '$lib/stores/stops.svelte';
	import { networkStore } from '$lib/stores/network.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import type { Stop } from '$lib/star/types';

	type Point = { type: 'Point'; coordinates: [number, number] };
	type GeoJsonProperties = Record<string, unknown> | null;
	type Feature<G, P> = { type: 'Feature'; id?: string | number; geometry: G; properties: P };
	type FeatureCollection<G, P> = { type: 'FeatureCollection'; features: Feature<G, P>[] };

	const ctx = getContext<{ get: () => MapLibreMap | undefined }>('map');

	const SRC_ID = 'sr-stops';
	const LAYER_DOT = 'sr-stops-dot';
	const LAYER_ALERT = 'sr-stops-alert';

	let added = $state(false);

	const codeForRouteId = $derived.by(() => {
		const m = new Map<string, string>();
		for (const l of linesStore.lines) {
			if (l.gtfsRouteId) m.set(l.gtfsRouteId, l.code);
		}
		return m;
	});

	// Lines with at least one active alert (Plan B from issue #5: a stop is
	// considered impacted if one of the lines that serves it has an alert).
	const linesWithAlerts = $derived.by(() => {
		const set = new Set<string>();
		for (const a of networkStore.health.alerts) {
			for (const r of a.affectedRoutes) {
				const code = codeForRouteId.get(r) ?? r;
				set.add(code);
			}
		}
		return set;
	});

	const favoriteSet = $derived(new Set(favoritesStore.codes));
	const filterToFavorites = $derived(favoriteSet.size > 0);

	function isVisibleStop(s: Stop): boolean {
		if (!filterToFavorites) return true;
		for (const code of s.lineCodes) {
			if (favoriteSet.has(code)) return true;
		}
		return false;
	}

	function isImpactedStop(s: Stop): boolean {
		for (const code of s.lineCodes) {
			if (linesWithAlerts.has(code)) return true;
		}
		return false;
	}

	function buildFeatures(): FeatureCollection<Point, GeoJsonProperties> {
		const features: Feature<Point, GeoJsonProperties>[] = [];
		for (const s of stopsStore.stops) {
			if (!isVisibleStop(s)) continue;
			features.push({
				type: 'Feature',
				id: s.id,
				geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
				properties: {
					id: s.id,
					name: s.name,
					impacted: isImpactedStop(s) ? 1 : 0
				}
			});
		}
		return { type: 'FeatureCollection', features };
	}

	function ensureLayers(map: MapLibreMap): void {
		if (added) return;
		map.addSource(SRC_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

		// Quiet dot for nominal stops. A small tinted neutral, not pure grey
		// (cf. CLAUDE.md tinted-neutrals rule).
		map.addLayer({
			id: LAYER_DOT,
			type: 'circle',
			source: SRC_ID,
			minzoom: 14,
			filter: ['!=', ['get', 'impacted'], 1],
			paint: {
				'circle-color': '#9b8e8c',
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.5, 17, 5],
				'circle-stroke-color': '#fbf7f7',
				'circle-stroke-width': 1.2,
				'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14, 0.85]
			}
		});

		// Loud, alert-tinted dot for impacted stops, with a soft halo so the
		// rider's eye lands on them first.
		map.addLayer({
			id: LAYER_ALERT,
			type: 'circle',
			source: SRC_ID,
			minzoom: 13,
			filter: ['==', ['get', 'impacted'], 1],
			paint: {
				'circle-color': '#c54327',
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 8],
				'circle-stroke-color': '#fbf7f7',
				'circle-stroke-width': 1.6,
				'circle-opacity': 1
			}
		});

		map.on('mouseenter', LAYER_DOT, () => (map.getCanvas().style.cursor = 'pointer'));
		map.on('mouseleave', LAYER_DOT, () => (map.getCanvas().style.cursor = ''));
		map.on('mouseenter', LAYER_ALERT, () => (map.getCanvas().style.cursor = 'pointer'));
		map.on('mouseleave', LAYER_ALERT, () => (map.getCanvas().style.cursor = ''));

		added = true;
	}

	$effect(() => {
		const map = ctx.get();
		if (!map) return;
		ensureLayers(map);
	});

	$effect(() => {
		const map = ctx.get();
		if (!map || !added) return;
		// Touch reactive sources so this re-runs when any of them change.
		void stopsStore.stops;
		void networkStore.health.alerts;
		void favoritesStore.codes;
		const src = map.getSource(SRC_ID) as { setData?: (d: unknown) => void } | undefined;
		src?.setData?.(buildFeatures());
	});

	onDestroy(() => {
		const map = ctx.get();
		if (!map || !added) return;
		if (map.getLayer(LAYER_ALERT)) map.removeLayer(LAYER_ALERT);
		if (map.getLayer(LAYER_DOT)) map.removeLayer(LAYER_DOT);
		if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
	});
</script>
