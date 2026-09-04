import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { configurePhoneModel } from './modelPipeline.js';

/**
 * Build a slab whose thin axis is `thin`, to stand in for the baked GLB.
 * @param {'x'|'y'|'z'} thin
 * @param {[number, number, number]} [offset]
 */
function slab(thin, offset = [4, -2, 7]) {
	const dims = { x: 1.4, y: 2.8, z: 0.16 };
	const size = { x: dims.y, y: dims.x, z: dims.z };
	if (thin === 'x') Object.assign(size, { x: dims.z, y: dims.y, z: dims.x });
	if (thin === 'y') Object.assign(size, { x: dims.x, y: dims.z, z: dims.y });
	if (thin === 'z') Object.assign(size, { x: dims.x, y: dims.y, z: dims.z });

	const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
	const root = new THREE.Group();
	root.add(mesh);
	// Models rarely arrive centred on the origin.
	mesh.position.set(offset[0], offset[1], offset[2]);
	return root;
}

/** @param {THREE.Object3D} object */
function measure(object) {
	object.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(object);
	return { size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
}

describe('configurePhoneModel', () => {
	for (const thin of /** @type {const} */ (['x', 'y', 'z'])) {
		it(`orients a slab whose thin axis is ${thin} to face the camera`, () => {
			const { size } = measure(configurePhoneModel(slab(thin)));

			// Thinnest axis must end up on Z (flat face towards the viewer).
			expect(size.z).toBeLessThan(size.x);
			expect(size.z).toBeLessThan(size.y);
			// Longest axis must end up on Y (device standing upright).
			expect(size.y).toBeGreaterThan(size.x);
		});

		it(`centres and normalises a slab whose thin axis is ${thin}`, () => {
			const { size, center } = measure(configurePhoneModel(slab(thin)));

			expect(center.length()).toBeLessThan(1e-6);
			expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2.5, 5);
		});
	}

	it('keeps the aspect ratio intact (uniform scale, quarter turns only)', () => {
		const before = measure(slab('x')).size;
		const after = measure(configurePhoneModel(slab('x'))).size;

		const sortDesc = (/** @type {THREE.Vector3} */ v) => [v.x, v.y, v.z].sort((a, b) => b - a);
		const a = sortDesc(before);
		const b = sortDesc(after);

		expect(b[1] / b[0]).toBeCloseTo(a[1] / a[0], 5);
		expect(b[2] / b[0]).toBeCloseTo(a[2] / a[0], 5);
	});

	it('tolerates an empty object without throwing', () => {
		expect(() => configurePhoneModel(new THREE.Group())).not.toThrow();
	});
});
