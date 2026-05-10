<script lang="ts">
	import { onDestroy, onMount, setContext } from 'svelte';
	import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
	import { basemapStyle, BasemapKeyMissingError, RENNES_CENTER } from './basemap';

	type Props = {
		onReady?: (map: MapLibreMap) => void;
		children?: import('svelte').Snippet;
	};

	let { onReady, children }: Props = $props();

	let mapEl = $state<HTMLDivElement>();
	let map = $state<MapLibreMap | undefined>();
	let ready = $state(false);
	let configError = $state(false);

	setContext<{ get: () => MapLibreMap | undefined }>('map', { get: () => map });

	onMount(async () => {
		if (!mapEl) return;
		let cfg: { maptilerKey: string | null; dev: boolean };
		try {
			const res = await fetch('/api/mapconfig');
			if (!res.ok) throw new Error(`mapconfig HTTP ${res.status}`);
			cfg = await res.json();
		} catch (err) {
			console.error('[map] failed to load /api/mapconfig', err);
			configError = true;
			return;
		}
		let style: ReturnType<typeof basemapStyle>;
		try {
			style = basemapStyle(cfg);
		} catch (err) {
			if (err instanceof BasemapKeyMissingError) {
				configError = true;
				return;
			}
			throw err;
		}
		const m = new maplibregl.Map({
			container: mapEl,
			style,
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
	{#if configError}
		<div class="map-error" role="status">
			<p class="title">Carte indisponible</p>
			<p class="hint">
				La clé MapTiler du serveur est manquante ou invalide. La cartographie reprend dès que la
				configuration est rétablie.
			</p>
		</div>
	{/if}
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
	   raster OSM source, we lean on filter + a subtle veil. Replace this with
	   a designer-tuned vector style when MAPTILER_KEY lands. */
	.map-root::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: oklch(98% 0.004 32 / 0.18);
		mix-blend-mode: lighten;
		z-index: 1;
	}
	:global(.map-canvas .maplibregl-canvas) {
		filter: saturate(0.6) brightness(1.04) contrast(0.95);
	}
	/* Dark mode: keep the OSM raster legible — no `invert` (would flip the
	   bus dot colors that share the canvas), no aggressive darkening. The
	   dark UI chrome around the map carries the dark-mode identity; the map
	   itself stays a quiet, slightly muted version of light. */
	@media (prefers-color-scheme: dark) {
		.map-root::after {
			background: oklch(28% 0.014 32 / 0.18);
			mix-blend-mode: multiply;
		}
		:global(.map-canvas .maplibregl-canvas) {
			filter: saturate(0.55) brightness(0.96) contrast(0.98);
		}
	}
	:global(.maplibregl-ctrl-attrib) {
		font-size: 10px;
		opacity: 0.65;
	}
	.map-error {
		position: absolute;
		inset: 50% 16px auto 16px;
		transform: translateY(-50%);
		max-width: 480px;
		margin: 0 auto;
		padding: 18px 20px;
		background: var(--surface-elev);
		border-radius: 18px;
		box-shadow: 0 12px 36px -10px oklch(15% 0.02 32 / 0.22);
		text-align: center;
		z-index: 5;
	}
	.map-error .title {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: 600;
		color: var(--surface-fg);
	}
	.map-error .hint {
		margin: 0;
		font-size: 13px;
		color: var(--surface-fg-soft);
		line-height: 1.45;
	}
</style>
