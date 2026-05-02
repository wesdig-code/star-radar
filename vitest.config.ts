import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Stand-alone Vitest config: skips the SvelteKit + Tailwind plugins entirely
// so unit tests of pure modules (`src/lib/**`) don't spin up an HTTP server
// or fight cloudflare's adapter — they just import TS and run.
export default defineConfig({
	resolve: {
		alias: {
			$lib: resolve(__dirname, 'src/lib')
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		clearMocks: true
	}
});
