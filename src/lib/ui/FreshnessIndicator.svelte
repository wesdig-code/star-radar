<script lang="ts">
	import { tick } from '$lib/stores/tick.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { formatRelative } from '$lib/utils/eta';

	const ageMs = $derived(
		vehiclesStore.updatedAt > 0 ? tick.now - vehiclesStore.updatedAt : 0
	);
	const stale = $derived(vehiclesStore.source === 'stale' || ageMs > 30_000);
	const error = $derived(!!vehiclesStore.error);
	const label = $derived(
		vehiclesStore.loading
			? 'Connexion au réseau STAR'
			: error
				? 'Connexion interrompue'
				: stale
					? formatRelative(vehiclesStore.updatedAt, tick.now)
					: 'En direct'
	);
</script>

<div
	class="freshness"
	class:is-loading={vehiclesStore.loading}
	class:is-stale={stale && !vehiclesStore.loading}
	class:is-error={error && !vehiclesStore.loading}
>
	<span class="dot" aria-hidden="true"></span>
	<span class="label">{label}</span>
</div>

<style>
	.freshness {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px 7px 10px;
		background: var(--surface-elev);
		border-radius: 999px;
		box-shadow: var(--shadow-float, 0 2px 24px -8px oklch(15% 0.02 32 / 0.18));
		backdrop-filter: blur(14px);
		font-size: 12px;
		color: var(--surface-fg-soft);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: oklch(62% 0.18 145);
		animation: pulse-fresh 1.6s var(--ease-out-quart) infinite;
	}
	.is-loading .dot {
		background: var(--color-slate-soft);
	}
	.is-stale .dot {
		background: var(--color-stale);
		animation: none;
		opacity: 0.6;
	}
	.is-error .dot {
		background: var(--color-star-red);
		animation: none;
	}
	.label {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.is-loading .label,
	.is-error .label {
		font-family: var(--font-sans);
		letter-spacing: normal;
	}
</style>
