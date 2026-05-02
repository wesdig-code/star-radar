<script lang="ts">
	import LineChip from './LineChip.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';

	type Props = { lineCode: string };
	let { lineCode }: Props = $props();

	const line = $derived(linesStore.byCode.get(lineCode));
	const onlineCount = $derived(
		vehiclesStore.vehicles.filter((v) => v.lineCode === lineCode).length
	);
</script>

<header class="drill">
	<button class="back" type="button" onclick={() => selectionStore.clear()} aria-label="Tout voir">
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
			<path
				d="M14.5 5.5 8 12l6.5 6.5"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		Tout voir
	</button>
	<div class="title">
		<LineChip code={lineCode} size="lg" />
		<div class="meta">
			<h2>{line?.name ?? `Ligne ${lineCode}`}</h2>
			<p class="tick">
				{onlineCount} véhicule{onlineCount > 1 ? 's' : ''} en circulation
			</p>
		</div>
	</div>
</header>

<style>
	.drill {
		padding: 4px 18px 0;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px 8px 8px;
		margin-bottom: 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--surface-fg-soft);
		border-radius: 999px;
		transition: background 140ms var(--ease-out-quart);
	}
	.back:hover {
		background: var(--color-cream-deep);
		color: var(--surface-fg);
	}
	.title {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 6px 0 12px;
	}
	.meta {
		min-width: 0;
		flex: 1;
	}
	h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--surface-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tick {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--surface-fg-soft);
	}
</style>
