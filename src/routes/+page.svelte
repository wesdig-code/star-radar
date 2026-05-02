<script lang="ts">
	import Map from '$lib/map/Map.svelte';
	import VehicleLayer from '$lib/map/VehicleLayer.svelte';
	import BottomSheet from '$lib/ui/BottomSheet.svelte';
	import FreshnessIndicator from '$lib/ui/FreshnessIndicator.svelte';
	import CenterButton from '$lib/ui/CenterButton.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import LineList from '$lib/ui/LineList.svelte';
	import DrillLine from '$lib/ui/DrillLine.svelte';
	import DrillBus from '$lib/ui/DrillBus.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import GeoNudge from '$lib/ui/GeoNudge.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import type { Map as MapLibreMap } from 'maplibre-gl';

	let mapRef = $state<MapLibreMap | undefined>();
	let sheetSnap = $state<'peek' | 'mid' | 'full'>('peek');
	let query = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return linesStore.lines;
		return linesStore.lines.filter(
			(l) =>
				l.code.toLowerCase().includes(q) ||
				l.name.toLowerCase().includes(q) ||
				l.mode.includes(q)
		);
	});

	// `numeric` makes "C2" < "C10" and "10" < "32" < "151" — the order a
	// rider scans naturally rather than the API's arrival order.
	const byCode = (a: { code: string }, b: { code: string }) =>
		a.code.localeCompare(b.code, 'fr', { numeric: true, sensitivity: 'base' });

	const metro = $derived(filtered.filter((l) => l.mode === 'metro').toSorted(byCode));
	const chronostars = $derived(filtered.filter((l) => l.code.startsWith('C')).toSorted(byCode));
	const otherBuses = $derived(
		filtered.filter((l) => l.mode === 'bus' && !l.code.startsWith('C')).toSorted(byCode)
	);

	const showEmptyState = $derived(
		vehiclesStore.loading ||
			(!!vehiclesStore.error && vehiclesStore.vehicles.length === 0) ||
			(!vehiclesStore.loading && vehiclesStore.vehicles.length === 0)
	);

	function handleCentre(lng: number, lat: number): void {
		mapRef?.flyTo({
			center: [lng, lat],
			zoom: Math.max(14, mapRef.getZoom()),
			essential: true,
			duration: 700,
			easing: (t) => 1 - Math.pow(1 - t, 4)
		});
	}

	function onMapReady(map: MapLibreMap): void {
		mapRef = map;
		map.on('click', (e) => {
			if (e.originalEvent.target instanceof HTMLElement) {
				const inLayer = map.queryRenderedFeatures(e.point, {
					layers: ['sr-vehicles-dot']
				});
				if (inLayer.length === 0) selectionStore.clear();
			}
		});
	}
</script>

<svelte:head>
	<title>star-radar — Rennes en direct</title>
</svelte:head>

<div class="root">
	<Map onReady={onMapReady}>
		<VehicleLayer />
	</Map>

	<div class="top-right">
		<FreshnessIndicator />
		<CenterButton onCenter={handleCentre} />
	</div>

	<BottomSheet bind:snap={sheetSnap}>
		{#snippet header()}
			{#if selectionStore.current.kind === 'line'}
				<DrillLine lineCode={selectionStore.current.lineCode} />
			{:else if selectionStore.current.kind === 'vehicle'}
				<DrillBus vehicleId={selectionStore.current.vehicleId} />
			{:else}
				<div class="default-header">
					<SearchField bind:value={query} onInput={(v) => (query = v)} />
				</div>
			{/if}
		{/snippet}
		{#if selectionStore.current.kind === 'none'}
			<GeoNudge />
			{#if showEmptyState}
				<EmptyState />
			{/if}
			<LineList title="Métro" lines={metro} />
			<LineList title="Chronostars" lines={chronostars} />
			<LineList title="Autres lignes" lines={otherBuses} />
			{#if filtered.length === 0 && query.length > 0}
				<p class="no-match">Aucun résultat pour « {query} ».</p>
			{/if}
		{:else}
			<div class="drill-body">
				{#if selectionStore.current.kind === 'line'}
					<p class="drill-hint">
						Les bus de cette ligne sont en surbrillance sur la carte. Les autres lignes restent
						visibles, atténuées.
					</p>
				{:else if selectionStore.current.kind === 'vehicle'}
					<p class="drill-hint">
						Suivi du véhicule en direct. La position se met à jour toutes les 12&nbsp;secondes.
					</p>
				{/if}
			</div>
		{/if}
	</BottomSheet>
</div>

<style>
	.root {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}
	.top-right {
		position: absolute;
		top: calc(env(safe-area-inset-top, 0) + 12px);
		right: 12px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 10px;
		z-index: 30;
	}
	.default-header {
		padding-top: 4px;
	}
	.drill-body {
		padding: 4px 18px 16px;
	}
	.drill-hint {
		margin: 8px 0 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--surface-fg-soft);
	}
	.no-match {
		margin: 16px 18px;
		font-size: 13px;
		color: var(--surface-fg-soft);
	}

	@media (min-width: 880px) {
		.top-right {
			top: 18px;
			right: 18px;
		}
	}
</style>
