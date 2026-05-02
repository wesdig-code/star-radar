/**
 * Favorite lines (« Mes lignes »). Persists to localStorage so the
 * regular rider sees their personalized radar on every visit.
 *
 * The store uses a Set internally for O(1) membership checks (sidebar,
 * map paint expressions, drawer filters all read it on every reactive
 * update — Array.includes would be quadratic with N favorites).
 */

import { browser } from '$app/environment';

const KEY = 'star-radar:favorites';

function readInitial(): string[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((x): x is string => typeof x === 'string');
	} catch {
		return [];
	}
}

class FavoritesStore {
	codes = $state<string[]>([]);
	private set = new Set<string>();

	constructor() {
		const initial = readInitial();
		this.codes = initial;
		this.set = new Set(initial);
	}

	get count(): number {
		return this.codes.length;
	}

	has(code: string): boolean {
		return this.set.has(code);
	}

	toggle(code: string): void {
		if (this.set.has(code)) this.remove(code);
		else this.add(code);
	}

	add(code: string): void {
		if (this.set.has(code)) return;
		this.set.add(code);
		this.codes = [...this.codes, code];
		this.persist();
	}

	remove(code: string): void {
		if (!this.set.has(code)) return;
		this.set.delete(code);
		this.codes = this.codes.filter((c) => c !== code);
		this.persist();
	}

	clear(): void {
		this.set.clear();
		this.codes = [];
		this.persist();
	}

	private persist(): void {
		if (!browser) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.codes));
		} catch {
			// Quota or private mode — silently degrade. The store still works
			// in-memory for the current session.
		}
	}
}

export const favoritesStore = new FavoritesStore();
