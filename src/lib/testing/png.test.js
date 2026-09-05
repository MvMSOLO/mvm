import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from './png.js';
import { comparePixels } from './imageDiff.js';

/**
 * @param {number} width
 * @param {number} height
 */
function gradient(width, height) {
	const out = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const i = (y * width + x) * 4;
			out[i] = (x * 7) % 256;
			out[i + 1] = (y * 13) % 256;
			out[i + 2] = (x * y) % 256;
			out[i + 3] = 255;
		}
	}
	return out;
}

describe('png round trip', () => {
	it('decodes exactly what it encoded', () => {
		const pixels = gradient(19, 11);
		const decoded = decodePng(encodePng(pixels, 19, 11));
		expect(decoded.width).toBe(19);
		expect(decoded.height).toBe(11);
		expect(Array.from(decoded.data)).toEqual(Array.from(pixels));
	});

	it('feeds the differ directly, with no pixel drift', () => {
		const a = decodePng(encodePng(gradient(8, 8), 8, 8));
		const b = decodePng(encodePng(gradient(8, 8), 8, 8));
		expect(comparePixels(a.data, b.data).ratio).toBe(0);
	});

	it('rejects non-PNG input instead of returning noise', () => {
		expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/not a PNG/);
	});

	it('rejects unsupported bit depths', () => {
		const png = encodePng(gradient(4, 4), 4, 4);
		png[24] = 16; // IHDR bit depth byte
		expect(() => decodePng(png)).toThrow(/bit depth/);
	});
});
