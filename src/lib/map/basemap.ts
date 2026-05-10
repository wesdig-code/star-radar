import type { StyleSpecification } from 'maplibre-gl';

/*
 * Basemap source.
 *
 * Production: a MAPTILER_KEY must be set on the Cloudflare Worker so we
 * serve a vector style with proper light/dark variants and stable glyphs.
 * Without the key, we deliberately fail closed in prod — see Map.svelte
 * for the error state. OSM tiles are *only* used as a local-dev fallback,
 * gated by `dev = true`, so we don't violate the OSM tile usage policy
 * <https://operations.osmfoundation.org/policies/tiles/> in production.
 */

export type BasemapConfig = {
	maptilerKey: string | null;
	dev: boolean;
};

export class BasemapKeyMissingError extends Error {
	constructor() {
		super('MAPTILER_KEY is not configured for this environment.');
		this.name = 'BasemapKeyMissingError';
	}
}

export function basemapStyle(cfg: BasemapConfig): string | StyleSpecification {
	if (cfg.maptilerKey) {
		return `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${encodeURIComponent(cfg.maptilerKey)}`;
	}
	if (!cfg.dev) {
		throw new BasemapKeyMissingError();
	}
	// Local-dev only: hits OSM directly to keep `pnpm dev` working without a
	// key. Loud console warning so anyone deploying this path notices.
	if (typeof console !== 'undefined') {
		console.warn(
			'[basemap] MAPTILER_KEY is unset — falling back to OpenStreetMap raster tiles. ' +
				'This must NOT reach production (OSM tile usage policy).'
		);
	}
	return {
		version: 8,
		// jsDelivr-served openmaptiles/fonts: CDN-backed (99.9 % SLA) and the
		// official upstream for OpenMapTiles glyphs. Replaces a previous URL on
		// orangemug.github.io which had no stability guarantee. Production uses
		// MapTiler glyphs above; this branch only runs in local dev.
		glyphs: 'https://cdn.jsdelivr.net/gh/openmaptiles/fonts@v2.0/{fontstack}/{range}.pbf',
		sources: {
			osm: {
				type: 'raster',
				tiles: [
					'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
					'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
					'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
				],
				tileSize: 256,
				maxzoom: 19,
				attribution: '© OpenStreetMap'
			}
		},
		layers: [
			{
				id: 'osm-base',
				type: 'raster',
				source: 'osm'
			}
		]
	};
}

export const RENNES_CENTER: [number, number] = [-1.6778, 48.1119];
export const RENNES_BOUNDS: [[number, number], [number, number]] = [
	[-1.86, 48.0],
	[-1.5, 48.21]
];
