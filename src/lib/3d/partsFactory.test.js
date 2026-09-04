import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
	PHONE,
	roundedRectShape,
	createSlabGeometry,
	createRailGeometry,
	createChipLayout,
	createLensLayout,
	createContactShadow,
	normaliseUv
} from './partsFactory.js';

/** @param {THREE.BufferGeometry} geometry */
function sizeOf(geometry) {
	geometry.computeBoundingBox();
	const size = new THREE.Vector3();
	geometry.boundingBox?.getSize(size);
	return size;
}

describe('roundedRectShape', () => {
	it('stays inside the requested bounds', () => {
		const points = roundedRectShape(2, 4, 0.4).getPoints(40);
		for (const point of points) {
			expect(Math.abs(point.x)).toBeLessThanOrEqual(1 + 1e-6);
			expect(Math.abs(point.y)).toBeLessThanOrEqual(2 + 1e-6);
		}
	});

	it('clamps an oversized corner radius instead of self-intersecting', () => {
		const points = roundedRectShape(1, 1, 99).getPoints(24);
		for (const point of points) {
			expect(Math.abs(point.x)).toBeLessThanOrEqual(0.5 + 1e-6);
			expect(Math.abs(point.y)).toBeLessThanOrEqual(0.5 + 1e-6);
		}
	});

	it('rounds the corners: the corner area is cut away', () => {
		const square = roundedRectShape(2, 2, 0);
		const rounded = roundedRectShape(2, 2, 0.5);
		expect(THREE.ShapeUtils.area(rounded.getPoints(64))).toBeLessThan(
			THREE.ShapeUtils.area(square.getPoints(64))
		);
	});
});

describe('createSlabGeometry', () => {
	it('matches the requested dimensions', () => {
		const size = sizeOf(createSlabGeometry({ width: 1.3, height: 2.7, depth: 0.05, bevel: 0 }));
		expect(size.x).toBeCloseTo(1.3, 2);
		expect(size.y).toBeCloseTo(2.7, 2);
		expect(size.z).toBeCloseTo(0.05, 2);
	});

	it('is centred on the origin', () => {
		const geometry = createSlabGeometry({ depth: 0.04 });
		geometry.computeBoundingBox();
		const centre = new THREE.Vector3();
		geometry.boundingBox?.getCenter(centre);
		expect(centre.length()).toBeLessThan(1e-6);
	});

	it('has real thickness, unlike the old flat planes', () => {
		expect(sizeOf(createSlabGeometry({ depth: 0.03 })).z).toBeGreaterThan(0.02);
	});

	it('produces normals and normalised UVs', () => {
		const geometry = createSlabGeometry({ depth: 0.03 });
		expect(geometry.getAttribute('normal')).toBeTruthy();

		const uv = geometry.getAttribute('uv');
		for (let i = 0; i < uv.count; i++) {
			expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-6);
			expect(uv.getX(i)).toBeLessThanOrEqual(1 + 1e-6);
			expect(uv.getY(i)).toBeGreaterThanOrEqual(-1e-6);
			expect(uv.getY(i)).toBeLessThanOrEqual(1 + 1e-6);
		}
	});

	it('defaults to the master phone dimensions', () => {
		const size = sizeOf(createSlabGeometry({ bevel: 0 }));
		expect(size.x).toBeCloseTo(PHONE.width, 2);
		expect(size.y).toBeCloseTo(PHONE.height, 2);
	});
});

describe('createRailGeometry', () => {
	it('is hollow: fewer triangles cover the middle than a solid slab', () => {
		const rail = createRailGeometry({ wall: 0.06 });
		rail.computeBoundingBox();
		const size = sizeOf(rail);
		expect(size.x).toBeCloseTo(PHONE.width, 1);
		expect(size.y).toBeCloseTo(PHONE.height, 1);

		// No vertex should sit in the middle of the opening.
		const position = rail.getAttribute('position');
		let inCentre = 0;
		for (let i = 0; i < position.count; i++) {
			if (Math.abs(position.getX(i)) < 0.4 && Math.abs(position.getY(i)) < 0.9) inCentre++;
		}
		expect(inCentre).toBe(0);
	});

	it('survives an absurd wall thickness', () => {
		expect(() => createRailGeometry({ wall: 10 })).not.toThrow();
	});
});

describe('component layouts', () => {
	it('places six distinct chips inside the board', () => {
		const chips = createChipLayout();
		expect(chips).toHaveLength(6);
		expect(new Set(chips.map((c) => c.name)).size).toBe(6);

		for (const chip of chips) {
			expect(Math.abs(chip.x) + chip.width / 2).toBeLessThanOrEqual(0.5);
			expect(Math.abs(chip.y) + chip.height / 2).toBeLessThanOrEqual(0.5);
			expect(chip.depth).toBeGreaterThan(0);
		}
	});

	it('marks exactly one chip as the emissive NPU die', () => {
		expect(createChipLayout().filter((chip) => chip.emissive)).toHaveLength(1);
	});

	it('lays out five non-overlapping lenses', () => {
		const lenses = createLensLayout();
		expect(lenses).toHaveLength(5);

		for (let i = 0; i < lenses.length; i++) {
			for (let j = i + 1; j < lenses.length; j++) {
				const a = lenses[i];
				const b = lenses[j];
				const distance = Math.hypot(a.x - b.x, a.y - b.y);
				expect(distance, `${a.name} overlaps ${b.name}`).toBeGreaterThan(
					a.radius + b.radius - 0.03
				);
			}
		}
	});
});

describe('createContactShadow', () => {
	it('lies flat, does not write depth and renders first', () => {
		const { mesh, material } = createContactShadow(2);
		expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
		expect(material.transparent).toBe(true);
		expect(material.depthWrite).toBe(false);
		expect(mesh.renderOrder).toBeLessThan(0);
	});
});

describe('normaliseUv', () => {
	it('is a no-op for geometry without UVs', () => {
		const geometry = new THREE.BufferGeometry();
		expect(() => normaliseUv(geometry)).not.toThrow();
	});
});
