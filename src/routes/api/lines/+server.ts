import { getLinesAndIndex } from '$lib/star/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, setHeaders }) => {
	const { lines } = await getLinesAndIndex(fetch);
	setHeaders({ 'cache-control': 'public, max-age=600' });
	return json(lines);
};
