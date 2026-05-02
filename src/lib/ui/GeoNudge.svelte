<script lang="ts">
	import { geoStore } from '$lib/stores/geo.svelte';

	const visible = $derived(
		geoStore.permission !== 'granted' &&
			geoStore.permission !== 'denied' &&
			!geoStore.nudgeDismissed
	);
</script>

{#if visible}
	<div class="nudge" role="status">
		<p>Active la localisation pour voir les bus près de toi.</p>
		<div class="actions">
			<button class="primary" type="button" onclick={() => geoStore.request()}>
				Activer
			</button>
			<button
				class="ghost"
				type="button"
				onclick={() => geoStore.dismissNudge()}
				aria-label="Fermer"
			>
				<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
					<path
						d="m6 6 12 12M18 6 6 18"
						stroke="currentColor"
						stroke-width="1.7"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.nudge {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 8px 18px 12px;
		padding: 12px 14px;
		background: var(--color-star-tint);
		border-radius: 14px;
		font-size: 13px;
		color: var(--color-ink);
		animation: fade-in-up 320ms var(--ease-out-quart);
	}
	@media (prefers-color-scheme: dark) {
		.nudge {
			background: oklch(28% 0.08 32);
			color: oklch(95% 0.005 32);
		}
	}
	p {
		flex: 1;
		margin: 0;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.primary {
		padding: 6px 12px;
		background: var(--color-star-red);
		color: oklch(98% 0.004 32);
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		transition: transform 160ms var(--ease-out-quart);
	}
	.primary:hover {
		transform: translateY(-1px);
	}
	.ghost {
		width: 28px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--surface-fg-soft);
		border-radius: 999px;
	}
	.ghost:hover {
		background: oklch(94% 0.02 32);
	}
</style>
