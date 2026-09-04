import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CinematicRig } from './CinematicRig.js';

/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {CinematicRig} */
let rig;

beforeEach(() => {
	camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 100);
	rig = new CinematicRig(camera);
});

describe('CinematicRig keyframes', () => {
	it('is sorted by progress and spans 0..1', () => {
		expect(rig.keyframes[0].progress).toBe(0);
		expect(rig.keyframes.at(-1).progress).toBe(1);

		for (let i = 0; i < rig.keyframes.length - 1; i++) {
			expect(rig.keyframes[i + 1].progress).toBeGreaterThan(rig.keyframes[i].progress);
		}
	});

	it('uses sane field of view values', () => {
		for (const frame of rig.keyframes) {
			expect(frame.fov).toBeGreaterThan(10);
			expect(frame.fov).toBeLessThan(120);
		}
	});
});

describe('CinematicRig.segmentAt', () => {
	it('brackets an interior value', () => {
		const [a, b] = rig.segmentAt(0.3);
		expect(a.progress).toBeLessThanOrEqual(0.3);
		expect(b.progress).toBeGreaterThanOrEqual(0.3);
	});

	it('handles out-of-range input without throwing', () => {
		expect(() => rig.segmentAt(-1)).not.toThrow();
		expect(() => rig.segmentAt(2)).not.toThrow();
		expect(rig.segmentAt(-1)[0].progress).toBe(0);
		expect(rig.segmentAt(2)[0].progress).toBe(1);
	});
});

describe('CinematicRig.update', () => {
	it('produces finite camera coordinates across the whole range', () => {
		for (let p = 0; p <= 1.0001; p += 0.05) {
			rig.update(p, 1 / 60, 1.5);
			expect(Number.isFinite(camera.position.x)).toBe(true);
			expect(Number.isFinite(camera.position.y)).toBe(true);
			expect(Number.isFinite(camera.position.z)).toBe(true);
			expect(Number.isFinite(camera.fov)).toBe(true);
		}
	});

	it('converges towards the target position when held steady', () => {
		for (let i = 0; i < 400; i++) rig.update(0.25, 1 / 60, 0);
		expect(camera.position.z).toBeCloseTo(2.1, 1);
	});

	it('moves the camera closer as progress advances into the macro shot', () => {
		for (let i = 0; i < 400; i++) rig.update(0, 1 / 60, 0);
		const far = camera.position.z;
		for (let i = 0; i < 400; i++) rig.update(0.35, 1 / 60, 0);
		expect(camera.position.z).toBeLessThan(far);
	});

	it('decays shake back to zero', () => {
		rig.triggerShake(0.08);
		expect(rig.shakeIntensity).toBeGreaterThan(0);
		for (let i = 0; i < 300; i++) rig.update(0.5, 1 / 60, 0);
		expect(rig.shakeIntensity).toBe(0);
	});

	it('keeps the camera still when idle motion is disabled', () => {
		for (let i = 0; i < 500; i++) rig.update(0, 1 / 60, 0);
		const first = camera.position.clone();
		rig.update(0, 1 / 60, 0);
		expect(camera.position.distanceTo(first)).toBeLessThan(1e-4);
	});

	it('tolerates a zero delta without producing NaN', () => {
		rig.update(0.5, 0, 1);
		expect(Number.isFinite(camera.position.z)).toBe(true);
	});
});
