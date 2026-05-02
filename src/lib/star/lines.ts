import type { Line } from './types';

/**
 * Fallback line catalog. Used when /api/lines hasn't returned yet, or for
 * mode/color before live data arrives. Real values come from the Opendatasoft
 * dataset `tco-bus-topologie-lignes-td` and override these on first fetch.
 */
export const FALLBACK_LINES: Line[] = [
	{ id: 'a', code: 'a', name: 'Métro a', mode: 'metro', color: 'oklch(56% 0.21 32)', textColor: '#fff' },
	{ id: 'b', code: 'b', name: 'Métro b', mode: 'metro', color: 'oklch(58% 0.17 152)', textColor: '#fff' },
	{ id: 'C1', code: 'C1', name: 'Chronostar C1', mode: 'bus', color: 'oklch(60% 0.16 240)', textColor: '#fff' },
	{ id: 'C2', code: 'C2', name: 'Chronostar C2', mode: 'bus', color: 'oklch(58% 0.16 200)', textColor: '#fff' },
	{ id: 'C3', code: 'C3', name: 'Chronostar C3', mode: 'bus', color: 'oklch(70% 0.16 100)', textColor: 'oklch(18% 0.012 32)' },
	{ id: 'C4', code: 'C4', name: 'Chronostar C4', mode: 'bus', color: 'oklch(75% 0.17 95)', textColor: 'oklch(18% 0.012 32)' },
	{ id: 'C5', code: 'C5', name: 'Chronostar C5', mode: 'bus', color: 'oklch(70% 0.18 60)', textColor: 'oklch(18% 0.012 32)' },
	{ id: 'C6', code: 'C6', name: 'Chronostar C6', mode: 'bus', color: 'oklch(60% 0.20 25)', textColor: '#fff' },
	{ id: 'C7', code: 'C7', name: 'Chronostar C7', mode: 'bus', color: 'oklch(50% 0.18 285)', textColor: '#fff' }
];

const FALLBACK_INDEX = new Map(FALLBACK_LINES.map((l) => [l.code, l]));

export function lineColor(code: string | undefined, lines?: Map<string, Line>): string {
	if (!code) return 'oklch(54% 0.008 32)';
	return lines?.get(code)?.color ?? FALLBACK_INDEX.get(code)?.color ?? 'oklch(54% 0.008 32)';
}

export function lineTextColor(code: string | undefined, lines?: Map<string, Line>): string {
	if (!code) return '#fff';
	return lines?.get(code)?.textColor ?? FALLBACK_INDEX.get(code)?.textColor ?? '#fff';
}
