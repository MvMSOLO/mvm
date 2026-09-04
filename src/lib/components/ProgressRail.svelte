<script>
	import { CHAPTERS } from '$lib/data/product.js';

	/** @type {{ progress?: number, activeId?: string, onJump?: (id: string) => void }} */
	let { progress = 0, activeId = '', onJump } = $props();

	let activeIndex = $derived(
		activeId
			? Math.max(
					CHAPTERS.findIndex((c) => c.id === activeId),
					0
				)
			: Math.min(Math.floor(progress * CHAPTERS.length), CHAPTERS.length - 1)
	);
</script>

<nav class="rail" aria-label="Chapter navigation">
	<ol>
		{#each CHAPTERS as chapter, index (chapter.id)}
			<li>
				<button
					type="button"
					class="item"
					class:active={index === activeIndex}
					aria-current={index === activeIndex ? 'true' : undefined}
					onclick={() => onJump?.(chapter.id)}
				>
					<span class="line" aria-hidden="true"></span>
					<span class="label">{String(chapter.index).padStart(2, '0')} {chapter.rail}</span>
				</button>
			</li>
		{/each}
	</ol>

	<div class="meter" aria-hidden="true">
		<span class="meter-fill" style="transform: scaleY({progress});"></span>
	</div>
</nav>

<style>
	.rail {
		position: fixed;
		left: clamp(1rem, 2vw, 2rem);
		top: 50%;
		transform: translateY(-50%);
		z-index: 900;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.15rem 0;
		opacity: 0.28;
		transition: opacity 0.35s var(--ease);
	}

	.item:hover,
	.item:focus-visible {
		opacity: 0.8;
	}

	.item.active {
		opacity: 1;
	}

	.line {
		width: 10px;
		height: 1px;
		background: #fff;
		transition:
			width 0.35s var(--ease),
			background 0.35s var(--ease),
			box-shadow 0.35s var(--ease);
	}

	.item.active .line {
		width: 24px;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
	}

	.label {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		white-space: nowrap;
	}

	.meter {
		width: 1px;
		height: 160px;
		background: rgba(255, 255, 255, 0.12);
	}

	.meter-fill {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--accent);
		transform-origin: top;
		box-shadow: 0 0 8px var(--accent);
	}

	@media (max-width: 1100px) {
		.rail {
			display: none;
		}
	}
</style>
