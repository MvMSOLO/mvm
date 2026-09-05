/**
 * "View in your space" — augmented reality hand-off.
 *
 * There is no single AR standard, so we route per platform, exactly like
 * Apple's and Samsung's own product pages do:
 *  - iOS / Safari  -> USDZ + AR Quick Look (`<a rel="ar">`)
 *  - Android / Chrome -> Scene Viewer intent with the GLB
 *  - WebXR-capable browsers -> immersive-ar session (handled by the engine)
 *
 * The USDZ is generated in the browser from the live scene, so it always
 * matches the finish the visitor configured, and nothing is downloaded on
 * platforms that cannot use it.
 */

/**
 * @typedef {'quick-look' | 'scene-viewer' | 'webxr' | null} ArMode
 */

/**
 * Decide the AR strategy from the user agent, with an optional WebXR hint.
 *
 * @param {object} [signals]
 * @param {string} [signals.userAgent]
 * @param {boolean} [signals.webxr] navigator.xr present.
 * @param {number} [signals.maxTouchPoints] Distinguishes iPadOS from macOS.
 * @returns {ArMode}
 */
export function detectArMode({ userAgent = '', webxr = false, maxTouchPoints = 0 } = {}) {
	const ua = userAgent.toLowerCase();
	const iPadOs = ua.includes('macintosh') && maxTouchPoints > 1;
	if (/iphone|ipad|ipod/.test(ua) || iPadOs) return 'quick-look';
	if (ua.includes('android')) return webxr ? 'webxr' : 'scene-viewer';
	if (webxr) return 'webxr';
	return null;
}

/**
 * Build the Android Scene Viewer intent URL.
 *
 * @param {object} args
 * @param {string} args.modelUrl Absolute https URL of the GLB.
 * @param {string} [args.title]
 * @param {string} [args.fallbackUrl] Where to send users without Scene Viewer.
 * @returns {string}
 */
export function sceneViewerUrl({ modelUrl, title = 'NOVA ONE', fallbackUrl = '' }) {
	const params = new URLSearchParams({
		file: modelUrl,
		mode: 'ar_preferred',
		title,
		resizable: 'false'
	});
	const fallback = fallbackUrl || modelUrl;
	return (
		`intent://arvr.google.com/scene-viewer/1.0?${params.toString()}` +
		'#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;' +
		`S.browser_fallback_url=${encodeURIComponent(fallback)};end;`
	);
}

/**
 * Export an Object3D to a USDZ blob URL for AR Quick Look.
 * The exporter is imported lazily: it is only ever fetched on iOS.
 *
 * @param {import('three').Object3D} object
 * @returns {Promise<string>} Blob URL of the `.usdz`.
 */
export async function exportUsdz(object) {
	const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
	const exporter = new USDZExporter();
	const payload = await exporter.parseAsync(object);
	const blob = new Blob([payload], { type: 'model/vnd.usdz+zip' });
	return URL.createObjectURL(blob);
}

/**
 * Launch AR for the current platform.
 *
 * @param {object} args
 * @param {ArMode} args.mode
 * @param {() => import('three').Object3D | null | undefined} [args.getScene] Source for the USDZ.
 * @param {string} [args.modelUrl] Absolute GLB URL for Scene Viewer.
 * @param {string} [args.title]
 * @param {(url: string, filename: string) => void} [args.open] Injectable for tests.
 * @returns {Promise<{ launched: boolean, mode: ArMode, url?: string }>}
 */
export async function launchAr({ mode, getScene, modelUrl = '', title = 'NOVA ONE', open }) {
	const navigate =
		open ??
		((/** @type {string} */ url, /** @type {string} */ filename) => {
			const link = document.createElement('a');
			link.href = url;
			if (filename) link.download = filename;
			// AR Quick Look only triggers when the anchor advertises rel="ar" and
			// contains an <img> child, so Safari knows it is a 3D affordance.
			if (mode === 'quick-look') {
				link.rel = 'ar';
				link.appendChild(document.createElement('img'));
			}
			link.style.display = 'none';
			document.body.appendChild(link);
			link.click();
			link.remove();
		});

	if (mode === 'quick-look') {
		const scene = getScene?.();
		if (!scene) return { launched: false, mode };
		const url = await exportUsdz(scene);
		navigate(url, 'nova-one.usdz');
		return { launched: true, mode, url };
	}

	if (mode === 'scene-viewer') {
		if (!modelUrl) return { launched: false, mode };
		const url = sceneViewerUrl({ modelUrl, title });
		navigate(url, '');
		return { launched: true, mode, url };
	}

	return { launched: false, mode };
}
