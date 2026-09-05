import { describe, expect, it, vi } from 'vitest';
import { assetUrl, attachDecoders, modelUrl, transcoderPath } from './assetLoaders.js';

describe('assetUrl', () => {
	it('joins root deployments without doubling the slash', () => {
		expect(assetUrl('models/nova_one.glb', '/')).toBe('/models/nova_one.glb');
		expect(assetUrl('/models/nova_one.glb', '/')).toBe('/models/nova_one.glb');
	});

	it('respects a sub-path deployment', () => {
		expect(assetUrl('basis/', '/nova/')).toBe('/nova/basis/');
		expect(assetUrl('basis/', '/nova')).toBe('/nova/basis/');
	});
});

describe('transcoderPath', () => {
	it('keeps the trailing slash KTX2Loader requires', () => {
		expect(transcoderPath('/')).toBe('/basis/');
		expect(transcoderPath('/app/')).toBe('/app/basis/');
	});
});

describe('modelUrl', () => {
	it('uses the compressed variant only when tier and build both allow it', () => {
		expect(modelUrl({ ktx2: true, hasKtx2Model: true })).toBe('/models/nova_one.ktx2.glb');
		expect(modelUrl({ ktx2: true, hasKtx2Model: false })).toBe('/models/nova_one.glb');
		expect(modelUrl({ ktx2: false, hasKtx2Model: true })).toBe('/models/nova_one.glb');
		expect(modelUrl()).toBe('/models/nova_one.glb');
	});
});

describe('attachDecoders', () => {
	it('always wires meshopt, and skips the transcoder when ktx2 is off', async () => {
		const loader = { setMeshoptDecoder: vi.fn(), setKTX2Loader: vi.fn() };
		const decoder = {};
		const result = await attachDecoders({ loader, meshoptDecoder: decoder, ktx2: false });
		expect(loader.setMeshoptDecoder).toHaveBeenCalledWith(decoder);
		expect(loader.setKTX2Loader).not.toHaveBeenCalled();
		expect(result.ktx2).toBeNull();
	});

	it('skips the transcoder without a renderer to probe for support', async () => {
		const loader = { setMeshoptDecoder: vi.fn(), setKTX2Loader: vi.fn() };
		const result = await attachDecoders({ loader, meshoptDecoder: {}, ktx2: true });
		expect(loader.setKTX2Loader).not.toHaveBeenCalled();
		expect(result.ktx2).toBeNull();
	});

	it('survives a loader that predates meshopt support', async () => {
		await expect(attachDecoders({ loader: {}, meshoptDecoder: {} })).resolves.toBeTruthy();
	});
});
