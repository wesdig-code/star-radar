import type { NetworkHealth } from '$lib/star/types';
import { poll } from '$lib/utils/pollable';

const EMPTY: NetworkHealth = {
	updatedAt: new Date(0).toISOString(),
	delayedLines: [],
	cancelledLines: [],
	alerts: []
};

class NetworkStore {
	health = $state<NetworkHealth>(EMPTY);
	loaded = $state(false);
	error = $state<string | null>(null);

	private controller: AbortController | null = null;

	get disruptionCount(): number {
		const routesFromAlerts = new Set<string>();
		for (const a of this.health.alerts) {
			for (const r of a.affectedRoutes) routesFromAlerts.add(r);
		}
		return (
			routesFromAlerts.size + this.health.cancelledLines.length + this.health.delayedLines.length
		);
	}

	start(intervalMs = 15_000): void {
		this.stop();
		this.controller = new AbortController();
		void poll(
			async () => {
				const res = await fetch('/api/network/health');
				if (!res.ok) throw new Error(`status ${res.status}`);
				const data = (await res.json()) as NetworkHealth;
				this.health = data;
				this.loaded = true;
				this.error = null;
			},
			{
				intervalMs,
				signal: this.controller.signal,
				onError: (err) => {
					this.error = err instanceof Error ? err.message : String(err);
				}
			}
		);
	}

	stop(): void {
		this.controller?.abort();
		this.controller = null;
	}
}

export const networkStore = new NetworkStore();
