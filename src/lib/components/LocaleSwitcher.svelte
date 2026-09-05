<script>
	import { LOCALES } from '$lib/i18n/index.js';
	import { locale, setLocale, tr } from '$lib/i18n/store.js';
</script>

<div class="locales" role="group" aria-label={$tr('lang.label')}>
	{#each LOCALES as option (option.code)}
		<button
			type="button"
			class:active={$locale === option.code}
			aria-pressed={$locale === option.code}
			lang={option.code}
			title={option.label}
			onclick={() => setLocale(option.code)}
		>
			{option.code.toUpperCase()}
		</button>
	{/each}
</div>

<style>
	.locales {
		display: inline-flex;
		gap: 0.15rem;
		padding: 0.15rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
	}

	button {
		padding: 0.3rem 0.6rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: rgba(255, 255, 255, 0.6);
		font: inherit;
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		cursor: pointer;
	}

	button.active {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	button:focus-visible {
		outline: 2px solid var(--accent, #00f0ff);
		outline-offset: 2px;
	}
</style>
