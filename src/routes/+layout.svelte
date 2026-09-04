<script>
	// Self-hosted, latin-only font subsets. Importing them here means Vite
	// fingerprints and preloads the woff2 files with the rest of the bundle
	// instead of hitting a third-party CDN mid-render.
	import '@fontsource-variable/inter/wght.css';
	import '@fontsource/syne/latin-700.css';
	import '@fontsource/syne/latin-800.css';
	import '@fontsource/space-grotesk/latin-400.css';
	import '@fontsource/space-grotesk/latin-500.css';
	import '$lib/styles/app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
