import { describe, it, expect } from 'vitest';
import {
	BUDGETS,
	budgetFor,
	detectTier,
	adaptTier,
	shiftTier,
	readGpuName,
	collectSignals
} from './qualityTier.js';

describe('detectTier', () => {
	it('sends software rasterisers to the low tier', () => {
		const budget = detectTier({ gpu: 'Google SwiftShader', cores: 8, memory: 8 });
		expect(budget.tier).toBe('low');
		expect(budget.postFx).toBe(false);
		expect(budget.pixelRatio).toBe(1);
	});

	it('gives a desktop workstation the full chain', () => {
		const budget = detectTier({ gpu: 'NVIDIA GeForce RTX 4070', cores: 16, memory: 32 });
		expect(budget.tier).toBe('high');
		expect(budget.grade).toBe(true);
		expect(budget.maxFps).toBe(0);
	});

	it('keeps an unknown mid-range device on the mid tier', () => {
		expect(detectTier({ gpu: 'Mesa Intel UHD Graphics', cores: 4, memory: 8 }).tier).toBe('mid');
	});

	it('penalises phones: same GPU class, lower tier on a touch device', () => {
		const desktop = detectTier({ gpu: 'Apple M2', cores: 8, memory: 8 });
		const phone = detectTier({
			gpu: 'Apple A15 GPU',
			cores: 6,
			memory: 4,
			coarsePointer: true
		});
		expect(desktop.tier).toBe('high');
		expect(phone.tier).toBe('mid');
	});

	it('never spends the top budget when reduced motion is requested', () => {
		const budget = detectTier({
			gpu: 'NVIDIA GeForce RTX 4090',
			cores: 24,
			memory: 64,
			reducedMotion: true
		});
		expect(budget.tier).toBe('mid');
	});

	it('drops a tier for a huge surface at the same GPU class', () => {
		const small = detectTier({ gpu: 'Apple M1', cores: 8, memory: 16, screenPixels: 2_000_000 });
		const huge = detectTier({ gpu: 'Apple M1', cores: 8, memory: 16, screenPixels: 12_000_000 });
		expect(small.tier).toBe('high');
		expect(huge.tier).toBe('mid');
	});

	it('falls back to mid with no signals at all', () => {
		expect(detectTier().tier).toBe('mid');
	});

	it('returns a complete budget for every tier', () => {
		for (const tier of /** @type {const} */ (['low', 'mid', 'high'])) {
			const budget = budgetFor(tier);
			expect(Object.keys(BUDGETS[tier]).every((key) => key in budget)).toBe(true);
			expect(budget.pixelRatio).toBeGreaterThan(0);
			expect(budget.particles).toBeGreaterThan(0);
		}
	});

	it('budgets are monotonic: higher tier is never cheaper', () => {
		expect(BUDGETS.low.pixelRatio).toBeLessThanOrEqual(BUDGETS.mid.pixelRatio);
		expect(BUDGETS.mid.pixelRatio).toBeLessThanOrEqual(BUDGETS.high.pixelRatio);
		expect(BUDGETS.low.particles).toBeLessThan(BUDGETS.high.particles);
	});

	it('coerces an unknown tier name to mid instead of crashing', () => {
		expect(budgetFor(/** @type {any} */ ('ultra')).tier).toBe('mid');
	});
});

describe('adaptTier', () => {
	it('steps down when frames are being missed', () => {
		expect(adaptTier('high', 28)).toBe('mid');
		expect(adaptTier('mid', 20)).toBe('low');
	});

	it('never steps below low', () => {
		expect(adaptTier('low', 5)).toBe('low');
	});

	it('steps up only with real headroom', () => {
		expect(adaptTier('mid', 45)).toBe('mid');
		expect(adaptTier('mid', 59)).toBe('high');
	});

	it('has hysteresis: 40 fps neither promotes nor demotes', () => {
		expect(adaptTier('mid', 40)).toBe('mid');
	});

	it('ignores garbage measurements', () => {
		expect(adaptTier('high', 0)).toBe('high');
		expect(adaptTier('high', Number.NaN)).toBe('high');
	});

	it('shiftTier clamps at both ends', () => {
		expect(shiftTier('high', 1)).toBe('high');
		expect(shiftTier('low', -1)).toBe('low');
	});
});

describe('readGpuName', () => {
	it('prefers the unmasked renderer string', () => {
		const gl = /** @type {any} */ ({
			getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 37446 }),
			getParameter: (/** @type {number} */ p) => (p === 37446 ? 'Apple M3 Pro' : 'WebKit WebGL')
		});
		expect(readGpuName(gl)).toBe('Apple M3 Pro');
	});

	it('falls back to RENDERER, and to empty on failure', () => {
		const plain = /** @type {any} */ ({
			RENDERER: 1,
			getExtension: () => null,
			getParameter: () => 'Mesa'
		});
		expect(readGpuName(plain)).toBe('Mesa');
		expect(readGpuName(null)).toBe('');
		expect(
			readGpuName(
				/** @type {any} */ ({
					getExtension() {
						throw new Error('blocked');
					}
				})
			)
		).toBe('');
	});
});

describe('collectSignals', () => {
	it('works in the test environment without throwing', () => {
		const signals = collectSignals(null);
		expect(typeof signals).toBe('object');
	});
});
