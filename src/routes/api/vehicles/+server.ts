import { fetchVehiclePositions } from '$lib/star/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/*
 * STAR GTFS-RT VehiclePositions, decoded server-side and served as JSON.
 * Cache 8s edge-side: client polls every ~12s, so most clients hit cache
 * once and we never hammer transport.data.gouv.fr.
 */

let cache: { value: unknown; expires: number } | null = null;
const TTL_MS = 8_000;

export const GET: RequestHandler = async ({ fetch, setHeaders }) => {
	const now = Date.now();
	if (cache && cache.expires > now) {
		setHeaders({ 'cache-control': 'public, max-age=4' });
		return json(cache.value);
	}
	try {
		const snapshot = await fetchVehiclePositions(fetch);
		const value = { ...snapshot, source: 'live' as const };
		cache = { value, expires: now + TTL_MS };
		setHeaders({ 'cache-control': 'public, max-age=4' });
		return json(value);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown';
		return json({ vehicles: [], updatedAt: now, source: 'stale', error: message }, { status: 200 });
	}
};
