import { describe, expect, it } from 'vitest';
import {
	brushedMetalRoughness,
	createRandom,
	glassSmudge,
	oledSubpixelGrid,
	toDataTexture
} from './textures.js';

describe('createRandom', () => {
	it('is deterministic for a seed, so screenshots stay comparable', () => {
		const a = createRandom(42);
		const b = createRandom(42);
		const first = [a(), a(), a()];
		expect([b(), b(), b()]).toEqual(first);
	});

	it('produces different streams for different seeds, inside [0,1)', () => {
		const a = createRandom(1);
		const b = createRandom(2);
		expect(a()).not.toBe(b());
		const random = createRandom(9);
		for (let i = 0; i < 500; i += 1) {
			const value = random();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe('brushedMetalRoughness', () => {
	it('fills a single-channel map of the requested size', () => {
		const map = brushedMetalRoughness({ size: 32 });
		expect(map).toMatchObject({ width: 32, height: 32, channels: 1 });
		expect(map.data).toHaveLength(32 * 32);
	});

	it('varies along the brush direction but stays near the base roughness', () => {
		const map = brushedMetalRoughness({ size: 64, base: 0.3 });
		const mean = map.data.reduce((sum, v) => sum + v, 0) / map.data.length / 255;
		expect(mean).toBeGreaterThan(0.2);
		expect(mean).toBeLessThan(0.42);
		const unique = new Set(map.data);
		expect(unique.size).toBeGreaterThan(20);
	});

	it('is reproducible for a seed and different across seeds', () => {
		const a = brushedMetalRoughness({ size: 16, seed: 3 });
		const b = brushedMetalRoughness({ size: 16, seed: 3 });
		const c = brushedMetalRoughness({ size: 16, seed: 4 });
		expect(Array.from(a.data)).toEqual(Array.from(b.data));
		expect(Array.from(a.data)).not.toEqual(Array.from(c.data));
	});
});

describe('glassSmudge', () => {
	it('leaves most of the glass perfectly clean', () => {
		const map = glassSmudge({ size: 64, smudges: 3, dust: 10, seed: 5 });
		const clean = map.data.filter((v) => v === 0).length / map.data.length;
		expect(clean).toBeGreaterThan(0.3);
	});

	it('does mark the glass: smudges and dust are present', () => {
		const map = glassSmudge({ size: 64, smudges: 4, dust: 50, seed: 11 });
		expect(Math.max(...map.data)).toBe(255);
		expect(map.data.some((v) => v > 0 && v < 255)).toBe(true);
	});

	it('produces nothing when asked for a spotless panel', () => {
		const map = glassSmudge({ size: 16, smudges: 0, dust: 0 });
		expect(Math.max(...map.data)).toBe(0);
	});
});

describe('oledSubpixelGrid', () => {
	it('lays out RGB stripes with a black matrix between rows', () => {
		const map = oledSubpixelGrid({ cells: 4, cellSize: 4 });
		expect(map).toMatchObject({ width: 16, height: 16, channels: 3 });
		// First pixel is a red subpixel.
		expect(Array.from(map.data.slice(0, 3))).toEqual([255, 0, 0]);
		// Last row of each cell is the matrix: fully black.
		const rowStart = 3 * 16 * 3;
		expect(Array.from(map.data.slice(rowStart, rowStart + 3))).toEqual([0, 0, 0]);
	});

	it('uses all three primaries', () => {
		const map = oledSubpixelGrid({ cells: 8, cellSize: 3 });
		let red = 0;
		let green = 0;
		let blue = 0;
		for (let i = 0; i < map.data.length; i += 3) {
			if (map.data[i]) red += 1;
			if (map.data[i + 1]) green += 1;
			if (map.data[i + 2]) blue += 1;
		}
		expect(red).toBeGreaterThan(0);
		expect(green).toBeGreaterThan(0);
		expect(blue).toBeGreaterThan(0);
	});
});

describe('toDataTexture', () => {
	it('tiles, mipmaps and flags itself for upload', () => {
		const texture = toDataTexture(brushedMetalRoughness({ size: 16 }), { repeat: 3 });
		expect(texture.repeat.x).toBe(3);
		expect(texture.generateMipmaps).toBe(true);
		expect(texture.version).toBeGreaterThan(0);
		expect(texture.image.width).toBe(16);
		texture.dispose();
	});

	it('tags colour data as sRGB and leaves data maps linear', () => {
		const colour = toDataTexture(oledSubpixelGrid({ cells: 4, cellSize: 3 }), { srgb: true });
		const data = toDataTexture(glassSmudge({ size: 16, smudges: 1, dust: 2 }));
		expect(colour.colorSpace).toBe('srgb');
		expect(data.colorSpace).not.toBe('srgb');
		colour.dispose();
		data.dispose();
	});
});
