<script>
	/** @type {{ items?: {key:string,num:string,name:string,x:number,y:number,visible:boolean}[], show?: boolean }} */
	let { items = [], show = false } = $props();
</script>

{#if show}
	<div class="hotspots" aria-hidden="true">
		{#each items as item (item.key)}
			{#if item.visible}
				<div class="hotspot" style="transform: translate3d({item.x}px, {item.y}px, 0)">
					<span class="dot"></span>
					<span class="tag">
						<b>{item.num}</b>
						{item.name}
					</span>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.hotspots {
		position: fixed;
		inset: 0;
		z-index: 4;
		pointer-events: none;
	}

	.hotspot {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		animation: pop 0.5s var(--ease);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
		flex: none;
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		color: rgba(255, 255, 255, 0.85);
		white-space: nowrap;
		padding: 0.25rem 0.5rem;
		background: rgba(5, 6, 9, 0.55);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.tag b {
		color: var(--accent);
		font-weight: 500;
		margin-right: 0.35rem;
	}

	@keyframes pop {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 900px) {
		.hotspots {
			display: none;
		}
	}
</style>
