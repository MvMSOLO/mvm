import { describe, it, expect } from 'vitest';
import { createJourneyRoute, markerAt, activeNodeIndex } from './journey.js';

const items = [
	{ id: 'a', label: 'A' },
	{ id: 'b', label: 'B' },
	{ id: 'c', label: 'C' },
	{ id: 'd', label: 'D' }
];
const geometry = { width: 240, height: 68, padding: 16, amplitude: 0.62 };

describe('createJourneyRoute', () => {
	it('places one node per item, first and last at the ends', () => {
		const route = createJourneyRoute({ items, ...geometry });
		expect(route.nodes).toHaveLength(items.length);
		expect(route.nodes[0].t).toBe(0);
		expect(route.nodes.at(-1)?.t).toBe(1);
		expect(route.nodes[0].x).toBeCloseTo(16);
		expect(route.nodes.at(-1)?.x).toBeCloseTo(224);
	});

	it('advances monotonically from left to right', () => {
		const { nodes } = createJourneyRoute({ items, ...geometry });
		for (let i = 1; i < nodes.length; i++) {
			expect(nodes[i].x).toBeGreaterThan(nodes[i - 1].x);
		}
	});

	it('keeps every node inside the viewBox', () => {
		const { nodes } = createJourneyRoute({ items, ...geometry });
		for (const node of nodes) {
			expect(node.y).toBeGreaterThanOrEqual(0);
			expect(node.y).toBeLessThanOrEqual(geometry.height);
		}
	});

	it('emits a drawable path and survives an empty list', () => {
		expect(createJourneyRoute({ items, ...geometry }).path.startsWith('M')).toBe(true);
		expect(createJourneyRoute({ items: [], ...geometry }).nodes).toEqual([]);
	});
});

describe('markerAt', () => {
	it('lands on the route ends at 0 and 1', () => {
		expect(markerAt(geometry, 0).x).toBeCloseTo(16);
		expect(markerAt(geometry, 1).x).toBeCloseTo(224);
	});

	it('clamps out-of-range and non-finite progress', () => {
		expect(markerAt(geometry, -5).x).toBeCloseTo(16);
		expect(markerAt(geometry, 9).x).toBeCloseTo(224);
		expect(Number.isFinite(markerAt(geometry, Number.NaN).x)).toBe(true);
	});

	it('follows the same curve the nodes sit on', () => {
		const { nodes } = createJourneyRoute({ items, ...geometry });
		for (const node of nodes) {
			const marker = markerAt(geometry, node.t);
			expect(marker.x).toBeCloseTo(node.x, 5);
			expect(marker.y).toBeCloseTo(node.y, 5);
		}
	});

	it('reports a finite heading', () => {
		expect(Number.isFinite(markerAt(geometry, 0.5).angle)).toBe(true);
	});
});

describe('activeNodeIndex', () => {
	it('walks through every node as progress grows', () => {
		const { nodes } = createJourneyRoute({ items, ...geometry });
		expect(activeNodeIndex(nodes, 0)).toBe(0);
		expect(activeNodeIndex(nodes, 1)).toBe(nodes.length - 1);
		expect(activeNodeIndex(nodes, 0.34)).toBe(1);
	});

	it('never decreases while scrolling forward', () => {
		const { nodes } = createJourneyRoute({ items, ...geometry });
		let previous = 0;
		for (let t = 0; t <= 1.0001; t += 0.02) {
			const index = activeNodeIndex(nodes, t);
			expect(index).toBeGreaterThanOrEqual(previous);
			previous = index;
		}
	});

	it('handles an empty node list', () => {
		expect(activeNodeIndex([], 0.5)).toBe(0);
	});
});
