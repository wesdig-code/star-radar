<script lang="ts">
	import { onDestroy, onMount, setContext } from 'svelte';
	import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
	import { basemapStyle, RENNES_CENTER } from './basemap';

	type Props = {
		maptilerKey?: string;
		onReady?: (map: MapLibreMap) => void;
		children?: import('svelte').Snippet;
	};

	let { maptilerKey, onReady, children }: Props = $props();

	let mapEl = $state<HTMLDivElement>();
	let map = $state<MapLibreMap | undefined>();
	let ready = $state(false);

	setContext<{ get: () => MapLibreMap | undefined }>('map', { get: () => map });

	onMount(() => {
		if (!mapEl) return;
		const m = new maplibregl.Map({
			container: mapEl,
			style: basemapStyle(maptilerKey),
			center: RENNES_CENTER,
			zoom: 11.5,
			minZoom: 9,
			maxZoom: 18,
			attributionControl: { compact: true },
			cooperativeGestures: false,
			pitchWithRotate: false,
			dragRotate: false
		});
		m.touchZoomRotate.disableRotation();
		m.on('load', () => {
			ready = true;
			onReady?.(m);
		});
		map = m;
	});

	onDestroy(() => {
		map?.remove();
		map = undefined;
	});
</script>

<div class="map-root">
	<div bind:this={mapEl} class="map-canvas"></div>
	{#if ready && map && children}
		{@render children()}
	{/if}
</div>

<style>
	.map-root {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.map-canvas {
		position: absolute;
		inset: 0;
	}
	/* Quiet the basemap so STAR line colours carry the cartography. The Map-
	   Floor Rule (DESIGN.md): map is the floor, lines are the show. With a
	   raster OSM source, we lean on filter + a tinted veil. Replace this with
	   a designer-tuned vector style when MAPTILER_KEY lands. */
	.map-root::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: oklch(98% 0.004 32 / 0.32);
		mix-blend-mode: lighten;
		z-index: 1;
	}
	:global(.map-canvas .maplibregl-canvas) {
		filter: saturate(0.32) brightness(1.06) contrast(0.92);
	}
	@media (prefers-color-scheme: dark) {
		.map-root::after {
			background: oklch(16% 0.012 32 / 0.55);
			mix-blend-mode: multiply;
		}
		:global(.map-canvas .maplibregl-canvas) {
			filter: saturate(0.25) brightness(0.62) contrast(0.95) invert(0.92) hue-rotate(180deg);
		}
	}
	:global(.maplibregl-ctrl-attrib) {
		font-size: 10px;
		opacity: 0.65;
	}
</style>
