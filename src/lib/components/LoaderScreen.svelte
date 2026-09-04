<script>
	import { LAYERS } from '$lib/data/product.js';

	/** @type {{ progress?: number, failed?: boolean }} */
	let { progress = 0, failed = false } = $props();

	// Reveal each checklist row as the load crosses its share of the bar.
	let steps = $derived(
		LAYERS.map((layer, index) => ({
			name: layer.name,
			done: progress >= ((index + 1) / LAYERS.length) * 96
		}))
	);
</script>

<div class="loader" data-loader role="status" aria-live="polite">
	<div class="content">
		<h1>NOVA</h1>
		<p class="sub mono">{failed ? 'RUNNING IN FALLBACK MODE' : 'BUILDING EXPERIENCE'}</p>

		<ul class="checklist">
			{#each steps as step (step.name)}
				<li class:done={step.done}>
					<span>{step.name}</span>
					<span class="tick" aria-hidden="true">{step.done ? '✓' : '·'}</span>
				</li>
			{/each}
		</ul>

		<div
			class="bar"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={progress}
			aria-label="Loading 3D experience"
		>
			<span style="width: {progress}%"></span>
		</div>
		<p class="num mono">{progress}%</p>
	</div>
</div>

<style>
	.loader {
		position: fixed;
		inset: 0;
		z-index: 10000;
		background: var(--bg);
		display: grid;
		place-items: center;
		padding: var(--gutter);
	}

	.content {
		text-align: center;
		width: min(100%, 460px);
	}

	h1 {
		font-size: clamp(2.4rem, 9vw, 3.6rem);
		letter-spacing: 0.5em;
		margin: 0 0 0.4rem;
		text-indent: 0.5em;
	}

	.sub {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		margin-bottom: 2rem;
	}

	.checklist {
		list-style: none;
		margin: 0 0 2rem;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		color: var(--fg-faint);
		text-align: left;
	}

	.checklist li {
		display: flex;
		justify-content: space-between;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--line);
		transition: color 0.4s var(--ease);
	}

	.checklist li.done {
		color: var(--fg);
	}

	.tick {
		color: var(--accent);
	}

	.bar {
		height: 2px;
		width: 100%;
		background: rgba(255, 255, 255, 0.1);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		box-shadow: 0 0 12px var(--accent);
		transition: width 0.3s var(--ease);
	}

	.num {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--fg-dim);
		margin-top: 0.9rem;
	}
</style>
