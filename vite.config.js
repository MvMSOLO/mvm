import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
// vitest's defineConfig is a superset of vite's, so the `test` block typechecks.
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// The site is fully static, so prerender everything to plain HTML.
			adapter: adapter({ fallback: '404.html' })
		})
	],

	build: {
		// three.js is large; keep the warning threshold realistic.
		chunkSizeWarningLimit: 900
	},

	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		restoreMocks: true
	}
});
