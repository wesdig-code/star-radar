<script lang="ts">
	type Props = {
		value: string;
		onInput: (v: string) => void;
		placeholder?: string;
	};
	let { value = $bindable(), onInput, placeholder = 'Rechercher une ligne, un arrêt' }: Props = $props();
</script>

<label class="search">
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
		<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.6" />
		<line
			x1="16"
			y1="16"
			x2="20.5"
			y2="20.5"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
		/>
	</svg>
	<input
		type="search"
		bind:value
		oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
		{placeholder}
		autocomplete="off"
		spellcheck="false"
	/>
</label>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 14px;
		background: var(--color-cream-deep);
		color: var(--surface-fg-soft);
		border-radius: 14px;
		border: 1px solid var(--surface-divider);
		transition: border-color 160ms var(--ease-out-quart);
	}
	.search:focus-within {
		border-color: var(--color-star-red);
		color: var(--surface-fg);
	}
	input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		font: inherit;
		color: var(--surface-fg);
		outline: none;
	}
	input::placeholder {
		color: var(--surface-fg-soft);
	}
</style>
