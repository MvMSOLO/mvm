import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

/** Flat config: plain JS rules + Svelte 5 component linting. */
export default [
	{
		ignores: [
			'build/**',
			'.svelte-kit/**',
			'node_modules/**',
			'static/**',
			'e2e-results/**',
			'playwright-report/**'
		]
	},
	js.configs.recommended,
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			eqeqeq: ['error', 'smart'],
			'prefer-const': 'error',
			'no-var': 'error'
		}
	},
	...svelte.configs.recommended,
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			globals: { ...globals.browser }
		},
		rules: {
			// Svelte 5 runes mode: `$state` and friends are compiler macros.
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.test.js', 'e2e/**/*.js'],
		languageOptions: {
			globals: { ...globals.node }
		},
		rules: {
			'no-console': 'off'
		}
	}
];
