<script>
	import { GALLERY } from '$lib/data/product.js';
	import { reveal } from '$lib/actions/reveal.js';
	import { carouselNav } from '$lib/actions/carouselNav.js';

	let index = $state(0);

	/** @param {number} step */
	function move(step) {
		index = (index + step + GALLERY.length) % GALLERY.length;
	}

	let current = $derived(GALLERY[index]);
</script>

<section id="gallery" class="gallery" aria-labelledby="gallery-title">
	<!-- Arrow keys and swipes are wired up by the carouselNav action; the
	     buttons below remain the primary, fully accessible controls. -->
	<div
		class="shell"
		role="group"
		aria-roledescription="carousel"
		aria-label="Product detail gallery"
		use:reveal
		use:carouselNav={{ next: () => move(1), prev: () => move(-1) }}
	>
		<div class="head">
			<span class="badge">10 — DETAIL</span>
			<span class="counter mono">
				{String(index + 1).padStart(2, '0')} / {String(GALLERY.length).padStart(2, '0')}
			</span>
		</div>

		<h2 id="gallery-title" class="sr-only">Product detail gallery</h2>

		<div class="stage" aria-live="polite">
			{#key index}
				<article class="card">
					<span class="meta mono">{current.meta}</span>
					<h3>{current.title}</h3>
					<p>{current.desc}</p>
				</article>
			{/key}
		</div>

		<div class="controls">
			<div class="arrows">
				<button type="button" onclick={() => move(-1)} aria-label="Previous detail">← PREV</button>
				<button type="button" onclick={() => move(1)} aria-label="Next detail">NEXT →</button>
			</div>
			<div class="dots" role="tablist" aria-label="Gallery slides">
				{#each GALLERY as item, i (item.title)}
					<button
						type="button"
						role="tab"
						class="dot"
						class:active={i === index}
						aria-selected={i === index}
						aria-label={item.title}
						onclick={() => (index = i)}
					></button>
				{/each}
			</div>
		</div>
	</div>
</section>

<style>
	.gallery {
		position: relative;
		z-index: 5;
		padding: clamp(4rem, 10vh, 7rem) var(--gutter);
		background: var(--bg);
		border-top: 1px solid var(--line);
	}

	.shell {
		max-width: var(--shell);
		margin: 0 auto;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.counter {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--fg-faint);
	}

	.stage {
		margin: 2.5rem 0;
		min-height: 190px;
		display: flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 60%);
		padding: clamp(1.6rem, 4vw, 3rem);
	}

	.card {
		animation: fade 0.6s var(--ease);
		max-width: 620px;
	}

	.meta {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--accent);
	}

	h3 {
		font-size: clamp(1.5rem, 4.5vw, 2.4rem);
		margin: 0.7rem 0 0.9rem;
	}

	p {
		color: var(--fg-dim);
		font-size: 0.95rem;
		line-height: 1.65;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.arrows {
		display: flex;
		gap: 0.5rem;
	}

	.arrows button {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		padding: 0.7rem 1.2rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--fg-dim);
		transition:
			color 0.3s var(--ease),
			border-color 0.3s var(--ease);
	}

	.arrows button:hover {
		color: var(--fg);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.dots {
		display: flex;
		gap: 0.5rem;
	}

	.dot {
		width: 22px;
		height: 2px;
		background: rgba(255, 255, 255, 0.18);
		transition: background 0.3s var(--ease);
	}

	.dot.active {
		background: var(--accent);
	}

	@keyframes fade {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
