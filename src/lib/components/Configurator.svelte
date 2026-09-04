<script>
	import { MODELS, FINISHES, STORAGE } from '$lib/data/product.js';
	import { reveal } from '$lib/actions/reveal.js';

	/** @type {{ onFinishChange?: (hex: number) => void }} */
	let { onFinishChange } = $props();

	let model = $state(MODELS[0].id);
	let finish = $state(FINISHES[0].id);
	let storage = $state(STORAGE[1].id);
	let submitted = $state(false);

	let total = $derived(
		(MODELS.find((m) => m.id === model)?.price ?? 0) +
			(FINISHES.find((f) => f.id === finish)?.price ?? 0) +
			(STORAGE.find((s) => s.id === storage)?.price ?? 0)
	);

	let priceLabel = $derived(
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(total)
	);

	/** @param {string} id */
	function pickFinish(id) {
		finish = id;
		const hex = FINISHES.find((f) => f.id === id)?.hex;
		if (hex !== undefined) onFinishChange?.(hex);
	}

	function submit() {
		submitted = true;
		setTimeout(() => (submitted = false), 2600);
	}
</script>

<section id="configurator" class="config" aria-labelledby="config-title">
	<div class="shell" use:reveal>
		<span class="badge">09 — CONFIGURATOR</span>
		<h2 id="config-title">BUILD YOURS.</h2>

		<div class="grid">
			<fieldset>
				<legend class="mono">Model</legend>
				<div class="row">
					{#each MODELS as option (option.id)}
						<button
							type="button"
							class="chip"
							class:active={model === option.id}
							aria-pressed={model === option.id}
							onclick={() => (model = option.id)}
						>
							{option.id}
						</button>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend class="mono">Finish</legend>
				<div class="row">
					{#each FINISHES as option (option.id)}
						<button
							type="button"
							class="chip swatch-chip"
							class:active={finish === option.id}
							aria-pressed={finish === option.id}
							onclick={() => pickFinish(option.id)}
						>
							<span class="swatch" style="background: {option.css}" aria-hidden="true"></span>
							{option.id}
						</button>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend class="mono">Storage</legend>
				<div class="row">
					{#each STORAGE as option (option.id)}
						<button
							type="button"
							class="chip"
							class:active={storage === option.id}
							aria-pressed={storage === option.id}
							onclick={() => (storage = option.id)}
						>
							{option.id}
						</button>
					{/each}
				</div>
			</fieldset>
		</div>

		<div class="summary">
			<div>
				<p class="spec mono">{model} · {finish} · {storage}</p>
				<p class="price">{priceLabel}</p>
			</div>
			<button type="button" class="order" class:done={submitted} onclick={submit}>
				{submitted ? 'RESERVED ✓' : 'PRE-ORDER NOW'}
			</button>
		</div>

		<p class="note" aria-live="polite">
			{submitted
				? 'Reservation held locally — this is a concept demo, no payment is taken.'
				: 'Ships Q2. Free returns within 30 days.'}
		</p>
	</div>
</section>

<style>
	.config {
		position: relative;
		z-index: 5;
		padding: clamp(5rem, 12vh, 9rem) var(--gutter);
		background: linear-gradient(180deg, rgba(5, 6, 9, 0.4), var(--bg) 22%);
	}

	.shell {
		max-width: 1000px;
		margin: 0 auto;
	}

	h2 {
		font-size: clamp(2rem, 6vw, 3.4rem);
		letter-spacing: -0.01em;
		margin: 0.8rem 0 3rem;
	}

	.grid {
		display: grid;
		gap: 2.2rem;
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}

	legend {
		font-size: 0.6rem;
		color: var(--fg-faint);
		margin-bottom: 0.9rem;
		padding: 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		padding: 0.75rem 1.15rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--fg-dim);
		transition:
			color 0.3s var(--ease),
			border-color 0.3s var(--ease),
			background 0.3s var(--ease);
	}

	.chip:hover {
		color: var(--fg);
		border-color: rgba(255, 255, 255, 0.28);
	}

	.chip.active {
		color: #000;
		background: var(--fg);
		border-color: var(--fg);
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.35);
	}

	.summary {
		margin-top: 3rem;
		padding-top: 1.6rem;
		border-top: 1px solid var(--line);
		display: flex;
		flex-wrap: wrap;
		gap: 1.4rem;
		align-items: flex-end;
		justify-content: space-between;
	}

	.spec {
		font-size: 0.66rem;
		color: var(--fg-faint);
	}

	.price {
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 5vw, 2.6rem);
		font-weight: 700;
		margin-top: 0.35rem;
	}

	.order {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		padding: 1rem 2.2rem;
		background: var(--fg);
		color: #000;
		border-radius: var(--radius);
		transition:
			background 0.3s var(--ease),
			transform 0.3s var(--ease);
	}

	.order:hover {
		transform: translateY(-2px);
	}

	.order.done {
		background: var(--accent);
	}

	.note {
		margin-top: 1.2rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--fg-faint);
	}

	@media (min-width: 760px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 2rem;
		}
	}
</style>
