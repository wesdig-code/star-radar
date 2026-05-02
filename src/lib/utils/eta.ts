/**
 * ETA formatting. Open question resolved (DESIGN brief §10):
 *   < 30 min → relative duration ("3 min")
 *   ≥ 30 min → absolute time ("12:34")
 *   < 60 s   → "imminent"
 */

export function formatEta(targetMs: number, nowMs: number = Date.now()): string {
	const deltaSec = Math.round((targetMs - nowMs) / 1000);
	if (deltaSec <= 30) return 'imminent';
	const deltaMin = Math.round(deltaSec / 60);
	if (deltaMin < 30) return `${deltaMin} min`;
	const d = new Date(targetMs);
	return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function formatRelative(timestampMs: number, nowMs: number = Date.now()): string {
	const deltaSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
	if (deltaSec < 5) return 'à l’instant';
	if (deltaSec < 60) return `il y a ${deltaSec}s`;
	const min = Math.round(deltaSec / 60);
	if (min < 60) return `il y a ${min} min`;
	return new Date(timestampMs).toLocaleTimeString('fr-FR', {
		hour: '2-digit',
		minute: '2-digit'
	});
}
