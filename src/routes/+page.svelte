<script>
	import { onMount } from 'svelte';
	import { PhoneSceneEngine } from '$lib/3d/phoneEngine.js';
	import { ScrollController } from '$lib/3d/ScrollController.js';
	import { CHAPTERS, LAYERS, SPECS, chapterAt } from '$lib/data/product.js';
	import { reveal } from '$lib/actions/reveal.js';
	import ProgressRail from '$lib/components/ProgressRail.svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import LoaderScreen from '$lib/components/LoaderScreen.svelte';
	import Configurator from '$lib/components/Configurator.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import Hotspots from '$lib/components/Hotspots.svelte';

	/** @type {HTMLElement | undefined} */
	let canvasContainer;
	/** @type {HTMLElement | undefined} */
	let cinematicRegion;

	/** @type {PhoneSceneEngine | null} */
	let engine = null;
	/** @type {ScrollController | null} */
	let scroller = null;

	let progress = $state(0);
	let loading = $state(true);
	let loadPercent = $state(0);
	let loadFailed = $state(false);
	let webglSupported = $state(true);
	/** @type {{key:string,num:string,name:string,x:number,y:number,visible:boolean}[]} */
	let hotspots = $state([]);

	let activeChapter = $derived(chapterAt(progress));
	let showHotspots = $derived(
		activeChapter.id === 'architecture' || activeChapter.id === 'compute'
	);

	/** Cheap WebGL capability probe so we can degrade instead of crashing. */
	function detectWebGL() {
		try {
			const canvas = document.createElement('canvas');
			return Boolean(
				window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))
			);
		} catch {
			return false;
		}
	}

	/** @param {string} id */
	function jumpTo(id) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/** @param {number} hex */
	function applyFinish(hex) {
		engine?.setMaterialFinish(hex);
	}

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		webglSupported = detectWebGL();

		if (!webglSupported) {
			loading = false;
			loadFailed = true;
			return;
		}

		scroller = new ScrollController({ target: cinematicRegion, reducedMotion });

		engine = new PhoneSceneEngine(/** @type {HTMLElement} */ (canvasContainer), {
			reducedMotion,
			onProgress: (value) => {
				loadPercent = Math.round(value * 100);
				if (loadPercent >= 100) setTimeout(() => (loading = false), 350);
			},
			onHotspots: (items) => {
				hotspots = items;
			},
			onError: () => {
				loadFailed = true;
			}
		});

		// Hard ceiling: never trap the user behind the loader.
		const bailout = setTimeout(() => {
			loadPercent = 100;
			loading = false;
		}, 6000);

		let frame = 0;
		const loop = () => {
			frame = requestAnimationFrame(loop);
			if (!scroller || !engine) return;
			progress = scroller.update();
			engine.updateProgress(progress);
		};
		frame = requestAnimationFrame(loop);

		return () => {
			clearTimeout(bailout);
			cancelAnimationFrame(frame);
			scroller?.destroy();
			engine?.destroy();
			scroller = null;
			engine = null;
		};
	});
</script>

<svelte:head>
	<title>NOVA ONE — The Next Form</title>
	<meta
		name="description"
		content="NOVA ONE: a titanium flagship with a 120Hz adaptive OLED panel, a five-lens optical system and a 4nm on-device neural engine. Explore it in real-time 3D."
	/>
	<meta name="theme-color" content="#050609" />
	<link rel="preload" href="/models/nova_one.glb" as="fetch" crossorigin="anonymous" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="NOVA ONE" />
	<meta property="og:title" content="NOVA ONE — The Next Form" />
	<meta
		property="og:description"
		content="A cinematic 3D product experience for the NOVA ONE flagship."
	/>
	<!-- No social preview artwork ships with the demo, so keep the compact card. -->
	<meta name="twitter:card" content="summary" />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

