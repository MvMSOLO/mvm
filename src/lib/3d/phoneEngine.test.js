import { describe, it, expect } from 'vitest';
import { PhoneSceneEngine } from './phoneEngine.js';
import { LAYERS } from '$lib/data/product.js';

// WebGL isn't available under jsdom, so this suite covers the module contract
// rather than live rendering. Scene logic is tested via sceneManager.test.js
// against a stub engine.
describe('PhoneSceneEngine module contract', () => {
	it('exports a constructible class', () => {
		expect(typeof PhoneSceneEngine).toBe('function');
		expect(PhoneSceneEngine.prototype.constructor).toBe(PhoneSceneEngine);
	});

	it('declares the public API the page relies on', () => {
		for (const method of [
			'updateProgress',
			'setMaterialFinish',
			'updateHotspots',
			'monitorPerformance',
			'destroy'
		]) {
			expect(typeof PhoneSceneEngine.prototype[method]).toBe('function');
		}
	});

	it('covers every documented layer in the product data', () => {
		expect(LAYERS.map((l) => l.key)).toEqual([
			'glass',
			'display',
			'frame',
			'camera',
			'board',
			'battery'
		]);
	});
});
