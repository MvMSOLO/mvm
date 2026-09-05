import { describe, expect, it } from 'vitest';
import { comparePixels, summarise } from './imageDiff.js';

/**
 * @param {number} pixels
 * @param {[number, number, number, number]} rgba
 */
function fill(pixels, rgba) {
	const out = new Uint8Array(pixels * 4);
	for (let i = 0; i < pixels; i += 1) out.set(rgba, i * 4);
	return out;
}

describe('comparePixels', () => {
	it('reports zero difference for identical buffers', () => {
		const a = fill(100, [10, 20, 30, 255]);
		const result = comparePixels(a, a.slice());
		expect(result).toMatchObject({ changed: 0, total: 100, ratio: 0, pass: true });
	});

	it('ignores sub-threshold noise, which is what anti-aliasing produces', () => {
		const a = fill(100, [100, 100, 100, 255]);
		const b = fill(100, [108, 94, 103, 255]);
		expect(comparePixels(a, b).changed).toBe(0);
		expect(comparePixels(a, b, { threshold: 2 }).changed).toBe(100);
	});

	it('fails once the changed share exceeds tolerance', () => {
		const a = fill(1000, [0, 0, 0, 255]);
		const b = a.slice();
		for (let i = 0; i < 10; i += 1) b.set([255, 255, 255, 255], i * 4);
		const result = comparePixels(a, b, { tolerance: 0.005 });
		expect(result.changed).toBe(10);
		expect(result.ratio).toBeCloseTo(0.01, 5);
		expect(result.pass).toBe(false);
		expect(comparePixels(a, b, { tolerance: 0.02 }).pass).toBe(true);
	});

	it('can emit a highlight mask', () => {
		const a = fill(2, [0, 0, 0, 255]);
		const b = a.slice();
		b.set([255, 255, 255, 255], 0);
		const result = comparePixels(a, b, { mask: true });
		expect(result.mask?.slice(0, 4)).toEqual(new Uint8Array([255, 0, 90, 255]));
		expect(result.mask?.[7]).toBe(255);
	});

	it('throws on mismatched dimensions instead of silently passing', () => {
		expect(() => comparePixels(fill(4, [0, 0, 0, 255]), fill(5, [0, 0, 0, 255]))).toThrow(
			/size mismatch/
		);
	});
});

describe('summarise', () => {
	it('collects failures and formats one line per shot', () => {
		const report = summarise([
			{ name: '01-form', result: { changed: 0, total: 10, ratio: 0, pass: true } },
			{ name: '02-display', result: { changed: 5, total: 10, ratio: 0.5, pass: false } },
			{ name: '03-optics', result: null, error: 'missing baseline' }
		]);
		expect(report.pass).toBe(false);
		expect(report.failures).toEqual(['02-display', '03-optics']);
		expect(report.lines).toHaveLength(3);
		expect(report.lines[0]).toContain('ok');
		expect(report.lines[2]).toContain('missing baseline');
	});
});
