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
	createGrilleLayout,
	createScrewLayout,
	createAntennaLines,
	createFlexCableGeometry,
	createButtonLayout,
	createPortShape,
	createCameraPlateau,
	createLensProfile,
	createApertureBladeLayout,
	createPunchHoleLayout,
	createMicSlotLayout,
	createPcbTraceLayout,
	createCoilSpiral,
	createSimTray,
	createBatteryTabs,
	createDisplayStack,
	createTapticEngine,
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

describe('machined detail layouts', () => {
	it('spaces the grille holes evenly and keeps them on the phone', () => {
		const holes = createGrilleLayout({ count: 14 });
		expect(holes).toHaveLength(14);

		const gaps = holes.slice(1).map((hole, i) => hole.x - holes[i].x);
		for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
		for (const hole of holes) {
			expect(Math.abs(hole.x)).toBeLessThan(PHONE.width / 2);
			expect(hole.radius).toBeGreaterThan(0);
		}
	});

	it('handles the degenerate single-hole case', () => {
		const holes = createGrilleLayout({ count: 1 });
		expect(holes).toHaveLength(1);
		expect(Number.isFinite(holes[0].x)).toBe(true);
	});

	it('puts six screws inside the rail, symmetric left/right', () => {
		const screws = createScrewLayout();
		expect(screws).toHaveLength(6);
		for (const screw of screws) {
			expect(Math.abs(screw.x)).toBeLessThan(PHONE.width / 2);
			expect(Math.abs(screw.y)).toBeLessThan(PHONE.height / 2);
		}
		const xs = screws.map((s) => s.x);
		expect(xs.filter((x) => x > 0)).toHaveLength(3);
		expect(xs.filter((x) => x < 0)).toHaveLength(3);
	});

	it('keeps the antenna lines within the rail height', () => {
		for (const line of createAntennaLines()) {
			expect(Math.abs(line)).toBeLessThan(0.5);
		}
	});
});

describe('createFlexCableGeometry', () => {
	it('spans from start to end and bows sideways', () => {
		const geometry = createFlexCableGeometry({
			from: [0, -0.5, 0],
			to: [0, 0.5, 0],
			bulge: 0.3,
			radius: 0.01
		});
		geometry.computeBoundingBox();
		const box = geometry.boundingBox;
		expect(box?.min.y).toBeLessThan(-0.4);
		expect(box?.max.y).toBeGreaterThan(0.4);
		// The bow means the tube reaches out past the straight line.
		expect(box?.max.x ?? 0).toBeGreaterThan(0.2);
	});

	it('never produces a zero-radius or zero-segment tube', () => {
		const geometry = createFlexCableGeometry({ radius: 0, segments: 0 });
		expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
	});
});

describe('normaliseUv', () => {
	it('is a no-op for geometry without UVs', () => {
		const geometry = new THREE.BufferGeometry();
		expect(() => normaliseUv(geometry)).not.toThrow();
	});
});

describe('createButtonLayout', () => {
	it('puts power opposite the volume rocker, as on a real chassis', () => {
		const buttons = createButtonLayout();
		const power = buttons.find((b) => b.name === 'power');
		const volume = buttons.filter((b) => b.name.startsWith('volume'));
		expect(power?.side).toBe('right');
		expect(volume).toHaveLength(2);
		expect(volume.every((b) => b.side === 'left')).toBe(true);
	});

	it('knurls only the power key and keeps every key inside the rail', () => {
		const buttons = createButtonLayout();
		expect(buttons.filter((b) => b.knurled)).toHaveLength(1);
		for (const button of buttons) {
			expect(Math.abs(button.y) + button.length / 2).toBeLessThan(PHONE.height / 2);
			expect(button.standoff).toBeGreaterThan(0);
		}
	});

	it('scales with the chassis it is given', () => {
		const big = createButtonLayout({ height: 4, width: 2 });
		expect(big[0].y).toBeCloseTo(4 * 0.14, 6);
	});
});

describe('createPortShape', () => {
	it('is a fully rounded slot on the bottom edge', () => {
		const port = createPortShape();
		const points = port.shape.getPoints(8);
		expect(points.length).toBeGreaterThan(8);
		expect(port.y).toBeCloseTo(-PHONE.height / 2, 6);
		expect(port.width).toBeGreaterThan(port.height);
	});
});

describe('createCameraPlateau', () => {
	it('is a chamfered deck that stands off the back panel', () => {
		const plateau = createCameraPlateau();
		expect(plateau.rise).toBeGreaterThan(0);
		plateau.geometry.computeBoundingBox();
		const box = plateau.geometry.boundingBox;
		expect(box).toBeTruthy();
		const size = box.getSize(new THREE.Vector3());
		expect(size.z).toBeGreaterThan(0);
		expect(size.x).toBeLessThan(PHONE.width);
		expect(plateau.geometry.attributes.uv).toBeTruthy();
	});

	it('sits in the upper-left quadrant, where the module belongs', () => {
		const { offset } = createCameraPlateau();
		expect(offset.x).toBeLessThan(0);
		expect(offset.y).toBeGreaterThan(0);
	});
});

describe('createLensProfile', () => {
	it('starts and ends on the axis so the lathe closes', () => {
		const profile = createLensProfile();
		expect(profile[0].x).toBe(0);
		expect(profile.at(-1)?.x).toBe(0);
	});

	it('never rises above the requested height or exceeds the radius', () => {
		const profile = createLensProfile({ radius: 0.2, height: 0.1 });
		for (const point of profile) {
			expect(point.y).toBeGreaterThanOrEqual(0);
			expect(point.y).toBeLessThanOrEqual(0.1 + 1e-6);
			expect(point.x).toBeLessThanOrEqual(0.2 * 1.05 + 1e-6);
		}
	});

	it('steps inward towards the mouth, which is what reads as a barrel', () => {
		const profile = createLensProfile();
		const widest = Math.max(...profile.map((p) => p.x));
		expect(profile.at(-2)?.x).toBeLessThan(widest);
	});
});

