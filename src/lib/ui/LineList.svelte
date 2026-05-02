<script lang="ts">
	import LineChip from './LineChip.svelte';
	import StarToggle from './StarToggle.svelte';
	import type { Line } from '$lib/star/types';
	import { selectionStore } from '$lib/stores/selection.svelte';

	type Props = {
		title: string;
		lines: Line[];
		muted?: boolean;
		/** Render a thin top divider above the section heading. */
		separator?: boolean;
	};
	let { title, lines, muted = false, separator = false }: Props = $props();
</script>

{#if lines.length > 0}
	<section class="block" class:muted class:separator>
		<h2>{title}</h2>
		<ul role="list">
			{#each lines as line (line.id)}
				<li>
					<button type="button" onclick={() => selectionStore.selectLine(line.code)} class="row">
						<LineChip code={line.code} size="md" />
						<span class="name">{line.name}</span>
						<span class="mode">{line.mode === 'metro' ? 'Métro' : 'Bus'}</span>
						<StarToggle code={line.code} label={line.code} size="sm" />
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.block {
		padding: 4px 0 8px;
	}
	.block.muted {
		opacity: 0.85;
	}
	.block.separator {
		border-top: 1px solid var(--surface-divider);
		margin-top: 6px;
		padding-top: 10px;
	}
	h2 {
		margin: 6px 18px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--surface-fg-soft);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		padding: 10px 18px;
		text-align: left;
		transition: background 140ms var(--ease-out-quart);
	}
	.row:hover {
		background: var(--color-cream-deep);
	}
	.name {
		flex: 1;
		min-width: 0;
		font-size: 14px;
		color: var(--surface-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mode {
		font-size: 11px;
		color: var(--surface-fg-soft);
		text-transform: lowercase;
	}
</style>
