<script lang="ts">
	import { vehiclesStore } from '$lib/stores/vehicles.svelte';

	const isLoading = $derived(vehiclesStore.loading);
	const hasError = $derived(!!vehiclesStore.error && !vehiclesStore.loading);
	const noBuses = $derived(
		!vehiclesStore.loading && vehiclesStore.vehicles.length === 0 && !vehiclesStore.error
	);

	const isLateNight = $derived(() => {
		const h = new Date().getHours();
		return h >= 1 && h < 5;
	});

	const message = $derived(
		hasError
			? 'Connexion au réseau STAR interrompue.'
			: noBuses
				? isLateNight()
					? 'Pas de bus en circulation cette nuit.'
					: 'Aucun véhicule actif pour le moment.'
				: ''
	);

	const sub = $derived(
		hasError
			? 'On retente automatiquement, tu n’as rien à faire.'
			: noBuses
				? 'Le réseau reprend son service au petit matin.'
				: ''
	);
</script>

{#if isLoading}
	<div class="state state-loading">
		<span class="spinner" aria-hidden="true"></span>
		<p>Connexion au réseau STAR…</p>
	</div>
{:else if hasError || noBuses}
	<div class="state state-empty">
		<p class="msg">{message}</p>
		{#if sub}<p class="sub">{sub}</p>{/if}
	</div>
{/if}

<style>
	.state {
		padding: 28px 22px;
		text-align: left;
	}
	.state-loading {
		display: flex;
		gap: 12px;
		align-items: center;
		color: var(--surface-fg-soft);
		font-size: 13px;
	}
	.spinner {
		width: 14px;
		height: 14px;
		border-radius: 999px;
		border: 2px solid var(--color-slate-soft);
		border-top-color: var(--color-star-red);
		animation: spin 700ms linear infinite;
	}
	.msg {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
		color: var(--surface-fg);
	}
	.sub {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--surface-fg-soft);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
