import { describe, it, expect } from 'vitest';
import {
	ACCENTS,
	CHAPTERS,
	FINISHES,
	GALLERY,
	LAYERS,
	MODELS,
	SPECS,
	STORAGE,
	chapterAt,
	localProgress
} from './product.js';

describe('product data integrity', () => {
	it('defines eight chapters with unique ids', () => {
		expect(CHAPTERS).toHaveLength(8);
		const ids = new Set(CHAPTERS.map((c) => c.id));
		expect(ids.size).toBe(8);
	});

	it('covers the full 0..1 range with no gaps or overlaps', () => {
		expect(CHAPTERS[0].start).toBe(0);
		expect(CHAPTERS.at(-1).end).toBe(1);

		for (let i = 0; i < CHAPTERS.length - 1; i++) {
			expect(CHAPTERS[i].end).toBe(CHAPTERS[i + 1].start);
			expect(CHAPTERS[i].end).toBeGreaterThan(CHAPTERS[i].start);
		}
	});

	it('numbers chapters sequentially', () => {
		CHAPTERS.forEach((chapter, index) => {
			expect(chapter.index).toBe(index + 1);
		});
	});

	it('only references known accent colours', () => {
		for (const chapter of CHAPTERS) {
			expect(ACCENTS).toHaveProperty(chapter.accent);
		}
	});

	it('ships six exploded layers with unique keys', () => {
		expect(LAYERS).toHaveLength(6);
		expect(new Set(LAYERS.map((l) => l.key)).size).toBe(6);
	});

	it('has non-empty configurator, gallery and spec tables', () => {
		expect(MODELS.length).toBeGreaterThan(0);
		expect(FINISHES.length).toBeGreaterThan(0);
		expect(STORAGE.length).toBeGreaterThan(0);
		expect(GALLERY.length).toBeGreaterThan(0);
		expect(SPECS.length).toBeGreaterThan(0);
	});

	it('prices every configurator option', () => {
		for (const option of [...MODELS, ...FINISHES, ...STORAGE]) {
			expect(typeof option.price).toBe('number');
			expect(option.price).toBeGreaterThanOrEqual(0);
		}
	});
});

describe('chapterAt', () => {
	it('returns the first chapter at zero', () => {
		expect(chapterAt(0).id).toBe(CHAPTERS[0].id);
	});

	it('returns the last chapter at one', () => {
		expect(chapterAt(1).id).toBe(CHAPTERS.at(-1).id);
	});

	it('never returns undefined across the range', () => {
		for (let p = 0; p <= 1.0001; p += 0.01) {
			expect(chapterAt(p)).toBeDefined();
		}
	});

	it('resolves boundary values to the following chapter', () => {
		const boundary = CHAPTERS[1].start;
		expect(chapterAt(boundary).id).toBe(CHAPTERS[1].id);
	});
});

describe('localProgress', () => {
	it('maps chapter start to 0 and end to 1', () => {
		const chapter = CHAPTERS[3];
		expect(localProgress(chapter.start, chapter)).toBe(0);
		expect(localProgress(chapter.end, chapter)).toBe(1);
	});

	it('clamps values outside the chapter', () => {
		const chapter = CHAPTERS[3];
		expect(localProgress(0, chapter)).toBe(0);
		expect(localProgress(1, chapter)).toBe(1);
	});

	it('returns the midpoint for a mid-chapter value', () => {
		const chapter = CHAPTERS[1];
		const mid = (chapter.start + chapter.end) / 2;
		expect(localProgress(mid, chapter)).toBeCloseTo(0.5, 5);
	});
});
