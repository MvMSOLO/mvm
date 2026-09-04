import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScrollController } from './ScrollController.js';

/** @type {ScrollController | null} */
let controller = null;

function setViewport(scrollHeight = 4000, innerHeight = 1000) {
	Object.defineProperty(document.documentElement, 'scrollHeight', {
		value: scrollHeight,
		configurable: true
	});
	Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
}

/** @param {number} y */
function scrollTo(y) {
	Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
	window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
	setViewport();
	scrollTo(0);
});

afterEach(() => {
	controller?.destroy();
	controller = null;
	vi.useRealTimers();
});

describe('ScrollController', () => {
	it('starts at zero progress', () => {
		controller = new ScrollController();
		expect(controller.update()).toBeCloseTo(0, 3);
	});

	it('maps the bottom of the document to 1', () => {
		controller = new ScrollController({ reducedMotion: true });
		scrollTo(3000);
		expect(controller.update()).toBeCloseTo(1, 5);
	});

	it('clamps beyond the scrollable range', () => {
		controller = new ScrollController({ reducedMotion: true });
		scrollTo(99999);
		expect(controller.update()).toBe(1);
		scrollTo(-500);
		expect(controller.update()).toBe(0);
	});

	it('snaps instantly when reduced motion is requested', () => {
		controller = new ScrollController({ reducedMotion: true });
		scrollTo(1500);
		expect(controller.update()).toBeCloseTo(0.5, 5);
	});

	it('eases towards the target when smoothing is on', () => {
		// Drive the controller with a synthetic clock so timing is deterministic.
		let clock = 0;
		controller = new ScrollController({ now: () => clock });
		scrollTo(3000);

		clock += 16;
		const first = controller.update();
		expect(first).toBeGreaterThan(0);
		expect(first).toBeLessThan(1);

		let value = first;
		for (let i = 0; i < 200; i++) {
			clock += 16;
			value = controller.update();
		}
		expect(value).toBeCloseTo(1, 2);
	});

	it('measures a target element instead of the document when given one', () => {
		const element = document.createElement('div');
		Object.defineProperty(element, 'offsetHeight', { value: 3000, configurable: true });
		element.getBoundingClientRect = () => /** @type {DOMRect} */ ({ top: 500 });
		document.body.appendChild(element);

		controller = new ScrollController({ target: element, reducedMotion: true });
		expect(controller.rangeStart).toBe(500);
		expect(controller.rangeLength).toBe(2000);

		scrollTo(1500);
		expect(controller.update()).toBeCloseTo(0.5, 5);
		element.remove();
	});

	it('never divides by zero on an unscrollable page', () => {
		setViewport(800, 800);
		controller = new ScrollController({ reducedMotion: true });
		scrollTo(0);
		expect(Number.isFinite(controller.update())).toBe(true);
	});

	it('reports velocity while catching up', () => {
		let clock = 0;
		controller = new ScrollController({ now: () => clock });
		scrollTo(3000);
		clock += 16;
		controller.update();
		expect(controller.velocity).toBeGreaterThan(0);
	});

	it('detaches its listeners on destroy', () => {
		controller = new ScrollController({ reducedMotion: true });
		controller.destroy();
		const before = controller.targetProgress;
		scrollTo(3000);
		expect(controller.targetProgress).toBe(before);
		controller = null;
	});
});