{#if loading}
	<LoaderScreen progress={loadPercent} failed={loadFailed} />
{/if}

<!-- Fixed WebGL viewport. Decorative: all content also exists in the DOM. -->
<div class="canvas-viewport" bind:this={canvasContainer} aria-hidden="true"></div>
<Hotspots items={hotspots} show={showHotspots} />

<SiteHeader activeId={activeChapter.id} onJump={jumpTo} />
<ProgressRail {progress} activeId={activeChapter.id} onJump={jumpTo} />

<main id="main">
	<div class="cinematic" data-cinematic bind:this={cinematicRegion}>
		{#each CHAPTERS as chapter, index (chapter.id)}
			<section
				id={chapter.id}
				class="chapter"
				class:hero={index === 0}
				class:right={index % 2 === 1}
				aria-labelledby="{chapter.id}-title"
			>
				<div class="card" use:reveal={{ threshold: 0.3 }}>
					<span class="badge">{chapter.badge}</span>

					{#if index === 0}
						<h1 id="{chapter.id}-title" class="display">THE NEXT<br />FORM.</h1>
					{:else}
						<h2 id="{chapter.id}-title">{chapter.title}</h2>
					{/if}

					<p class="body">{chapter.body}</p>

					{#if chapter.callout}
						<div class="callout">
							<span class="callout-value">{chapter.callout.value}</span>
							<span class="callout-label mono">{chapter.callout.label}</span>
						</div>
					{/if}

					{#if chapter.stats}
						<dl class="stats">
							{#each chapter.stats as stat (stat.label)}
								<div>
									<dt class="mono">{stat.label}</dt>
									<dd>{stat.value}</dd>
								</div>
							{/each}
						</dl>
					{/if}

					{#if chapter.id === 'architecture'}
						<ol class="layer-list">
							{#each LAYERS as layer (layer.key)}
								<li><span class="mono">{layer.num}</span> {layer.name}</li>
							{/each}
						</ol>
					{/if}
				</div>

				{#if index === 0}
					<div class="hero-meta">
						<span class="mono">01 / 0{CHAPTERS.length}</span>
						<span class="mono">SCROLL TO EXPLORE</span>
						<span class="scroll-line" aria-hidden="true"></span>
					</div>
				{/if}
			</section>
		{/each}
	</div>

	{#if !webglSupported}
		<p class="fallback-note">
			Your browser doesn't support WebGL, so the 3D experience is disabled. All product information
			is still available below.
		</p>
	{/if}

	<Configurator onFinishChange={applyFinish} />
	<Gallery />

	<section id="specs" class="specs" aria-labelledby="specs-title">
		<div class="specs-shell" use:reveal>
			<h2 id="specs-title" class="sr-only">Technical specifications</h2>
			<dl class="specs-grid">
				{#each SPECS as spec (spec.label)}
					<div>
						<dd>{spec.value}</dd>
						<dt class="mono">{spec.label}</dt>
					</div>
				{/each}
			</dl>
		</div>
	</section>

	<footer class="footer">
		<div class="footer-shell">
			<span>© {new Date().getFullYear()} NOVA TECHNOLOGIES — CONCEPT DEMO</span>
			<span>BUILT WITH SVELTEKIT &amp; THREE.JS</span>
		</div>
	</footer>
</main>

<style>
	.canvas-viewport {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}

	main {
		position: relative;
		z-index: 2;
	}

	/* Each chapter is a full viewport so scroll maps evenly onto the scenes. */
	.chapter {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 8rem var(--gutter) 5rem;
		pointer-events: none;
	}

	.chapter.right {
		align-items: flex-end;
		text-align: right;
	}

	.card {
		max-width: 460px;
		pointer-events: auto;
	}

	.chapter.hero .card {
		max-width: none;
	}

	.display {
		font-size: clamp(3rem, 13vw, 9rem);
		line-height: 0.88;
		letter-spacing: -0.03em;
		margin: 0.8rem 0 0;
	}

	h2 {
		font-size: clamp(1.7rem, 5vw, 3rem);
		line-height: 1.05;
		letter-spacing: -0.015em;
		margin: 0.9rem 0 1.1rem;
	}

	.body {
		color: var(--fg-dim);
		font-size: clamp(0.9rem, 1.1vw, 1rem);
		line-height: 1.7;
		max-width: 42ch;
	}

	.chapter.right .body {
		margin-left: auto;
	}

	.hero-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 3rem;
		font-size: 0.6rem;
		color: var(--fg-faint);
	}

	.scroll-line {
		display: block;
		width: 60px;
		height: 1px;
		background: linear-gradient(90deg, var(--accent), transparent);
		animation: slide 2.4s var(--ease) infinite;
	}

	.callout {
		margin-top: 2rem;
		padding-top: 1.2rem;
		border-top: 1px solid var(--line);
	}

	.callout-value {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
	}

	.callout-label {
		font-size: 0.6rem;
		color: var(--fg-faint);
	}

	.stats {
		margin: 2rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.chapter.right .stats {
		justify-content: flex-end;
	}

	.stats dt {
		font-size: 0.55rem;
		color: var(--fg-faint);
		margin-bottom: 0.3rem;
	}

	.stats dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
	}

	.layer-list {
		list-style: none;
		margin: 2rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		color: var(--fg-dim);
	}

	.layer-list li {
		padding-bottom: 0.45rem;
		border-bottom: 1px solid var(--line);
	}

	.layer-list span {
		color: var(--accent);
		margin-right: 0.6rem;
		font-size: 0.55rem;
	}

	.fallback-note {
		position: relative;
		z-index: 5;
		max-width: 52ch;
		margin: 0 auto 4rem;
		padding: 1.2rem var(--gutter);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		line-height: 1.8;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
		text-align: center;
	}

	.specs {
		position: relative;
		z-index: 5;
		background: var(--bg);
		border-top: 1px solid var(--line);
		padding: clamp(4rem, 10vh, 7rem) var(--gutter);
	}

	.specs-shell {
		max-width: var(--shell);
		margin: 0 auto;
	}

	.specs-grid {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 2.5rem;
		text-align: center;
	}

	.specs-grid dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4.5vw, 3.2rem);
		font-weight: 700;
	}

	.specs-grid dt {
		margin-top: 0.5rem;
		font-size: 0.6rem;
		color: var(--fg-faint);
	}

	.footer {
		position: relative;
		z-index: 5;
		background: var(--bg);
		border-top: 1px solid var(--line);
		padding: 3rem var(--gutter);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		color: var(--fg-faint);
	}

	.footer-shell {
		max-width: var(--shell);
		margin: 0 auto;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: space-between;
	}

	@keyframes slide {
		0%,
		100% {
			opacity: 0.3;
			transform: translateX(0);
		}
		50% {
			opacity: 1;
			transform: translateX(10px);
		}
	}

	@media (max-width: 900px) {
		.chapter.right {
			align-items: flex-start;
			text-align: left;
		}

		.chapter.right .body {
			margin-left: 0;
		}

		.chapter.right .stats {
			justify-content: flex-start;
		}
	}
</style>
