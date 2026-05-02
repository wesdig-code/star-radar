import type { Vehicle } from '$lib/star/types';
import { poll } from '$lib/utils/pollable';

class VehiclesStore {
	vehicles = $state<Vehicle[]>([]);
	updatedAt = $state(0);
	source = $state<'live' | 'stale'>('live');
	error = $state<string | null>(null);
	loading = $state(true);

	private controller: AbortController | null = null;

	start(intervalMs = 12_000): void {
		this.stop();
		this.controller = new AbortController();
		void poll(
			async () => {
				const res = await fetch('/api/vehicles');
				if (!res.ok) throw new Error(`status ${res.status}`);
				const data = (await res.json()) as {
					vehicles: Vehicle[];
					updatedAt: number;
					source: 'live' | 'stale';
					error?: string;
				};
				this.vehicles = data.vehicles ?? [];
				this.updatedAt = data.updatedAt ?? Date.now();
				this.source = data.source ?? 'live';
				this.error = data.error ?? null;
				this.loading = false;
			},
			{
				intervalMs,
				signal: this.controller.signal,
				onError: (err) => {
					this.error = err instanceof Error ? err.message : String(err);
					this.source = 'stale';
					this.loading = false;
				}
			}
		);
	}

	stop(): void {
		this.controller?.abort();
		this.controller = null;
	}
}

export const vehiclesStore = new VehiclesStore();
