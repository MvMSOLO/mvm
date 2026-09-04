import { describe, it, expect } from 'vitest';
import {
	SPRINGS,
	createSpring,
	stepSpring,
	snapSpring,
	createVectorSpring,
	stepVectorSpring
} from './spring.js';

/**
 * @param {import('./spring.js').SpringState} state
 * @param {number} target
 * @param {number} seconds
 * @param {import('./spring.js').SpringConfig} [config]
 * @param {number} [fps]
 */
function simulate(state, target, seconds, config, fps = 60) {
	const dt = 1 / fps;
	let peak = state.value;
	for (let t = 0; t < seconds; t += dt) {
		stepSpring(state, target, dt, config);
		peak = Math.max(peak, state.value);
	}
	return peak;
}

describe('stepSpring', () => {
	it('settles on the target', () => {
		const state = createSpring(0);
		simulate(state, 1, 3, SPRINGS.solid);
		expect(state.value).toBeCloseTo(1, 3);
		expect(state.velocity).toBeCloseTo(0, 3);
	});

	it('is frame-rate independent: 30fps and 144fps agree', () => {
		const slow = createSpring(0);
		const fast = createSpring(0);
		simulate(slow, 1, 1, SPRINGS.solid, 30);
		simulate(fast, 1, 1, SPRINGS.solid, 144);
		expect(Math.abs(slow.value - fast.value)).toBeLessThan(0.02);
	});

	it('overshoots slightly for light parts and not at all when critically damped', () => {
		const light = createSpring(0);
		const critical = createSpring(0);
		expect(simulate(light, 1, 3, SPRINGS.light)).toBeGreaterThan(1);
		expect(simulate(critical, 1, 3, SPRINGS.critical)).toBeLessThanOrEqual(1.0001);
	});

	it('heavier parts arrive later than lighter ones', () => {
		const light = createSpring(0);
		const heavy = createSpring(0);
		simulate(light, 1, 0.25, SPRINGS.light);
		simulate(heavy, 1, 0.25, SPRINGS.heavy);
		expect(light.value).toBeGreaterThan(heavy.value);
	});

	it('stays stable across an absurd frame gap instead of exploding', () => {
		const state = createSpring(0);
		stepSpring(state, 100, 5, SPRINGS.solid);
		expect(Number.isFinite(state.value)).toBe(true);
		expect(state.value).toBeGreaterThanOrEqual(0);
		expect(state.value).toBeLessThanOrEqual(100);
	});

	it('ignores non-finite input', () => {
		const state = createSpring(3);
		stepSpring(state, Number.NaN, 0.016);
		stepSpring(state, 5, 0);
		stepSpring(state, 5, Number.NaN);
		expect(state.value).toBe(3);
	});

	it('snaps exactly, so it does not keep the loop awake forever', () => {
		const state = createSpring(0);
		simulate(state, 2, 5, SPRINGS.solid);
		expect(state.value).toBe(2);
		expect(state.velocity).toBe(0);
	});

	it('never leaves the interval between start and target when critically damped', () => {
		const state = createSpring(-1);
		const dt = 1 / 60;
		for (let i = 0; i < 300; i++) {
			stepSpring(state, 1, dt, SPRINGS.critical);
			expect(state.value).toBeGreaterThanOrEqual(-1.0001);
			expect(state.value).toBeLessThanOrEqual(1.0001);
		}
	});
});

describe('snapSpring', () => {
	it('kills position and velocity', () => {
		const state = createSpring(0);
		simulate(state, 5, 0.1, SPRINGS.solid);
		snapSpring(state, 5);
		expect(state).toEqual({ value: 5, velocity: 0 });
	});
});

describe('stepVectorSpring', () => {
	it('drives all three axes into the output object', () => {
		const springs = createVectorSpring();
		const out = { x: 0, y: 0, z: 0 };
		for (let i = 0; i < 240; i++) {
			stepVectorSpring(springs, { x: 1, y: -2, z: 3 }, 1 / 60, SPRINGS.solid, out);
		}
		expect(out.x).toBeCloseTo(1, 3);
		expect(out.y).toBeCloseTo(-2, 3);
		expect(out.z).toBeCloseTo(3, 3);
	});

	it('works without an output object', () => {
		const springs = createVectorSpring();
		expect(() => stepVectorSpring(springs, { x: 1, y: 1, z: 1 }, 1 / 60)).not.toThrow();
	});
});
