import { fetchAlerts, fetchTripUpdates, getLinesAndIndex } from '$lib/star/api';
import { buildNetworkHealth } from '$lib/star/health';
import type { NetworkHealth } from '$lib/star/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/*
 * Aggregated network health from STAR's TripUpdates + Alerts feeds.
 *
 * Server-side polling rhythm:
 *  - in-memory cache TTL: 8s — ride alongside `/api/vehicles` (12s client poll)
 *  - edge cache (Cache-Control s-maxage=10) — Cloudflare swallows bursts
 *
 * Failure model: if either feed errors, we degrade gracefully — empty
 * arrays for the dead feed, the live feed still flows. The UI shows
 * "Réseau nominal" rather than a hard error: the radar must always show
 * something useful.
 */

interface CachedHealth {
	value: NetworkHealth;
	expires: number;
}
let cache: CachedHealth | null = null;
const TTL_MS = 8_000;

export const GET: RequestHandler = async ({ fetch, setHeaders }) => {
	const now = Date.now();
	if (cache && cache.expires > now) {
		setHeaders({ 'cache-control': 'public, max-age=4, s-maxage=10' });
		return json(cache.value);
	}

	const [tripUpdates, alerts, linesAndIndex] = await Promise.allSettled([
		fetchTripUpdates(fetch),
		fetchAlerts(fetch),
		getLinesAndIndex(fetch)
	]);

	const lines = linesAndIndex.status === 'fulfilled' ? linesAndIndex.value.lines : [];

	const health = buildNetworkHealth(
		tripUpdates.status === 'fulfilled' ? (tripUpdates.value.entity ?? []) : [],
		alerts.status === 'fulfilled' ? (alerts.value.entity ?? []) : [],
		{ now, lines }
	);

	cache = { value: health, expires: now + TTL_MS };
	setHeaders({ 'cache-control': 'public, max-age=4, s-maxage=10' });
	return json(health);
};
