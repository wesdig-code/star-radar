<script lang="ts">
	import LineChip from './LineChip.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { tick } from '$lib/stores/tick.svelte';
	import { formatRelative } from '$lib/utils/eta';

	type Props = { vehicleId: string };
	let { vehicleId }: Props = $props();

	const vehicle = $derived(vehiclesStore.vehicles.find((v) => v.id === vehicleId));
	const line = $derived(vehicle?.lineCode ? linesStore.byCode.get(vehicle.lineCode) : undefined);
	const speed = $derived(
		vehicle?.speed != null ? `${Math.round(vehicle.speed * 3.6)} km/h` : null
	);
</script>

<header class="drill">
	<button
		class="back"
		type="button"
		onclick={() => selectionStore.clear()}
		aria-label="Fermer"
	>
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
			<path
				d="m6 6 12 12M18 6 6 18"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
			/>
		</svg>
	</button>
	{#if vehicle}
		<div class="row">
			{#if vehicle.lineCode}
				<LineChip code={vehicle.lineCode} size="lg" />
			{/if}
			<div class="meta">
				<h2>{line?.name ?? 'Véhicule'}</h2>
				<p class="tick">
					{#if speed}{speed} · {/if}vu {formatRelative(vehicle.timestamp, tick.now)}
				</p>
			</div>
		</div>
	{:else}
		<p class="missing">Ce véhicule n’est plus en circulation.</p>
	{/if}
</header>

<style>
	.drill {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 4px 4px 0 18px;
	}
	.back {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--surface-fg-soft);
		border-radius: 999px;
		transition: background 140ms var(--ease-out-quart);
	}
	.back:hover {
		background: var(--color-cream-deep);
		color: var(--surface-fg);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		flex: 1;
		min-width: 0;
		padding: 4px 0 12px;
	}
	.meta {
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}
	.tick {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--surface-fg-soft);
	}
	.missing {
		flex: 1;
		font-size: 13px;
		color: var(--surface-fg-soft);
		padding: 12px 0;
	}
</style>
