<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { networkStore } from '$lib/stores/network.svelte';
	import { stopsStore } from '$lib/stores/stops.svelte';
	import { tick } from '$lib/stores/tick.svelte';
	import { geoStore } from '$lib/stores/geo.svelte';

	type Props = { children: import('svelte').Snippet };
	let { children }: Props = $props();

	onMount(() => {
		void linesStore.load();
		void stopsStore.load();
		vehiclesStore.start();
		networkStore.start();
		tick.start();
		geoStore.hydrate();
	});

	onDestroy(() => {
		vehiclesStore.stop();
		networkStore.stop();
		tick.stop();
	});
</script>

{@render children()}
