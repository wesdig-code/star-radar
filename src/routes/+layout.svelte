<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { tick } from '$lib/stores/tick.svelte';
	import { geoStore } from '$lib/stores/geo.svelte';

	type Props = { children: import('svelte').Snippet };
	let { children }: Props = $props();

	onMount(() => {
		void linesStore.load();
		vehiclesStore.start();
		tick.start();
		geoStore.hydrate();
	});

	onDestroy(() => {
		vehiclesStore.stop();
		tick.stop();
	});
</script>

{@render children()}
