<script>
	import { tr } from '$lib/i18n/store.js';

	/**
	 * @typedef {object} Props
	 * @property {() => Promise<{ launched: boolean, mode: string | null }> | undefined} [launch]
	 *   Engine hand-off. Absent until the 3D scene is ready.
	 * @property {string | null} [mode] Detected AR mode, null when unsupported.
	 */

	/** @type {Props} */
	let { launch = undefined, mode = null } = $props();

	let busy = $state(false);
	let message = $state('');

	async function onClick() {
		if (!launch || busy) return;
		busy = true;
		message = '';
		try {
			const result = await launch();
			if (!result?.launched) message = $tr('ar.unsupported');
		} catch {
			message = $tr('ar.unsupported');
		} finally {
			busy = false;
		}
	}
</script>

{#if mode}
	<div class="ar">
		<button type="button" onclick={onClick} disabled={busy} aria-busy={busy}>
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path
					d="M12 2.6 21 7.4v9.2L12 21.4 3 16.6V7.4Zm0 2.3L5.4 8.4 12 12l6.6-3.6ZM5 10.2v5.2l6 3.2v-5.2Zm14 0-6 3.2v5.2l6-3.2Z"
					fill="currentColor"
				/>
			</svg>
			<span>{busy ? $tr('ar.preparing') : $tr('ar.view')}</span>
		</button>
		{#if message}
			<p role="status">{message}</p>
		{/if}
	</div>
{/if}

<style>
	.ar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1.4rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--accent, #00f0ff) 45%, transparent);
		background: color-mix(in srgb, var(--accent, #00f0ff) 12%, transparent);
		color: #fff;
		font: inherit;
		font-size: 0.82rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 220ms ease,
			transform 220ms ease;
	}

	button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent, #00f0ff) 22%, transparent);
		transform: translateY(-1px);
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	button:focus-visible {
		outline: 2px solid var(--accent, #00f0ff);
		outline-offset: 3px;
	}

	svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	p {
		margin: 0;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.62);
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
