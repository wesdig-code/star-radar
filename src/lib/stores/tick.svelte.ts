/**
 * 1Hz reactive clock. Drives UI that needs to re-evaluate against wall time
 * (freshness badges, ETA strings). Single source so we don't proliferate
 * setIntervals across components.
 */
class TickStore {
	now = $state(Date.now());
	private timer: ReturnType<typeof setInterval> | null = null;

	start(): void {
		this.stop();
		this.timer = setInterval(() => {
			this.now = Date.now();
		}, 1000);
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}

export const tick = new TickStore();
