import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Server-only config exposed to the SPA so the basemap can decide between
// the MapTiler vector style and the local-dev fallback. The key itself is
// included in the response (the MapLibre client will need it to fetch
// tiles), but only ever via this endpoint — never baked into the bundle.

export const GET: RequestHandler = ({ setHeaders }) => {
	const maptilerKey = env.MAPTILER_KEY?.trim() || null;
	setHeaders({ 'cache-control': 'private, max-age=60' });
	return json({ maptilerKey, dev });
};
