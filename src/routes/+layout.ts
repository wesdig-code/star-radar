// SPA mode: SvelteKit pre-renders nothing here; the live map is fully client-side
// because MapLibre needs a real document to mount.
export const ssr = false;
export const csr = true;
export const prerender = false;
