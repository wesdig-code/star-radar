<script lang="ts">
	import { getContext, onDestroy, untrack } from 'svelte';
	import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
	import maplibregl from 'maplibre-gl';

	type Point = { type: 'Point'; coordinates: [number, number] };
	type GeoJsonProperties = Record<string, unknown> | null;
	type Feature<G, P> = { type: 'Feature'; id?: string | number; geometry: G; properties: P };
	type FeatureCollection<G, P> = { type: 'FeatureCollection'; features: Feature<G, P>[] };
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import type { Vehicle } from '$lib/star/types';
	import { lineColor, lineTextColor } from '$lib/star/lines';

	const ctx = getContext<{ get: () => MapLibreMap | undefined }>('map');

	const SRC_ID = 'sr-vehicles';
	const LAYER_DOT = 'sr-vehicles-dot';
	const LAYER_RING = 'sr-vehicles-ring';
	const LAYER_LABEL = 'sr-vehicles-label';

	let added = $state(false);

	type AnimState = { fromLng: number; fromLat: number; toLng: number; toLat: number; t0: number };
	const animations = new Map<string, AnimState>();
	const TICK_MS = 12_000;
	let raf: number | null = null;

	function vehicleFeature(v: Vehicle, lng: number, lat: number): Feature<Point, GeoJsonProperties> {
		const color = lineColor(v.lineCode, linesStore.byCode);
		const textColor = lineTextColor(v.lineCode, linesStore.byCode);
		return {
			type: 'Feature',
			id: v.id,
			geometry: { type: 'Point', coordinates: [lng, lat] },
			properties: {
				id: v.id,
				lineCode: v.lineCode ?? '',
				label: (v.lineCode ?? '').toUpperCase(),
				color,
				textColor,
				bearing: v.bearing ?? 0
			}
		};
	}

	function snapshotCollection(now: number): FeatureCollection<Point, GeoJsonProperties> {
		const features: Feature<Point, GeoJsonProperties>[] = [];
		for (const v of vehiclesStore.vehicles) {
			const a = animations.get(v.id);
			if (!a) {
				features.push(vehicleFeature(v, v.lng, v.lat));
				continue;
			}
			const t = Math.max(0, Math.min(1, (now - a.t0) / TICK_MS));
			const lng = a.fromLng + (a.toLng - a.fromLng) * t;
			const lat = a.fromLat + (a.toLat - a.fromLat) * t;
			features.push(vehicleFeature(v, lng, lat));
		}
		return { type: 'FeatureCollection', features };
	}

	function ensureLayers(map: MapLibreMap): void {
		if (added) return;
		map.addSource(SRC_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

		map.addLayer({
			id: LAYER_RING,
			type: 'circle',
			source: SRC_ID,
			paint: {
				'circle-color': ['get', 'color'],
				'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.22, 14, 0.45],
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 16, 17, 24],
				'circle-blur': 0.55
			}
		});

		map.addLayer({
			id: LAYER_DOT,
			type: 'circle',
			source: SRC_ID,
			paint: {
				'circle-color': ['get', 'color'],
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 9, 17, 14],
				'circle-stroke-color': '#fbf7f7',
				'circle-stroke-width': 1.6,
				'circle-pitch-alignment': 'map'
			}
		});

		map.addLayer({
			id: LAYER_LABEL,
			type: 'symbol',
			source: SRC_ID,
			minzoom: 11,
			layout: {
				'text-field': ['get', 'label'],
				'text-font': ['Roboto Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 11, 7.5, 14, 10, 17, 12.5],
				'text-allow-overlap': true,
				'text-ignore-placement': true,
				'text-letter-spacing': -0.02,
				'text-padding': 0
			},
			paint: {
				'text-color': ['get', 'textColor'],
				'text-halo-color': ['get', 'color'],
				'text-halo-width': 0.4
			}
		});

		map.on('mouseenter', LAYER_DOT, () => {
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', LAYER_DOT, () => {
			map.getCanvas().style.cursor = '';
		});
		map.on(
			'click',
			LAYER_DOT,
			(e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
				const f = e.features?.[0];
				const id = f?.properties?.id as string | undefined;
				if (id) selectionStore.selectVehicle(id);
			}
		);

		added = true;
	}

	function tickAnimations(): void {
		const map = ctx.get();
		if (!map || !added) {
			raf = requestAnimationFrame(tickAnimations);
			return;
		}
		const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
		if (src) src.setData(snapshotCollection(Date.now()));
		raf = requestAnimationFrame(tickAnimations);
	}

	$effect(() => {
		const map = ctx.get();
		if (!map) return;
		ensureLayers(map);
		if (raf == null) raf = requestAnimationFrame(tickAnimations);
	});

	$effect(() => {
		const map = ctx.get();
		if (!map || !added) return;
		const sel = selectionStore.current;
		const filterCode =
			sel.kind === 'line'
				? sel.lineCode
				: sel.kind === 'vehicle'
					? vehiclesStore.vehicles.find((v) => v.id === sel.vehicleId)?.lineCode
					: null;
		if (!filterCode) {
			map.setPaintProperty(LAYER_DOT, 'circle-opacity', 1);
			map.setPaintProperty(LAYER_RING, 'circle-opacity', [
				'interpolate',
				['linear'],
				['zoom'],
				10,
				0.22,
				14,
				0.45
			]);
			map.setPaintProperty(LAYER_LABEL, 'text-opacity', 1);
			return;
		}
		const matchExpr = ['case', ['==', ['get', 'lineCode'], filterCode], 1, 0.18] as never;
		map.setPaintProperty(LAYER_DOT, 'circle-opacity', matchExpr);
		const dimRing = ['case', ['==', ['get', 'lineCode'], filterCode], 0.45, 0.05] as never;
		map.setPaintProperty(LAYER_RING, 'circle-opacity', dimRing);
		const dimLabel = ['case', ['==', ['get', 'lineCode'], filterCode], 1, 0.15] as never;
		map.setPaintProperty(LAYER_LABEL, 'text-opacity', dimLabel);
	});

	$effect(() => {
		const incoming = vehiclesStore.vehicles;
		const updatedAt = vehiclesStore.updatedAt;
		untrack(() => {
			const now = Date.now();
			const seen = new Set<string>();
			for (const v of incoming) {
				seen.add(v.id);
				const prev = animations.get(v.id);
				const fromLng = prev ? approxLng(prev, now) : v.lng;
				const fromLat = prev ? approxLat(prev, now) : v.lat;
				animations.set(v.id, {
					fromLng,
					fromLat,
					toLng: v.lng,
					toLat: v.lat,
					t0: now
				});
			}
			for (const id of animations.keys()) {
				if (!seen.has(id)) animations.delete(id);
			}
			void updatedAt;
		});
	});

	function approxLng(a: AnimState, now: number): number {
		const t = Math.max(0, Math.min(1, (now - a.t0) / TICK_MS));
		return a.fromLng + (a.toLng - a.fromLng) * t;
	}
	function approxLat(a: AnimState, now: number): number {
		const t = Math.max(0, Math.min(1, (now - a.t0) / TICK_MS));
		return a.fromLat + (a.toLat - a.fromLat) * t;
	}

	onDestroy(() => {
		if (raf != null) cancelAnimationFrame(raf);
		const map = ctx.get();
		if (!map || !added) return;
		if (map.getLayer(LAYER_LABEL)) map.removeLayer(LAYER_LABEL);
		if (map.getLayer(LAYER_DOT)) map.removeLayer(LAYER_DOT);
		if (map.getLayer(LAYER_RING)) map.removeLayer(LAYER_RING);
		if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
	});
</script>
