<script lang="ts">
	import type { Snippet } from 'svelte';

	type Snap = 'peek' | 'mid' | 'full';

	type Props = {
		snap?: Snap;
		onSnapChange?: (s: Snap) => void;
		header?: Snippet;
		children: Snippet;
	};

	let { snap = $bindable('peek'), onSnapChange, header, children }: Props = $props();

	const PEEK = 88;
	const MID_VH = 0.5;
	const FULL_VH = 0.78;

	let viewportH = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
	let dragging = $state(false);
	let dragStartY = $state(0);
	let dragStartHeight = $state(0);
	let dragHeight = $state<number | null>(null);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onResize = () => (viewportH = window.innerHeight);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	const heightForSnap = (s: Snap): number => {
		if (s === 'peek') return PEEK;
		if (s === 'mid') return Math.round(viewportH * MID_VH);
		return Math.round(viewportH * FULL_VH);
	};
	const settledHeight = $derived(heightForSnap(snap));
	const height = $derived(dragging && dragHeight != null ? dragHeight : settledHeight);

	function pickSnap(h: number): Snap {
		const candidates: Snap[] = ['peek', 'mid', 'full'];
		let best: Snap = 'peek';
		let bestDelta = Infinity;
		for (const c of candidates) {
			const d = Math.abs(heightForSnap(c) - h);
			if (d < bestDelta) {
				bestDelta = d;
				best = c;
			}
		}
		return best;
	}

	function setSnap(next: Snap): void {
		if (snap === next) return;
		snap = next;
		onSnapChange?.(next);
	}

	function onPointerDown(e: PointerEvent): void {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		dragging = true;
		dragStartY = e.clientY;
		dragStartHeight = height;
		dragHeight = height;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent): void {
		if (!dragging) return;
		const delta = dragStartY - e.clientY;
		const next = Math.max(PEEK, Math.min(viewportH - 24, dragStartHeight + delta));
		dragHeight = next;
	}

	function onPointerUp(e: PointerEvent): void {
		if (!dragging) return;
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		const finalHeight = dragHeight ?? settledHeight;
		dragging = false;
		dragHeight = null;
		setSnap(pickSnap(finalHeight));
	}

	function onHandleKey(e: KeyboardEvent): void {
		if (e.key === 'ArrowUp' || e.key === 'PageUp') {
			e.preventDefault();
			if (snap === 'peek') setSnap('mid');
			else if (snap === 'mid') setSnap('full');
		} else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
			e.preventDefault();
			if (snap === 'full') setSnap('mid');
			else if (snap === 'mid') setSnap('peek');
		} else if (e.key === 'Home') {
			e.preventDefault();
			setSnap('peek');
		} else if (e.key === 'End') {
			e.preventDefault();
			setSnap('full');
		}
	}
</script>

<aside class="sheet" class:dragging style:height="{height}px" aria-label="Panneau lignes et arrêts">
	<div
		class="grab"
		role="slider"
		tabindex="0"
		aria-label="Hauteur du panneau"
		aria-orientation="vertical"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={snap === 'peek' ? 0 : snap === 'mid' ? 50 : 100}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onkeydown={onHandleKey}
	>
		<span class="bar"></span>
	</div>
	{#if header}
		<div class="header">{@render header()}</div>
	{/if}
	<div class="body">
		{@render children()}
	</div>
</aside>

<style>
	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface-elev);
		backdrop-filter: blur(20px);
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		box-shadow: 0 -8px 36px -10px oklch(15% 0.02 32 / 0.18);
		transition: height 280ms var(--ease-out-quint);
		z-index: 20;
		overflow: hidden;
		padding-bottom: env(safe-area-inset-bottom, 0);
	}
	.sheet.dragging {
		transition: none;
	}
	.grab {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 10px 0 6px;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.grab:active {
		cursor: grabbing;
	}
	.bar {
		display: block;
		width: 44px;
		height: 4px;
		border-radius: 999px;
		background: var(--color-slate-soft);
	}
	.header {
		flex-shrink: 0;
		padding: 4px 18px 12px;
	}
	.body {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 4px 0 16px;
	}

	@media (min-width: 880px) {
		.sheet {
			top: 16px;
			bottom: 16px;
			left: 16px;
			right: auto;
			width: 360px;
			height: auto !important;
			border-radius: 22px;
			box-shadow: 0 8px 36px -10px oklch(15% 0.02 32 / 0.22);
		}
		.grab {
			display: none;
		}
		.header {
			padding: 18px 20px 12px;
		}
	}
</style>
