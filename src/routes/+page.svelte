<script lang="ts">
	import { untrack } from 'svelte';
	import Map from '$lib/map/Map.svelte';
	import VehicleLayer from '$lib/map/VehicleLayer.svelte';
	import StopLayer from '$lib/map/StopLayer.svelte';
	import BottomSheet from '$lib/ui/BottomSheet.svelte';
	import FreshnessIndicator from '$lib/ui/FreshnessIndicator.svelte';
	import CenterButton from '$lib/ui/CenterButton.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import LineList from '$lib/ui/LineList.svelte';
	import DrillLine from '$lib/ui/DrillLine.svelte';
	import DrillBus from '$lib/ui/DrillBus.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import GeoNudge from '$lib/ui/GeoNudge.svelte';
	import NetworkHealthDrawer from '$lib/ui/NetworkHealthDrawer.svelte';
	import MetroBanner from '$lib/ui/MetroBanner.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import { stopsStore } from '$lib/stores/stops.svelte';
	import type { Map as MapLibreMap } from 'maplibre-gl';

	let mapRef = $state<MapLibreMap | undefined>();
	let sheetSnap = $state<'peek' | 'mid' | 'full'>('peek');
	let query = $state('');
	let lastFlownVehicleId: string | null = null;

	// Pan to a vehicle when it gets selected (typically from a DrillLine row).
	// Untracking the vehicles list keeps us out of the 12 s poll cycle — we
	// only re-fly when the selection itself changes.
	$effect(() => {
		const sel = selectionStore.current;
		const map = mapRef;
		if (!map) return;
		const id = sel.kind === 'vehicle' ? sel.vehicleId : null;
		if (id === lastFlownVehicleId) return;
		lastFlownVehicleId = id;
		if (!id) return;
		const v = untrack(() => vehiclesStore.vehicles.find((x) => x.id === id));
		if (!v) return;
		map.flyTo({
			center: [v.lng, v.lat],
			zoom: Math.max(14, map.getZoom()),
			essential: true,
			duration: 700,
			easing: (t) => 1 - Math.pow(1 - t, 4)
		});
	});

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return linesStore.lines;
		// A query also matches a line if it serves a stop whose name contains
		// `q` — e.g. typing "Sainte-Anne" surfaces the metro line `a` even
		// though neither the line code nor name contains those characters.
		const linesViaStop = new Set<string>();
		for (const s of stopsStore.stops) {
			if (s.name.toLowerCase().includes(q)) {
				for (const code of s.lineCodes) linesViaStop.add(code);
			}
		}
		return linesStore.lines.filter(
			(l) =>
				l.code.toLowerCase().includes(q) ||
				l.name.toLowerCase().includes(q) ||
				l.mode.includes(q) ||
				linesViaStop.has(l.code)
		);
	});

	// `numeric` makes "C2" < "C10" and "10" < "32" < "151" — the order a
	// rider scans naturally rather than the API's arrival order.
	const byCode = (a: { code: string }, b: { code: string }) =>
		a.code.localeCompare(b.code, 'fr', { numeric: true, sensitivity: 'base' });

	const favoriteSet = $derived(new Set(favoritesStore.codes));
	const favorites = $derived(filtered.filter((l) => favoriteSet.has(l.code)).toSorted(byCode));
	const rest = $derived(filtered.filter((l) => !favoriteSet.has(l.code)));

	const metro = $derived(rest.filter((l) => l.mode === 'metro').toSorted(byCode));
	const chronostars = $derived(rest.filter((l) => l.code.startsWith('C')).toSorted(byCode));
	const otherBuses = $derived(
		rest.filter((l) => l.mode === 'bus' && !l.code.startsWith('C')).toSorted(byCode)
	);
	const hasFavorites = $derived(favorites.length > 0);

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
	<MetroBanner />
	<div class="map-stack">
		<Map onReady={onMapReady}>
			<StopLayer />
			<VehicleLayer />
		</Map>

		<div class="top-right">
			<NetworkHealthDrawer />
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
						<SearchField
							bind:value={query}
							onInput={(v) => (query = v)}
							onFocus={() => {
								if (sheetSnap === 'peek') sheetSnap = 'mid';
							}}
						/>
					</div>
				{/if}
			{/snippet}
			{#if selectionStore.current.kind === 'none'}
				<GeoNudge />
				{#if showEmptyState}
					<EmptyState />
				{/if}
				{#if hasFavorites}
					<LineList title="Mes lignes" lines={favorites} />
					<LineList title="Métro" lines={metro} separator />
				{:else}
					<LineList title="Métro" lines={metro} />
				{/if}
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
</div>

<style>
	.root {
		position: fixed;
		inset: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.map-stack {
		position: relative;
		flex: 1;
		min-height: 0;
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
