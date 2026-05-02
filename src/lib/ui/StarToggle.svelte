<script lang="ts">
	import { favoritesStore } from '$lib/stores/favorites.svelte';

	type Props = {
		code: string;
		label: string;
		size?: 'sm' | 'md';
	};
	let { code, label, size = 'md' }: Props = $props();
	const pressed = $derived(favoritesStore.has(code));

	function onClick(e: MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();
		favoritesStore.toggle(code);
	}

	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		favoritesStore.toggle(code);
	}
</script>

<button
	type="button"
	class="star star-{size}"
	class:on={pressed}
	aria-pressed={pressed}
	aria-label={pressed ? `Détacher la ligne ${label}` : `Épingler la ligne ${label}`}
	onclick={onClick}
	onkeydown={onKey}
>
	<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
		<path
			d="M12 2.7l2.86 5.79 6.39.93-4.62 4.5 1.09 6.36L12 17.27l-5.72 3.01 1.09-6.36-4.62-4.5 6.39-.93L12 2.7z"
			fill={pressed ? 'currentColor' : 'none'}
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<style>
	.star {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		color: var(--color-slate-soft);
		transition:
			color 160ms var(--ease-out-quart),
			transform 160ms var(--ease-out-quart);
	}
	.star-sm {
		width: 24px;
		height: 24px;
		padding: 4px;
	}
	.star-md {
		width: 32px;
		height: 32px;
		padding: 6px;
	}
	.star:hover {
		color: var(--color-ink-soft);
	}
	.star.on {
		color: var(--color-favorite, oklch(78% 0.16 80));
		transform: scale(1.06);
	}
	.star:active {
		transform: scale(0.94);
	}
</style>
