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

/**
 * Settle the damped rig on a pose, then report whether the subject sphere is
 * fully inside the camera frustum. This is the regression guard for the bug
 * where middle chapters framed empty space.
 * @param {CinematicRig} r
 * @param {number} progress
 */
function settleAndCheck(r, progress) {
	for (let i = 0; i < 600; i++) r.update(progress, 1 / 60, 0);
	r.camera.updateMatrixWorld(true);
	const frustum = new THREE.Frustum().setFromProjectionMatrix(
		new THREE.Matrix4().multiplyMatrices(r.camera.projectionMatrix, r.camera.matrixWorldInverse)
	);
	const sphere = new THREE.Sphere(r.subjectCenter.clone(), r.subjectRadius);
	return {
		contains: frustum.containsPoint(r.subjectCenter),
		intersects: frustum.intersectsSphere(sphere),
		insideAllPlanes: frustum.planes.every((plane) => plane.distanceToSphere(sphere) >= -1e-6),
		distance: r.camera.position.distanceTo(r.subjectCenter)
	};
}

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

	it('never asks the subject to overflow the frame', () => {
		for (const frame of rig.keyframes) {
			expect(frame.fill).toBeGreaterThan(0.2);
			expect(frame.fill).toBeLessThanOrEqual(0.95);
			expect(Math.abs(frame.offset[0])).toBeLessThanOrEqual(0.5);
			expect(Math.abs(frame.offset[1])).toBeLessThanOrEqual(0.5);
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

describe('CinematicRig framing solver', () => {
	it('pulls back further for a bigger subject', () => {
		const near = rig.framingDistance(1, 45, 0.7);
		const far = rig.framingDistance(3, 45, 0.7);
		expect(far).toBeCloseTo(near * 3, 5);
	});

	it('pulls back further for a longer lens', () => {
		expect(rig.framingDistance(1, 24, 0.7)).toBeGreaterThan(rig.framingDistance(1, 60, 0.7));
	});

	it('accounts for narrow portrait viewports', () => {
		const landscape = rig.framingDistance(1, 45, 0.7);
		camera.aspect = 0.5;
		const portrait = rig.framingDistance(1, 45, 0.7);
		expect(portrait).toBeGreaterThan(landscape);
	});

	it('keeps the subject inside the frustum at every chapter', () => {
		for (let p = 0; p <= 1.0001; p += 0.02) {
			const fresh = new CinematicRig(new THREE.PerspectiveCamera(45, 1.6, 0.1, 100));
			fresh.setSubject(new THREE.Vector3(0, 0, 0), 2.1);
			const result = settleAndCheck(fresh, p);
			expect(result.contains, `progress ${p.toFixed(2)}: centre off-screen`).toBe(true);
			expect(result.insideAllPlanes, `progress ${p.toFixed(2)}: subject clipped`).toBe(true);
		}
	});

	it('reframes when the subject grows, instead of losing it', () => {
		rig.setSubject(new THREE.Vector3(0, 0, 0), 1.3);
		const small = settleAndCheck(rig, 0.6).distance;

		const big = new CinematicRig(new THREE.PerspectiveCamera(45, 1.6, 0.1, 100));
		big.setSubject(new THREE.Vector3(0, 0, 0), 3.4);
		const large = settleAndCheck(big, 0.6);
		expect(large.distance).toBeGreaterThan(small);
		expect(large.insideAllPlanes).toBe(true);
	});

	it('follows a subject that is not at the origin', () => {
		rig.setSubject(new THREE.Vector3(2, -1, 4), 1.5);
		const result = settleAndCheck(rig, 0.44);
		expect(result.contains).toBe(true);
		expect(result.insideAllPlanes).toBe(true);
	});

	it('ignores a nonsense subject measurement', () => {
		rig.setSubject(new THREE.Vector3(0, 0, 0), 2);
		rig.setSubject(new THREE.Vector3(9, 9, 9), Number.NaN);
		expect(rig.subjectRadius).toBe(2);
		rig.setSubject(new THREE.Vector3(9, 9, 9), 0);
		expect(rig.subjectRadius).toBe(2);
	});

	it('keeps near and far planes around the subject', () => {
		rig.setSubject(new THREE.Vector3(0, 0, 0), 2.1);
		settleAndCheck(rig, 0.5);
		expect(camera.near).toBeGreaterThan(0);
		expect(camera.near).toBeLessThan(camera.position.distanceTo(rig.subjectCenter) - 2.1);
		expect(camera.far).toBeGreaterThan(camera.position.distanceTo(rig.subjectCenter) + 2.1);
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

	it('moves the camera closer for the macro chapters than for the opener', () => {
		rig.setSubject(new THREE.Vector3(0, 0, 0), 1.4);
		const wide = settleAndCheck(rig, 0).distance;
		const macro = settleAndCheck(rig, 0.25).distance;
		expect(macro).toBeLessThan(wide);
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
