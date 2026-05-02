/**
 * Cancellable polling with backoff on failure.
 * Calls `tick` every `intervalMs` while the AbortController isn't aborted.
 * On error, doubles the interval up to `maxBackoffMs`.
 */

export interface PollOptions {
	intervalMs: number;
	maxBackoffMs?: number;
	signal?: AbortSignal;
	onError?: (err: unknown) => void;
}

export async function poll(
	tick: (signal: AbortSignal) => Promise<void>,
	{ intervalMs, maxBackoffMs = 60_000, signal, onError }: PollOptions
): Promise<void> {
	let current = intervalMs;
	const ctrl = new AbortController();
	signal?.addEventListener('abort', () => ctrl.abort(), { once: true });

	while (!ctrl.signal.aborted) {
		try {
			await tick(ctrl.signal);
			current = intervalMs;
		} catch (err) {
			if (ctrl.signal.aborted) return;
			onError?.(err);
			current = Math.min(current * 2, maxBackoffMs);
		}
		if (ctrl.signal.aborted) return;
		await sleep(current, ctrl.signal);
	}
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});
}
