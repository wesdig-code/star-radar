import type { TripStopsIndex } from '$lib/star/types';

class TripStopsStore {
	index = $state<TripStopsIndex | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);

	async load(): Promise<void> {
		if (this.index || this.loading) return;
		this.loading = true;
		try {
			const res = await fetch('/trip-stops.json');
			if (!res.ok) {
				this.error = `status ${res.status}`;
				return;
			}
			this.index = (await res.json()) as TripStopsIndex;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.loading = false;
		}
	}
}

export const tripStopsStore = new TripStopsStore();
