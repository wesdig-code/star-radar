<script lang="ts">
	import { geoStore } from '$lib/stores/geo.svelte';

	type Props = {
		onCenter: (lng: number, lat: number) => void;
	};
	let { onCenter }: Props = $props();

	function handle(): void {
		if (geoStore.permission === 'denied') return;
		if (geoStore.position) {
			onCenter(geoStore.position.lng, geoStore.position.lat);
			return;
		}
		geoStore.request();
	}

	$effect(() => {
		if (geoStore.position) {
			onCenter(geoStore.position.lng, geoStore.position.lat);
		}
	});

	const hidden = $derived(geoStore.permission === 'denied');
</script>

{#if !hidden}
	<button class="centre" type="button" onclick={handle} aria-label="Centrer sur ma position">
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="3.2" fill="currentColor" />
			<circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.6" />
			<line
				x1="12"
				y1="2"
				x2="12"
				y2="5.5"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<line
				x1="12"
				y1="18.5"
				x2="12"
				y2="22"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<line
				x1="2"
				y1="12"
				x2="5.5"
				y2="12"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<line
				x1="18.5"
				y1="12"
				x2="22"
				y2="12"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
		</svg>
	</button>
{/if}

<style>
	.centre {
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-elev);
		color: var(--surface-fg);
		border-radius: 999px;
		box-shadow: var(--shadow-float, 0 2px 24px -8px oklch(15% 0.02 32 / 0.18));
		backdrop-filter: blur(14px);
		transition: transform 180ms var(--ease-out-quart);
	}
	.centre:hover {
		transform: translateY(-1px);
	}
	.centre:active {
		transform: translateY(0) scale(0.97);
	}
</style>
