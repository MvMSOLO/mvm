import { describe, expect, it, vi } from 'vitest';
import { detectArMode, launchAr, sceneViewerUrl } from './ar.js';

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1';

describe('detectArMode', () => {
	it('sends iOS to AR Quick Look', () => {
		expect(detectArMode({ userAgent: IPHONE })).toBe('quick-look');
	});

	it('treats touch-capable "Macintosh" as iPadOS', () => {
		expect(detectArMode({ userAgent: MAC, maxTouchPoints: 5 })).toBe('quick-look');
		expect(detectArMode({ userAgent: MAC, maxTouchPoints: 0 })).toBeNull();
	});

	it('prefers WebXR on Android when available, Scene Viewer otherwise', () => {
		expect(detectArMode({ userAgent: ANDROID, webxr: true })).toBe('webxr');
		expect(detectArMode({ userAgent: ANDROID })).toBe('scene-viewer');
	});

	it('returns null for a plain desktop browser', () => {
		expect(detectArMode({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)' })).toBeNull();
	});
});

describe('sceneViewerUrl', () => {
	it('encodes the model and a browser fallback', () => {
		const url = sceneViewerUrl({
			modelUrl: 'https://nova.example/models/nova_one.glb',
			fallbackUrl: 'https://nova.example/'
		});
		expect(url.startsWith('intent://arvr.google.com/scene-viewer/1.0?')).toBe(true);
		expect(url).toContain('mode=ar_preferred');
		expect(url).toContain(encodeURIComponent('https://nova.example/'));
		expect(url.endsWith(';end;')).toBe(true);
	});
});

describe('launchAr', () => {
	it('does nothing when the platform has no AR mode', async () => {
		const open = vi.fn();
		await expect(launchAr({ mode: null, open })).resolves.toEqual({ launched: false, mode: null });
		expect(open).not.toHaveBeenCalled();
	});

	it('opens Scene Viewer with the GLB on Android', async () => {
		const open = vi.fn();
		const result = await launchAr({
			mode: 'scene-viewer',
			modelUrl: 'https://nova.example/models/nova_one.glb',
			open
		});
		expect(result.launched).toBe(true);
		expect(open).toHaveBeenCalledTimes(1);
		expect(open.mock.calls[0][0]).toContain('scene-viewer');
	});

	it('refuses Quick Look without a scene to export', async () => {
		const open = vi.fn();
		const result = await launchAr({ mode: 'quick-look', getScene: () => null, open });
		expect(result.launched).toBe(false);
		expect(open).not.toHaveBeenCalled();
	});
});
