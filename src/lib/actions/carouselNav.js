/**
 * Svelte action: arrow-key and swipe navigation for a carousel region.
 *
 * The listeners are attached imperatively rather than declaratively so the
 * host element keeps its semantic (non-widget) role: the real controls stay
 * the buttons inside, and this only adds shortcuts for people already
 * focused within the region.
 *
 * @param {HTMLElement} node
 * @param {{ next: () => void, prev: () => void, threshold?: number }} options
 */
export function carouselNav(node, options) {
	let current = options;
	let startX = 0;
	let startY = 0;

	/** @param {KeyboardEvent} event */
	function onKeydown(event) {
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			current.next();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			current.prev();
		}
	}

	/** @param {TouchEvent} event */
	function onTouchStart(event) {
		const touch = event.touches[0];
		if (!touch) return;
		startX = touch.clientX;
		startY = touch.clientY;
	}

	/** @param {TouchEvent} event */
	function onTouchEnd(event) {
		const touch = event.changedTouches[0];
		if (!touch) return;
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		// Ignore mostly-vertical gestures so page scrolling still feels natural.
		if (Math.abs(dx) < (current.threshold ?? 45) || Math.abs(dx) < Math.abs(dy)) return;
		if (dx < 0) current.next();
		else current.prev();
	}

	node.addEventListener('keydown', onKeydown);
	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });

	return {
		/** @param {{ next: () => void, prev: () => void, threshold?: number }} update */
		update(update) {
			current = update;
		},
		destroy() {
			node.removeEventListener('keydown', onKeydown);
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchend', onTouchEnd);
		}
	};
}
