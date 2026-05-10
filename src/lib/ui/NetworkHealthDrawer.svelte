<script lang="ts">
	import { networkStore } from '$lib/stores/network.svelte';
	import { linesStore } from '$lib/stores/lines.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import LineChip from './LineChip.svelte';
	import type { NetworkAlert, DelayedLine, CancelledLine } from '$lib/star/types';

	let open = $state(false);
	let drawer = $state<HTMLElement>();
	let toggleBtn = $state<HTMLButtonElement>();

	// `routeId` (GTFS) → `routeShortName` (UI). The drawer payload sometimes
	// only carries routeIds (alerts), so we resolve to the public code lazily.
	const routeIdToCode = $derived.by(() => {
		const m = new Map<string, string>();
		for (const l of linesStore.lines) {
			if (l.gtfsRouteId) m.set(l.gtfsRouteId, l.code);
		}
		return m;
	});

	const favorites = $derived(new Set(favoritesStore.codes));

	function codesFromAlert(alert: NetworkAlert): string[] {
		return alert.affectedRoutes.map((r) => routeIdToCode.get(r) ?? r);
	}

	function isFavoriteAlert(alert: NetworkAlert): boolean {
		return codesFromAlert(alert).some((c) => favorites.has(c));
	}

	const myAlerts = $derived(
		favorites.size > 0 ? networkStore.health.alerts.filter(isFavoriteAlert) : []
	);
	const restAlerts = $derived(
		favorites.size > 0
			? networkStore.health.alerts.filter((a) => !isFavoriteAlert(a))
			: networkStore.health.alerts
	);

	const myDelays = $derived(
		favorites.size > 0
			? networkStore.health.delayedLines.filter((l) => favorites.has(l.routeShortName))
			: []
	);
	const restDelays = $derived(
		favorites.size > 0
			? networkStore.health.delayedLines.filter((l) => !favorites.has(l.routeShortName))
			: networkStore.health.delayedLines
	);

	const myCancels = $derived(
		favorites.size > 0
			? networkStore.health.cancelledLines.filter((l) => favorites.has(l.routeShortName))
			: []
	);
	const restCancels = $derived(
		favorites.size > 0
			? networkStore.health.cancelledLines.filter((l) => !favorites.has(l.routeShortName))
			: networkStore.health.cancelledLines
	);

	const totalCount = $derived(networkStore.disruptionCount);
	const hasFavorites = $derived(favorites.size > 0);
	const myCount = $derived(myAlerts.length + myDelays.length + myCancels.length);
	const restCount = $derived(restAlerts.length + restDelays.length + restCancels.length);
	const everythingFineGlobally = $derived(totalCount === 0);
	const everythingFineForMe = $derived(hasFavorites && myCount === 0 && restCount > 0);

	function toggle(): void {
		open = !open;
		if (open) {
			// Move focus inside the drawer for screen-reader users; keep the
			// trigger reachable on close.
			queueMicrotask(() => {
				drawer?.querySelector<HTMLElement>('[data-drawer-focus]')?.focus();
			});
		}
	}

	function close(): void {
		open = false;
		queueMicrotask(() => toggleBtn?.focus());
	}

	function onKey(e: KeyboardEvent): void {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		}
		if (e.key === 'Tab' && open && drawer) {
			// Minimal focus trap: cycle within the drawer's focusable descendants.
			const focusables = drawer.querySelectorAll<HTMLElement>(
				'a, button, [tabindex]:not([tabindex="-1"])'
			);
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	// Returns null when the GTFS effect is unknown so the renderer can skip
	// the headline label and avoid duplicating `a.header`.
	function alertHeadline(a: NetworkAlert): string | null {
		switch (a.effect) {
			case 'NO_SERVICE':
				return 'Service interrompu';
			case 'REDUCED_SERVICE':
				return 'Service réduit';
			case 'SIGNIFICANT_DELAYS':
				return 'Retards importants';
			case 'DETOUR':
				return 'Déviation';
			case 'STOP_MOVED':
				return 'Arrêt déplacé';
			case 'MODIFIED_SERVICE':
				return 'Service modifié';
			case 'ADDITIONAL_SERVICE':
				return 'Service renforcé';
			default:
				return null;
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<button
	bind:this={toggleBtn}
	type="button"
	class="trigger"
	class:open
	class:has-disruption={totalCount > 0}
	aria-expanded={open}
	aria-controls="sr-network-drawer"
	aria-label={open ? 'Fermer le panneau État du réseau' : 'Ouvrir le panneau État du réseau'}
	onclick={toggle}
>
	<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
		<path
			d="M12 4l8 4v6c0 4.5-3.5 7-8 8-4.5-1-8-3.5-8-8V8l8-4z"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<path
			d="M9 12l2 2 4-4"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
	<span class="label">Réseau</span>
	{#if totalCount > 0}
		<span class="badge tick" aria-label="{totalCount} perturbations">{totalCount}</span>
	{/if}
</button>

{#if open}
	<button type="button" class="scrim" onclick={close} aria-label="Fermer"></button>
{/if}

<div
	bind:this={drawer}
	id="sr-network-drawer"
	class="drawer"
	class:open
	role="dialog"
	aria-modal={open}
	aria-labelledby="sr-network-title"
	aria-hidden={!open}
	inert={!open}
	tabindex="-1"
>
	<header class="head">
		<h2 id="sr-network-title">État du réseau</h2>
		<button
			type="button"
			class="close"
			onclick={close}
			data-drawer-focus
			aria-label="Fermer le panneau"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path
					d="M6 6l12 12M18 6L6 18"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</header>

	<div class="body">
		{#if open}
		{#if everythingFineGlobally}
			<p class="empty">Réseau nominal, aucune perturbation signalée.</p>
		{:else if hasFavorites}
			<section class="group">
				<h3>Mes lignes</h3>
				{#if everythingFineForMe}
					<p class="reassuring">Tes lignes vont bien. Perturbations ailleurs sur le réseau.</p>
				{:else if myCount === 0}
					<p class="empty">Rien à signaler.</p>
				{:else}
					{#each myCancels as c (c.routeId)}
						{@render cancelRow(c)}
					{/each}
					{#each myDelays as d (d.routeId)}
						{@render delayRow(d)}
					{/each}
					{#each myAlerts as a (a.id)}
						{@render alertRow(a)}
					{/each}
				{/if}
			</section>

			{#if restCount > 0}
				<section class="group separator">
					<h3>Reste du réseau</h3>
					{#each restCancels as c (c.routeId)}
						{@render cancelRow(c)}
					{/each}
					{#each restDelays as d (d.routeId)}
						{@render delayRow(d)}
					{/each}
					{#each restAlerts as a (a.id)}
						{@render alertRow(a)}
					{/each}
				</section>
			{/if}
		{:else}
			<section class="group">
				{#each restCancels as c (c.routeId)}
					{@render cancelRow(c)}
				{/each}
				{#each restDelays as d (d.routeId)}
					{@render delayRow(d)}
				{/each}
				{#each restAlerts as a (a.id)}
					{@render alertRow(a)}
				{/each}
			</section>
		{/if}

		{#if networkStore.error}
			<p class="error">Connexion à STAR perdue, on retente automatiquement.</p>
		{/if}
		{/if}
	</div>
</div>

{#snippet cancelRow(c: CancelledLine)}
	<article class="row">
		<LineChip code={c.routeShortName} size="sm" />
		<div class="text">
			<div class="title">
				<span class="label-strong">Trajets annulés</span>
				<span class="cancel-pill">annulée</span>
			</div>
			<div class="sub tick">{c.cancelledTrips} {c.cancelledTrips > 1 ? 'courses' : 'course'}</div>
		</div>
	</article>
{/snippet}

{#snippet delayRow(d: DelayedLine)}
	<article class="row">
		<LineChip code={d.routeShortName} size="sm" />
		<div class="text">
			<div class="title"><span class="label-strong">Retards importants</span></div>
			<div class="sub tick">
				{#if d.avgDelayMin != null}
					{Math.round(d.avgDelayMin)} min en moyenne · {d.affectedTrips} courses
				{:else}
					{d.affectedTrips} {d.affectedTrips > 1 ? 'courses' : 'course'} en cours
				{/if}
			</div>
		</div>
	</article>
{/snippet}

{#snippet alertRow(a: NetworkAlert)}
	<article class="row alert">
		<div class="chips">
			{#each codesFromAlert(a).slice(0, 3) as code (code)}
				<LineChip {code} size="sm" />
			{/each}
			{#if codesFromAlert(a).length > 3}
				<span class="more tick">+{codesFromAlert(a).length - 3}</span>
			{/if}
		</div>
		<div class="text">
			{#if alertHeadline(a)}
				<div class="title">
					<span class="label-strong">{alertHeadline(a)}</span>
				</div>
			{/if}
			<p class="alert-header">{a.header}</p>
			{#if a.description}
				<p class="alert-desc">{a.description}</p>
			{/if}
			{#if a.url}
				<a class="alert-link" href={a.url} target="_blank" rel="noopener noreferrer">
					Détails sur star.fr
				</a>
			{/if}
		</div>
	</article>
{/snippet}

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 999px;
		background: var(--surface-elev);
		backdrop-filter: blur(20px);
		box-shadow: 0 4px 16px -8px oklch(15% 0.02 32 / 0.18);
		color: var(--surface-fg);
		font-size: 13px;
		font-weight: 500;
		transition: transform 160ms var(--ease-out-quart);
	}
	.trigger:hover {
		transform: translateY(-1px);
	}
	.trigger.has-disruption {
		color: var(--color-alert-banner);
	}
	.trigger .label {
		display: none;
	}
	@media (min-width: 600px) {
		.trigger .label {
			display: inline;
		}
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--color-alert-banner);
		color: var(--color-cream);
		font-size: 11px;
		font-weight: 600;
	}

	.scrim {
		position: fixed;
		inset: 0;
		background: oklch(15% 0.02 32 / 0.32);
		z-index: 39;
		animation: fade-in-scrim 200ms var(--ease-out-quart);
	}
	@keyframes fade-in-scrim {
		from {
			opacity: 0;
		}
	}

	.drawer {
		position: fixed;
		inset: auto 0 0 0;
		max-height: 80vh;
		background: var(--surface-bg);
		border-top-left-radius: 22px;
		border-top-right-radius: 22px;
		box-shadow: 0 -8px 36px -10px oklch(15% 0.02 32 / 0.22);
		transform: translateY(100%);
		transition: transform 280ms var(--ease-out-quart);
		z-index: 40;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding-bottom: env(safe-area-inset-bottom, 0);
	}
	.drawer.open {
		transform: translateY(0);
	}
	.drawer[aria-hidden='true'] {
		pointer-events: none;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px 8px;
		border-bottom: 1px solid var(--surface-divider);
	}
	.head h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}
	.close {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		color: var(--surface-fg-soft);
	}
	.close:hover {
		background: var(--color-cream-deep);
		color: var(--surface-fg);
	}

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0 16px;
	}

	.empty {
		margin: 18px;
		font-size: 14px;
		color: var(--surface-fg-soft);
	}
	.reassuring {
		margin: 4px 18px 16px;
		font-size: 14px;
		color: var(--surface-fg);
	}
	.error {
		margin: 12px 18px 0;
		font-size: 12px;
		color: var(--color-alert-banner);
	}

	.group {
		padding: 6px 0;
	}
	.group h3 {
		margin: 6px 18px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--surface-fg-soft);
	}
	.group.separator {
		border-top: 1px solid var(--surface-divider);
		margin-top: 6px;
		padding-top: 10px;
	}

	.row {
		display: flex;
		gap: 12px;
		padding: 10px 18px;
		align-items: flex-start;
	}
	.row .text {
		min-width: 0;
		flex: 1;
	}
	.title {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.label-strong {
		font-size: 13px;
		font-weight: 600;
		color: var(--surface-fg);
	}
	.sub {
		font-size: 12px;
		color: var(--surface-fg-soft);
	}
	.cancel-pill {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 2px 6px;
		border-radius: 999px;
		background: var(--color-alert-banner);
		color: var(--color-cream);
	}
	.alert-header {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--surface-fg);
		line-height: 1.4;
	}
	.alert-desc {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--surface-fg-soft);
		line-height: 1.4;
		white-space: pre-line;
	}
	.alert-link {
		display: inline-block;
		margin-top: 6px;
		font-size: 12px;
		color: var(--color-star-red);
		text-decoration: underline;
	}
	.chips {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
		flex-wrap: wrap;
		max-width: 96px;
	}
	.more {
		font-size: 11px;
		color: var(--surface-fg-soft);
	}

	@media (min-width: 880px) {
		.drawer {
			inset: 16px 16px 16px auto;
			width: 380px;
			max-height: none;
			border-radius: 22px;
			transform: translateX(120%);
			transition: transform 320ms var(--ease-out-quart);
		}
		.drawer.open {
			transform: translateX(0);
		}
		.scrim {
			display: none;
		}
	}
</style>
