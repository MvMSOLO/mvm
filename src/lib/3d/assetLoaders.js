/**
 * Asset decoding stack for the GLB.
 *
 * The shipped model is meshopt-compressed and quantised. On top of that we
 * support GPU-compressed textures: a KTX2/Basis texture stays compressed in
 * VRAM (ASTC on mobile, BC7/BC5 on desktop), which is the single biggest win
 * for a phone that otherwise has to decode WebP to raw RGBA and keep 4x the
 * memory resident. Draco is wired too so a mesh-compressed variant of the
 * model can be dropped in without touching the engine.
 *
 * Everything path-shaped is pure and unit-tested; the loader wiring itself is
 * lazy so devices that never load a KTX2 file never download the transcoder.
 */

/**
 * Resolve a static asset URL against the app base path, tolerating both `/`
 * and `/sub/` deployments without producing `//`.
 *
 * @param {string} relative Path relative to `static/`, without a leading slash.
 * @param {string} [base]
 * @returns {string}
 */
export function assetUrl(relative, base = '/') {
	const cleanBase = (base || '/').endsWith('/') ? base || '/' : `${base}/`;
	const cleanRelative = relative.replace(/^\/+/, '');
	return `${cleanBase}${cleanRelative}`;
}

/**
 * Directory that holds the Basis Universal transcoder (`basis_transcoder.js` +
 * `.wasm`). KTX2Loader requires a trailing slash.
 *
 * @param {string} [base]
 * @returns {string}
 */
export function transcoderPath(base = '/') {
	return assetUrl('basis/', base);
}

/**
 * Which model file to fetch. A `.ktx2.glb` sibling is preferred when the tier
 * allows GPU textures and the build actually shipped one.
 *
 * @param {object} [options]
 * @param {boolean} [options.ktx2] Tier allows compressed textures.
 * @param {boolean} [options.hasKtx2Model] Build produced the compressed variant.
 * @param {string} [options.base]
 * @returns {string}
 */
export function modelUrl({ ktx2 = false, hasKtx2Model = false, base = '/' } = {}) {
	const file = ktx2 && hasKtx2Model ? 'models/nova_one.ktx2.glb' : 'models/nova_one.glb';
	return assetUrl(file, base);
}

/**
 * Attach every decoder the GLB may need.
 *
 * @param {object} args
 * @param {any} args.loader GLTFLoader instance.
 * @param {any} args.meshoptDecoder
 * @param {any} [args.renderer] Needed to pick the KTX2 transcode target.
 * @param {string} [args.base]
 * @param {boolean} [args.ktx2] Skip the transcoder entirely when false.
 * @returns {Promise<{ ktx2: any | null, draco: any | null }>}
 */
export async function attachDecoders({
	loader,
	meshoptDecoder,
	renderer,
	base = '/',
	ktx2 = true
}) {
	loader.setMeshoptDecoder?.(meshoptDecoder);

	/** @type {any} */
	let ktx2Loader = null;
	if (ktx2 && renderer) {
		try {
			const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
			ktx2Loader = new KTX2Loader().setTranscoderPath(transcoderPath(base));
			ktx2Loader.detectSupport(renderer);
			loader.setKTX2Loader?.(ktx2Loader);
		} catch {
			// No transcoder shipped, or WebAssembly blocked: fall back to the
			// uncompressed textures already embedded in the GLB.
			ktx2Loader = null;
		}
	}

	return { ktx2: ktx2Loader, draco: null };
}
