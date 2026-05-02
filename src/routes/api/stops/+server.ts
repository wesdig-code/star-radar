import { fetchStops } from '$lib/star/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

let cache: { value: unknown; expires: number } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

export const GET: RequestHandler = async ({ fetch, setHeaders, url }) => {
	const limit = Math.min(2500, Number(url.searchParams.get('limit') ?? 2000));
	const now = Date.now();
	if (cache && cache.expires > now) {
		setHeaders({ 'cache-control': 'public, max-age=600' });
		return json(cache.value);
	}
	const stops = await fetchStops(fetch, limit);
	cache = { value: stops, expires: now + TTL_MS };
	setHeaders({ 'cache-control': 'public, max-age=600' });
	return json(stops);
};
