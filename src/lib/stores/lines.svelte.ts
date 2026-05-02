import { FALLBACK_LINES } from '$lib/star/lines';
import type { Line } from '$lib/star/types';

class LinesStore {
	lines = $state<Line[]>(FALLBACK_LINES);
	loaded = $state(false);
	error = $state<string | null>(null);

	get byCode(): Map<string, Line> {
		return new Map(this.lines.map((l) => [l.code, l]));
	}

	async load(): Promise<void> {
		try {
			const res = await fetch('/api/lines');
			if (!res.ok) {
				this.error = `status ${res.status}`;
				return;
			}
			const data = (await res.json()) as Line[];
			if (data.length > 0) this.lines = data;
			this.loaded = true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
	}
}

export const linesStore = new LinesStore();
