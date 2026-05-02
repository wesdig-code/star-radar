<script lang="ts">
	import { networkStore } from '$lib/stores/network.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { SIGNIFICANT_ALERT_EFFECTS } from '$lib/star/health';
	import LineChip from './LineChip.svelte';
	import type { NetworkAlert } from '$lib/star/types';

	type Props = {
		// `route_short_name` of lines that warrant a forced banner. Configurable
		// for the day Chronostars or another high-load line earns the same
		// treatment.
		criticalCodes?: string[];
	};
	let { criticalCodes = ['a', 'b'] }: Props = $props();

	const STAR_FALLBACK = 'https://www.star.fr/';

	const codeForRouteId = $derived.by(() => {
		const m = new Map<string, string>();
		for (const l of linesStore.lines) {
			if (l.gtfsRouteId) m.set(l.gtfsRouteId, l.code);
		}
		return m;
	});

	function alertCodes(a: NetworkAlert): string[] {
		return a.affectedRoutes.map((r) => codeForRouteId.get(r) ?? r);
	}

	const banners = $derived.by(() => {
		const matches: { code: string; alert: NetworkAlert }[] = [];
		const seen = new Set<string>();
		for (const a of networkStore.health.alerts) {
			if (!SIGNIFICANT_ALERT_EFFECTS.has(a.effect)) continue;
			for (const code of alertCodes(a)) {
				if (!criticalCodes.includes(code)) continue;
				if (seen.has(code)) continue;
				seen.add(code);
				matches.push({ code, alert: a });
			}
		}
		// Stable order: keep `criticalCodes` ordering ('a' before 'b').
		matches.sort((x, y) => criticalCodes.indexOf(x.code) - criticalCodes.indexOf(y.code));
		return matches;
	});

	function shortMessage(effect: NetworkAlert['effect']): string {
		switch (effect) {
			case 'NO_SERVICE':
				return 'trafic interrompu';
			case 'REDUCED_SERVICE':
				return 'trafic réduit';
			case 'SIGNIFICANT_DELAYS':
				return 'retards importants';
			case 'DETOUR':
				return 'itinéraire dévié';
			default:
				return 'perturbation';
		}
	}

	function detailUrl(a: NetworkAlert, code: string): string {
		if (a.url) return a.url;
		return `https://www.star.fr/se-deplacer/info-trafic/ligne/${code}`;
	}
</script>

{#if banners.length > 0}
	<div class="banner" role="alert" aria-live="assertive">
		<div class="content">
			<div class="chips">
				{#each banners as b (b.code)}
					<LineChip code={b.code} size="md" />
				{/each}
			</div>
			<div class="text">
				{#if banners.length === 1}
					{@const b = banners[0]}
					<p class="line">
						<span class="strong">Métro {b.code}</span>
						<span class="sep">·</span>
						<span>{shortMessage(b.alert.effect)}</span>
					</p>
					{#if b.alert.header}
						<p class="cause">{b.alert.header}</p>
					{/if}
				{:else}
					<p class="line">
						<span class="strong">Métros {banners.map((b) => b.code).join(' et ')}</span>
						<span class="sep">·</span>
						<span>perturbations</span>
					</p>
				{/if}
			</div>
			<a
				class="cta"
				href={banners.length === 1 ? detailUrl(banners[0].alert, banners[0].code) : STAR_FALLBACK}
				target="_blank"
				rel="noopener noreferrer"
			>
				Détails ↗
			</a>
		</div>
	</div>
{/if}

<style>
	.banner {
		flex-shrink: 0;
		background: var(--color-alert-banner);
		color: var(--color-cream);
		padding: 10px 14px calc(10px + env(safe-area-inset-top, 0));
		padding-top: calc(10px + env(safe-area-inset-top, 0));
		animation: slide-in 320ms var(--ease-out-quart);
		z-index: 50;
	}
	@keyframes slide-in {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.content {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 720px;
		margin: 0 auto;
	}
	.chips {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.line {
		margin: 0;
		font-size: 14px;
		line-height: 1.3;
	}
	.strong {
		font-weight: 600;
	}
	.sep {
		opacity: 0.7;
		margin: 0 4px;
	}
	.cause {
		margin: 2px 0 0;
		font-size: 12px;
		opacity: 0.85;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.cta {
		flex-shrink: 0;
		font-size: 13px;
		font-weight: 500;
		padding: 6px 10px;
		border-radius: 999px;
		background: oklch(100% 0 0 / 0.18);
		color: inherit;
		text-decoration: none;
		transition: background 160ms var(--ease-out-quart);
	}
	.cta:hover {
		background: oklch(100% 0 0 / 0.28);
	}
</style>
