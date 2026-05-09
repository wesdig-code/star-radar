<script lang="ts">
	import { flip } from 'svelte/animate';
	import LineChip from './LineChip.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { tripStopsStore } from '$lib/stores/trip-stops.svelte';
	import { computeVehicleStops, groupByDirection } from '$lib/star/line-detail';
	import type { Vehicle } from '$lib/star/types';

	type Props = { lineCode: string };
	let { lineCode }: Props = $props();

	$effect(() => {
		void tripStopsStore.load();
	});

	const line = $derived(linesStore.byCode.get(lineCode));
	const lineVehicles = $derived(vehiclesStore.vehicles.filter((v) => v.lineCode === lineCode));
	const onlineCount = $derived(lineVehicles.length);

	const grouped = $derived.by(() => {
		const idx = tripStopsStore.index;
		if (!idx) return { groups: [], orphans: lineVehicles };
		return groupByDirection(lineVehicles, idx, { withOrphans: true });
	});

	function rowOf(v: Vehicle) {
		const idx = tripStopsStore.index;
		if (!idx) return { status: 'unknown' as const, prev: null, next: null, current: null };
		return computeVehicleStops(v, idx);
	}

	function sequenceFor(v: Vehicle): number {
		// Sort key: descending currentStopSequence keeps buses near terminus on top.
		// Vehicles missing the field fall to the bottom.
		return v.currentStopSequence ?? -1;
	}

	function selectVehicle(id: string): void {
		selectionStore.selectVehicle(id);
	}
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

<div class="body">
	{#if onlineCount === 0}
		<p class="empty">Aucun bus en circulation pour cette ligne pour le moment.</p>
	{:else if !tripStopsStore.index && tripStopsStore.loading}
		<p class="skeleton">Chargement des trajets…</p>
	{:else}
		{#each grouped.groups as group (group.direction + '|' + group.headsign)}
			<section class="group">
				<h3 class="group-head">
					<span class="head-label">{group.headsign || `Sens ${group.direction}`}</span>
					<span class="head-count">· {group.vehicles.length}</span>
				</h3>
				<ul class="rows">
					{#each [...group.vehicles].sort((a, b) => sequenceFor(b) - sequenceFor(a)) as v (v.id)}
						{@const r = rowOf(v)}
						<li animate:flip={{ duration: 200 }}>
							<button class="row" type="button" onclick={() => selectVehicle(v.id)}>
								{#if r.status === 'stopped'}
									<span class="dot stopped" aria-hidden="true"></span>
									<span class="stop">{r.current?.name ?? '—'}</span>
									<span class="muted">à l'arrêt</span>
								{:else if r.status === 'departure'}
									<span class="muted">Départ</span>
									<span class="arrow" aria-hidden="true">→</span>
									<span class="stop">{r.next?.name ?? '—'}</span>
								{:else if r.status === 'arrived'}
									<span class="stop">{r.prev?.name ?? '—'}</span>
									<span class="arrow" aria-hidden="true">→</span>
									<span class="muted">Terminus</span>
								{:else if r.status === 'transit'}
									<span class="stop">{r.prev?.name ?? '—'}</span>
									<span class="arrow" aria-hidden="true">→</span>
									<span class="stop">{r.next?.name ?? '—'}</span>
								{:else}
									<span class="muted">Position GPS uniquement</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		{#if grouped.orphans && grouped.orphans.length > 0}
			<section class="group">
				<h3 class="group-head">
					<span class="head-label">Position GPS uniquement</span>
					<span class="head-count">· {grouped.orphans.length}</span>
				</h3>
				<ul class="rows">
					{#each grouped.orphans as v (v.id)}
						<li>
							<button class="row" type="button" onclick={() => selectVehicle(v.id)}>
								<span class="muted">Bus #{v.id}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

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
		font-variant-numeric: tabular-nums;
	}
	.body {
		padding: 4px 18px 16px;
	}
	.empty,
	.skeleton {
		margin: 12px 0;
		font-size: 13px;
		color: var(--surface-fg-soft);
	}
	.group + .group {
		margin-top: 14px;
	}
	.group-head {
		margin: 6px 0 6px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--surface-fg-soft);
		font-variant-numeric: tabular-nums;
		display: flex;
		gap: 6px;
	}
	.head-count {
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
	}
	.rows {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		font-size: 13.5px;
		text-align: left;
		color: var(--surface-fg);
		border-radius: 8px;
		background: transparent;
		transition: background 120ms var(--ease-out-quart);
	}
	.row:hover {
		background: var(--color-cream-deep);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.dot.stopped {
		background: var(--surface-fg-soft);
	}
	.stop {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.arrow {
		flex: 0 0 auto;
		color: var(--surface-fg-soft);
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
	}
	.muted {
		color: var(--surface-fg-soft);
		font-size: 12.5px;
	}
</style>
