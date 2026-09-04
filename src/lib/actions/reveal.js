/**
 * Svelte action: fade + rise an element in the first time it enters the
 * viewport. Falls back to "immediately visible" when IntersectionObserver is
 * unavailable or the user prefers reduced motion.
 *
 * @param {HTMLElement} node
 * @param {{ threshold?: number, once?: boolean, delay?: number }} [params]
 */
export function reveal(node, params = {}) {
	const { threshold = 0.2, once = true, delay = 0 } = params;

	const reducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	node.classList.add('reveal');

	if (reducedMotion || typeof IntersectionObserver === 'undefined') {
		node.classList.add('is-visible');
		return {};
	}

	if (delay) node.style.transitionDelay = `${delay}ms`;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('is-visible');
					if (once) observer.unobserve(node);
				} else if (!once) {
					node.classList.remove('is-visible');
				}
			}
		},
		{ threshold }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		}
	};
}
