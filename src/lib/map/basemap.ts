import type { StyleSpecification } from 'maplibre-gl';

/*
 * Basemap source.
 *
 * Default: OpenStreetMap raster tiles. No API key, real coverage at every
 * zoom level we need (8–18). When MAPTILER_KEY is set, swap to a vector
 * style for sharper rendering and proper light/dark variants.
 *
 * The Map-Floor Rule (DESIGN.md) wants the basemap quiet. We mute the OSM
 * canvas client-side via CSS filters so STAR line colors carry cartographic
 * emphasis. A custom MapTiler / Protomaps style would be tuned at the
 * source instead.
 */

export function basemapStyle(maptilerKey?: string): string | StyleSpecification {
	if (maptilerKey) {
		return `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${encodeURIComponent(maptilerKey)}`;
	}
	return {
		version: 8,
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
