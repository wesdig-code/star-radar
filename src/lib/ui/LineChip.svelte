<script lang="ts">
	import { lineColor, lineTextColor } from '$lib/star/lines';
	import { linesStore } from '$lib/stores/lines.svelte';

	type Props = {
		code: string;
		size?: 'sm' | 'md' | 'lg';
	};
	let { code, size = 'md' }: Props = $props();

	const bg = $derived(lineColor(code, linesStore.byCode));
	const fg = $derived(lineTextColor(code, linesStore.byCode));
</script>

<span class="chip chip-{size}" style:background={bg} style:color={fg}>{code}</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		letter-spacing: -0.01em;
		border-radius: 999px;
		flex-shrink: 0;
	}
	.chip-sm {
		min-width: 22px;
		height: 22px;
		padding: 0 7px;
		font-size: 11px;
	}
	.chip-md {
		min-width: 30px;
		height: 30px;
		padding: 0 10px;
		font-size: 13px;
	}
	.chip-lg {
		min-width: 44px;
		height: 44px;
		padding: 0 14px;
		font-size: 17px;
	}
</style>
