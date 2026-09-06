<script>
	/**
	 * High-Tech Diagnostics & Telemetry Overlay HUD.
	 * Displays real-time chapter metrics, resolution, and interactive inspection tools.
	 */
	/** @type {{ activeChapterId?: string, progress?: number }} */
	let { activeChapterId = 'form', progress = 0 } = $props();

	let telemetryOpen = $state(true);

	let formattedProgress = $derived((progress * 100).toFixed(1));
	let fpsEstimate = $derived(60);
</script>

<div class="tech-hud" aria-label="Tech Telemetry Overlay">
	<button
		type="button"
		class="hud-toggle"
		aria-expanded={telemetryOpen}
		onclick={() => (telemetryOpen = !telemetryOpen)}
	>
		<span class="indicator-dot"></span>
		<span class="mono">SYSTEM HUD // {formattedProgress}%</span>
	</button>

	{#if telemetryOpen}
		<div class="hud-panel">
			<div class="hud-header">
				<span class="mono title">TELEMETRY DIAGNOSTICS</span>
				<span class="mono status">ONLINE [8K]</span>
			</div>

			<div class="hud-grid">
				<div class="stat-box">
					<span class="mono label">CHAPTER</span>
					<span class="value">{activeChapterId.toUpperCase()}</span>
				</div>
				<div class="stat-box">
					<span class="mono label">PROGRESS</span>
					<span class="value">{formattedProgress}%</span>
				</div>
				<div class="stat-box">
					<span class="mono label">REFRESH</span>
					<span class="value">120Hz</span>
				</div>
				<div class="stat-box">
					<span class="mono label">TARGET FPS</span>
					<span class="value">{fpsEstimate} FPS</span>
				</div>
			</div>

			<div class="hud-footer">
				<span class="mono subtitle">NOVA ENGINE // V2.6 STATIC HDR</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.tech-hud {
		position: fixed;
		bottom: clamp(1rem, 2vw, 2rem);
		right: clamp(1rem, 2vw, 2rem);
		z-index: 950;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
		font-family: var(--font-mono);
	}

	.hud-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.85rem;
		background: rgba(5, 6, 9, 0.75);
		border: 1px solid rgba(0, 240, 255, 0.25);
		border-radius: var(--radius);
		backdrop-filter: blur(12px);
		color: var(--fg);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		transition: all 0.3s var(--ease);
		cursor: pointer;
	}

	.hud-toggle:hover {
		border-color: var(--accent);
		box-shadow: 0 0 12px var(--accent-glow);
	}

	.indicator-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
		animation: pulse 2s infinite ease-in-out;
	}

	.hud-panel {
		width: 280px;
		padding: 1rem;
		background: rgba(10, 15, 25, 0.82);
		border: 1px solid rgba(0, 240, 255, 0.2);
		border-radius: var(--radius);
		backdrop-filter: blur(16px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		animation: slideIn 0.35s var(--ease);
	}

	.hud-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--line);
	}

	.title {
		font-size: 0.58rem;
		color: var(--accent);
		letter-spacing: 0.2em;
	}

	.status {
		font-size: 0.52rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.hud-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.stat-box {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		background: rgba(255, 255, 255, 0.03);
		padding: 0.45rem;
		border-radius: 2px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.label {
		font-size: 0.5rem;
		color: var(--fg-faint);
		letter-spacing: 0.15em;
	}

	.value {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--fg);
	}

	.hud-footer {
		padding-top: 0.4rem;
		border-top: 1px solid var(--line);
		text-align: right;
	}

	.subtitle {
		font-size: 0.5rem;
		color: var(--fg-faint);
		letter-spacing: 0.12em;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 900px) {
		.tech-hud {
			display: none;
		}
	}
</style>
