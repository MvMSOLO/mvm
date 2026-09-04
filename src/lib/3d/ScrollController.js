/**
 * Maps document scroll onto a smoothed 0..1 progress value.
 *
 * Two improvements over a naive `scrollY / maxScroll`:
 *  - the measured range is a specific element (the cinematic region), so
 *    static sections below it don't compress the animation;
 *  - smoothing is frame-rate independent, and honours reduced-motion.
 */
export class ScrollController {
	/**
	 * @param {{ target?: HTMLElement | null, smoothing?: number, reducedMotion?: boolean, now?: () => number }} [options]
	 */
	constructor(options = {}) {
		this.target = options.target ?? null;
		this.smoothing = options.smoothing ?? 6;
		this.reducedMotion = Boolean(options.reducedMotion);
		// Injectable clock keeps `update` testable without real frame timing.
		this.now = options.now ?? (() => performance.now());

		this.rangeStart = 0;
		this.rangeLength = 1;
		this.targetProgress = 0;
		this.currentProgress = 0;
		this.velocity = 0;
		this.lastProgress = 0;
		this.lastTime = this.now();
		/** @type {ResizeObserver | undefined} */
		this.observer = undefined;

		this.measure = this.measure.bind(this);
		this.handleScroll = this.handleScroll.bind(this);

		window.addEventListener('scroll', this.handleScroll, { passive: true });
		window.addEventListener('resize', this.measure, { passive: true });

		// Late web-font loads and revealed sections change the region height without
		// firing `resize`, which would leave the progress range stale.
		if (this.target && typeof ResizeObserver !== 'undefined') {
			this.observer = new ResizeObserver(this.measure);
			this.observer.observe(this.target);
		}

		this.measure();
		this.handleScroll();
	}

	/** Cache the scroll range so we don't touch layout on every scroll event. */
	measure() {
		if (this.target) {
			const rect = this.target.getBoundingClientRect();
			this.rangeStart = rect.top + window.scrollY;
			this.rangeLength = Math.max(this.target.offsetHeight - window.innerHeight, 1);
		} else {
			this.rangeStart = 0;
			this.rangeLength = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
		}
		this.handleScroll();
	}

	handleScroll() {
		const raw = (window.scrollY - this.rangeStart) / this.rangeLength;
		this.targetProgress = Math.min(Math.max(raw, 0), 1);
	}

	/**
	 * Advance the smoothed value. Call once per animation frame.
	 * @returns {number} smoothed progress 0..1
	 */
	update() {
		const now = this.now();
		const delta = Math.min((now - this.lastTime) / 1000, 0.1);
		this.lastTime = now;

		if (this.reducedMotion) {
			this.currentProgress = this.targetProgress;
		} else {
			const factor = 1 - Math.exp(-this.smoothing * delta);
			this.currentProgress += (this.targetProgress - this.currentProgress) * factor;
		}

		this.velocity = Math.abs(this.currentProgress - this.lastProgress);
		this.lastProgress = this.currentProgress;
		return this.currentProgress;
	}

	destroy() {
		window.removeEventListener('scroll', this.handleScroll);
		window.removeEventListener('resize', this.measure);
		this.observer?.disconnect();
	}
}
