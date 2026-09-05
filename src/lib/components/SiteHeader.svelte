<script>
	import { CHAPTERS } from '$lib/data/product.js';
	import LocaleSwitcher from './LocaleSwitcher.svelte';
	import { tr } from '$lib/i18n/store.js';

	/** @type {{ activeId?: string, onJump?: (id: string) => void }} */
	let { activeId = '', onJump } = $props();

	let open = $state(false);
	let scrolled = $state(false);

	const primary = ['form', 'display', 'optics', 'architecture', 'compute'];
	const links = CHAPTERS.filter((c) => primary.includes(c.id));

	/** @param {string} id */
	function go(id) {
		open = false;
		onJump?.(id);
	}

	$effect(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 40;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	// Lock body scroll while the mobile drawer is open.
	$effect(() => {
		document.body.classList.toggle('is-locked', open);
		return () => document.body.classList.remove('is-locked');
	});

	$effect(() => {
		if (!open) return;
		/** @param {KeyboardEvent} event */
		const onKey = (event) => {
			if (event.key === 'Escape') open = false;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<header class="header" class:scrolled>
	<div class="inner">
		<a class="brand" href="#main" onclick={() => go('form')}>NOVA</a>

		<nav class="desktop" aria-label="Primary">
			{#each links as link (link.id)}
				<button
					type="button"
					class="nav-link"
					class:active={activeId === link.id}
					onclick={() => go(link.id)}
				>
					{link.rail}
				</button>
			{/each}
			<LocaleSwitcher />
			<a class="cta" href="#configurator">{$tr('cta.preorder')}</a>
		</nav>

		<button
			type="button"
			class="burger"
			aria-expanded={open}
			aria-controls="mobile-drawer"
			aria-label={open ? 'Close menu' : 'Open menu'}
			onclick={() => (open = !open)}
		>
			<span class:x={open}></span>
			<span class:x={open}></span>
		</button>
	</div>
</header>

{#if open}
	<div id="mobile-drawer" class="drawer">
		<nav aria-label="Mobile">
			{#each CHAPTERS as chapter (chapter.id)}
				<button type="button" onclick={() => go(chapter.id)}>
					<span class="num">{String(chapter.index).padStart(2, '0')}</span>
					{chapter.rail}
				</button>
			{/each}
			<a class="drawer-cta" href="#configurator" onclick={() => (open = false)}>PRE-ORDER</a>
		</nav>
	</div>
{/if}

<style>
	.header {
		position: fixed;
		inset: 0 0 auto 0;
		z-index: 1000;
		padding: 1.1rem var(--gutter);
		transition:
			background 0.4s var(--ease),
			backdrop-filter 0.4s var(--ease),
			border-color 0.4s var(--ease);
		border-bottom: 1px solid transparent;
	}

	.header.scrolled {
		background: rgba(5, 6, 9, 0.62);
		backdrop-filter: blur(14px);
		border-bottom-color: var(--line);
	}

	.inner {
		max-width: var(--shell);
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.brand {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: 0.32em;
	}

	.desktop {
		display: flex;
		align-items: center;
		gap: 1.75rem;
	}

	.nav-link {
		position: relative;
		font-family: var(--font-mono);
		font-size: 0.63rem;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
		padding: 0.35rem 0;
		transition: color 0.3s var(--ease);
	}

	.nav-link::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 1px;
		background: var(--accent);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.35s var(--ease);
	}

	.nav-link:hover,
	.nav-link.active {
		color: var(--fg);
	}

	.nav-link:hover::after,
	.nav-link.active::after {
		transform: scaleX(1);
	}

	.cta {
		font-family: var(--font-mono);
		font-size: 0.63rem;
		letter-spacing: 0.2em;
		padding: 0.6rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		transition:
			background 0.3s var(--ease),
			color 0.3s var(--ease),
			border-color 0.3s var(--ease);
	}

	.cta:hover {
		background: var(--fg);
		border-color: var(--fg);
		color: #000;
	}

	.burger {
		display: none;
		flex-direction: column;
		gap: 5px;
		width: 30px;
		padding: 6px 0;
	}

	.burger span {
		display: block;
		height: 1px;
		width: 100%;
		background: var(--fg);
		transition: transform 0.3s var(--ease);
	}

	.burger span.x:first-child {
		transform: translateY(3px) rotate(45deg);
	}

	.burger span.x:last-child {
		transform: translateY(-3px) rotate(-45deg);
	}

	.drawer {
		position: fixed;
		inset: 0;
		z-index: 999;
		background: rgba(5, 6, 9, 0.97);
		backdrop-filter: blur(20px);
		display: flex;
		align-items: center;
		padding: 0 var(--gutter);
	}

	.drawer nav {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		width: 100%;
	}

	.drawer nav button {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 7vw, 2.1rem);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: left;
	}

	.num {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		color: var(--accent);
	}

	.drawer-cta {
		margin-top: 1rem;
		align-self: flex-start;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		padding: 0.9rem 1.6rem;
		background: var(--fg);
		color: #000;
		border-radius: var(--radius);
	}

	@media (max-width: 900px) {
		.desktop {
			display: none;
		}

		.burger {
			display: flex;
		}
	}
</style>