describe('createApertureBladeLayout', () => {
	it('spreads the blades evenly around the circle', () => {
		const angles = createApertureBladeLayout(9);
		expect(angles).toHaveLength(9);
		expect(angles[1] - angles[0]).toBeCloseTo((Math.PI * 2) / 9);
	});

	it('clamps to a physically sensible minimum', () => {
		expect(createApertureBladeLayout(0)).toHaveLength(3);
		expect(createApertureBladeLayout(2.7)).toHaveLength(3);
	});
});

describe('createPunchHoleLayout', () => {
	it('puts the camera hole and earpiece near the top of the panel', () => {
		const cutouts = createPunchHoleLayout();
		expect(cutouts).toHaveLength(2);
		for (const cutout of cutouts) {
			expect(cutout.y).toBeGreaterThan(0);
			expect(cutout.y).toBeLessThan(PHONE.height / 2);
		}
	});

	it('describes the camera as a circle and the earpiece as a slot', () => {
		const [selfie, earpiece] = createPunchHoleLayout();
		expect(selfie.radius).toBeGreaterThan(0);
		expect(earpiece.width).toBeGreaterThan(earpiece.height ?? 0);
	});
});

describe('createMicSlotLayout', () => {
	it('keeps every perforation on a rail edge and inside the body', () => {
		for (const slot of createMicSlotLayout()) {
			expect(Math.abs(slot.y)).toBeLessThanOrEqual(PHONE.height / 2);
			expect(Math.abs(slot.x)).toBeLessThan(PHONE.width / 2);
			expect(slot.radius).toBeGreaterThan(0);
		}
	});
});

describe('createPcbTraceLayout', () => {
	it('is deterministic for a given seed', () => {
		expect(createPcbTraceLayout({ seed: 42 })).toEqual(createPcbTraceLayout({ seed: 42 }));
	});

	it('changes with the seed', () => {
		expect(createPcbTraceLayout({ seed: 1 })).not.toEqual(createPcbTraceLayout({ seed: 2 }));
	});

	it('keeps traces on the board and mixes orientations', () => {
		const traces = createPcbTraceLayout({ count: 30 });
		expect(traces).toHaveLength(30);
		for (const trace of traces) {
			expect(Math.abs(trace.x)).toBeLessThanOrEqual(0.5);
			expect(Math.abs(trace.y)).toBeLessThanOrEqual(0.5);
			expect(trace.length).toBeGreaterThan(0);
		}
		expect(traces.some((t) => t.vertical)).toBe(true);
		expect(traces.some((t) => !t.vertical)).toBe(true);
	});
});

describe('createCoilSpiral', () => {
	it('winds outward monotonically instead of repeating one ring', () => {
		const points = createCoilSpiral({ turns: 4, inner: 0.1, outer: 0.4 });
		const first = Math.hypot(points[0].x, points[0].y);
		const last = Math.hypot(points.at(-1).x, points.at(-1).y);
		expect(first).toBeCloseTo(0.1, 3);
		expect(last).toBeCloseTo(0.4, 3);
	});

	it('stays flat enough to fit behind the cell', () => {
		for (const point of createCoilSpiral()) {
			expect(point.z).toBeGreaterThanOrEqual(0);
			expect(point.z).toBeLessThanOrEqual(0.0061);
		}
	});

	it('produces enough samples for a smooth sweep and clamps bad input', () => {
		expect(createCoilSpiral({ turns: 9 }).length).toBeGreaterThan(300);
		expect(createCoilSpiral({ turns: 0 }).length).toBeGreaterThanOrEqual(5);
	});
});

describe('createSimTray', () => {
	it('sits on the left rail with a pinhole beside it', () => {
		const tray = createSimTray();
		expect(tray.x).toBeCloseTo(-PHONE.width / 2);
		expect(tray.length).toBeGreaterThan(0);
		expect(tray.pinhole.radius).toBeGreaterThan(0);
		expect(tray.pinhole.offset).toBeGreaterThan(tray.pinhole.radius);
	});
});

describe('createBatteryTabs', () => {
	it('welds both tabs to the same end of the cell', () => {
		const tabs = createBatteryTabs({ width: 1, height: 2 });
		expect(tabs).toHaveLength(2);
		expect(tabs[0].y).toBeCloseTo(tabs[1].y);
		expect(tabs[0].x).toBeLessThan(0);
		expect(tabs[1].x).toBeGreaterThan(0);
	});
});

describe('createDisplayStack', () => {
	it('orders the laminate front to back', () => {
		const stack = createDisplayStack();
		const offsets = stack.map((layer) => layer.offset);
		expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
	});

	it('keeps every sheet thin and the spreader opaque', () => {
		const stack = createDisplayStack();
		for (const layer of stack) {
			expect(layer.depth).toBeGreaterThan(0);
			expect(layer.depth).toBeLessThan(0.01);
		}
		expect(stack.at(-1)?.opacity).toBe(1);
	});
});

describe('createTapticEngine', () => {
	it('fits inside the body and leaves the mass room to travel', () => {
		const spec = createTapticEngine();
		expect(Math.abs(spec.x) + spec.width / 2).toBeLessThan(PHONE.width);
		expect(spec.mass.width).toBeLessThan(spec.width);
		expect(spec.mass.travel).toBeGreaterThan(0);
	});
});
