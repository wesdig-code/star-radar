import type { Stop } from '$lib/star/types';

class StopsStore {
	stops = $state<Stop[]>([]);
	loaded = $state(false);
	error = $state<string | null>(null);

	byId = $derived.by(() => {
		const m = new Map<string, Stop>();
		for (const s of this.stops) m.set(s.id, s);
		return m;
	});

	async load(): Promise<void> {
		if (this.loaded) return;
		try {
			const res = await fetch('/stops.json');
			if (!res.ok) {
				this.error = `status ${res.status}`;
				return;
			}
			this.stops = (await res.json()) as Stop[];
			this.loaded = true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
	}
}

export const stopsStore = new StopsStore();
