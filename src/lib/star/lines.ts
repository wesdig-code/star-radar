import type { Line } from './types';

/**
 * Fallback line catalog. Used when /api/lines hasn't returned yet, or for
 * mode/color before live data arrives. Real values come from the Opendatasoft
 * dataset `tco-bus-topologie-lignes-td` and override these on first fetch.
 *
 * Colors are sRGB hex (not oklch): MapLibre v4 paint properties only accept
 * legacy CSS color formats. CSS-side tokens stay in oklch.
 */
export const FALLBACK_LINES: Line[] = [
	{ id: 'a', code: 'a', name: 'Métro a', mode: 'metro', color: '#d32704', textColor: '#fff' },
	{ id: 'b', code: 'b', name: 'Métro b', mode: 'metro', color: '#009543', textColor: '#fff' },
	{ id: 'C1', code: 'C1', name: 'Chronostar C1', mode: 'bus', color: '#0089d5', textColor: '#fff' },
	{ id: 'C2', code: 'C2', name: 'Chronostar C2', mode: 'bus', color: '#00949f', textColor: '#fff' },
	{ id: 'C3', code: 'C3', name: 'Chronostar C3', mode: 'bus', color: '#b69f00', textColor: '#17100e' },
	{ id: 'C4', code: 'C4', name: 'Chronostar C4', mode: 'bus', color: '#d0ab00', textColor: '#17100e' },
	{ id: 'C5', code: 'C5', name: 'Chronostar C5', mode: 'bus', color: '#ec7d00', textColor: '#17100e' },
	{ id: 'C6', code: 'C6', name: 'Chronostar C6', mode: 'bus', color: '#de3b3d', textColor: '#fff' },
	{ id: 'C7', code: 'C7', name: 'Chronostar C7', mode: 'bus', color: '#5e4bc3', textColor: '#fff' }
];

const FALLBACK_INDEX = new Map(FALLBACK_LINES.map((l) => [l.code, l]));

const NEUTRAL_FALLBACK = '#736d6c';

export function lineColor(code: string | undefined, lines?: Map<string, Line>): string {
	if (!code) return NEUTRAL_FALLBACK;
	return lines?.get(code)?.color ?? FALLBACK_INDEX.get(code)?.color ?? NEUTRAL_FALLBACK;
}

export function lineTextColor(code: string | undefined, lines?: Map<string, Line>): string {
	if (!code) return '#fff';
	return lines?.get(code)?.textColor ?? FALLBACK_INDEX.get(code)?.textColor ?? '#fff';
}
