<script>
	import { CHAPTERS } from '$lib/data/product.js';
	import { createJourneyRoute, markerAt, activeNodeIndex } from '$lib/journey.js';

	/** @type {{ progress?: number, onJump?: (id: string) => void }} */
	let { progress = 0, onJump } = $props();

	const geometry = { width: 240, height: 68, padding: 16, amplitude: 0.62 };
	const route = createJourneyRoute({
		items: CHAPTERS.map((c) => ({ id: c.id, label: c.rail })),
		...geometry
	});

	let marker = $derived(markerAt(geometry, progress));
	let activeIndex = $derived(activeNodeIndex(route.nodes, progress));
	let activeNode = $derived(route.nodes[activeIndex]);
	let percent = $derived(Math.round(Math.min(Math.max(progress, 0), 1) * 100));
</script>

<div class="journey" aria-hidden="false">
	<div class="head">
		<span class="mono">JOURNEY</span>
		<span class="mono pct">{percent}%</span>
	</div>

	<svg
		viewBox={`0 0 ${route.width} ${route.height}`}
		role="img"
		aria-label={`Journey progress ${percent} percent, at ${activeNode?.label ?? ''}`}
	>
		<path class="track" d={route.path} />
		<!-- pathLength="1" normalises the dash maths, so the trail length matches
		     scroll progress exactly instead of depending on the path's user units. -->
		<path
			class="trail"
			d={route.path}
			pathLength="1"
			stroke-dasharray="1"
			stroke-dashoffset={1 - Math.min(Math.max(progress, 0), 1)}
		/>

		{#each route.nodes as node, index (node.id)}
			<g class="node" class:done={index < activeIndex} class:active={index === activeIndex}>
				<circle cx={node.x} cy={node.y} r="3.2" />
			</g>
		{/each}

		<g class="marker" style={`transform: translate(${marker.x}px, ${marker.y}px);`}>
			<circle class="halo" r="7" />
			<rect class="chip" x="-2.6" y="-4.6" width="5.2" height="9.2" rx="1.6" />
		</g>
	</svg>

	<ol class="stops">
		{#each route.nodes as node, index (node.id)}
			<li>
				<button
					type="button"
					class:active={index === activeIndex}
					onclick={() => onJump?.(node.id)}
					aria-current={index === activeIndex ? 'true' : undefined}
				>
					<span class="sr">{node.label}</span>
				</button>
			</li>
		{/each}
	</ol>

	<p class="now mono">{String(activeIndex + 1).padStart(2, '0')} · {activeNode?.label ?? ''}</p>
</div>

<style>
	.journey {
		position: fixed;
		right: clamp(1rem, 2vw, 2rem);
		bottom: clamp(1rem, 2vw, 1.8rem);
		z-index: 900;
		width: 260px;
		padding: 0.7rem 0.8rem 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		background: rgba(8, 10, 14, 0.55);
		backdrop-filter: blur(14px);
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.55rem;
		letter-spacing: 0.2em;
		opacity: 0.55;
	}

	.pct {
		color: var(--accent);
		opacity: 1;
	}

	.mono {
		font-family: var(--font-mono);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.track {
		fill: none;
		stroke: rgba(255, 255, 255, 0.16);
		stroke-width: 1.2;
		stroke-linecap: round;
	}

	.trail {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.6;
		stroke-linecap: round;
		filter: drop-shadow(0 0 4px var(--accent));
		transition: stroke-dashoffset 0.18s linear;
	}

	.node circle {
		fill: rgba(10, 12, 16, 0.9);
		stroke: rgba(255, 255, 255, 0.3);
		stroke-width: 1;
		transition:
			fill 0.3s var(--ease),
			stroke 0.3s var(--ease);
	}

	.node.done circle {
		fill: var(--accent);
		stroke: var(--accent);
	}

	.node.active circle {
		fill: #fff;
		stroke: var(--accent);
		stroke-width: 2;
	}

	.marker {
		transition: transform 0.16s linear;
	}

	.marker .halo {
		fill: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.marker .chip {
		fill: #fff;
		stroke: var(--accent);
		stroke-width: 0.8;
	}

	.stops {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		display: flex;
		gap: 0.3rem;
	}

	.stops button {
		width: 100%;
		height: 12px;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.stops button::before {
		content: '';
		display: block;
		height: 2px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.18);
		transition: background 0.3s var(--ease);
	}

	.stops button:hover::before,
	.stops button:focus-visible::before,
	.stops button.active::before {
		background: var(--accent);
	}

	.now {
		margin: 0.15rem 0 0;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		opacity: 0.7;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		.journey {
			width: 190px;
			padding: 0.5rem 0.6rem;
		}

		.stops,
		.now {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marker,
		.trail {
			transition: none;
		}
	}
</style>
