/**
 * Procedural micro-detail textures.
 *
 * What separates a render from a photograph is almost never the geometry — it
 * is the imperfection. Real titanium carries directional micro-scratches from
 * the polishing wheel, real glass carries fingerprint oil and dust, and a real
 * OLED panel has a visible subpixel lattice under a polarising film. All three
 * are generated here as data, seeded so every run (and every CI screenshot) is
 * identical, and unit-tested without touching WebGL.
 *
 * Everything below returns `{ width, height, channels, data }`; the thin THREE
 * wrappers at the bottom turn that into textures.
 */
import * as THREE from 'three';

/**
 * @typedef {object} TextureData
 * @property {number} width
 * @property {number} height
 * @property {number} channels
 * @property {Uint8Array} data
 */

/**
 * Deterministic 32-bit PRNG (mulberry32). Seeded so renders are reproducible;
 * Math.random would make visual-regression baselines meaningless.
 * @param {number} seed
 * @returns {() => number} Values in [0, 1).
 */
export function createRandom(seed = 1) {
	let state = seed >>> 0 || 1;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Brushed-metal roughness map: fine horizontal streaks with a slow large-scale
 * variation on top, so highlights break up the way they do on a real polished
 * chassis instead of sliding across a uniform surface.
 *
 * @param {object} [options]
 * @param {number} [options.size]
 * @param {number} [options.streaks] Streak density across the height.
 * @param {number} [options.strength] 0..1 contrast of the streaks.
 * @param {number} [options.base] Mean roughness, 0..1.
 * @param {number} [options.seed]
 * @returns {TextureData} Single-channel (red) data.
 */
export function brushedMetalRoughness({
	size = 256,
	streaks = 220,
	strength = 0.35,
	base = 0.28,
	seed = 7
} = {}) {
	const random = createRandom(seed);
	const data = new Uint8Array(size * size);

	// One random offset per row gives the directional "brushed" look; a second,
	// low-frequency term stops it looking like a barcode.
	const rowNoise = new Float32Array(size);
	for (let i = 0; i < size; i += 1) rowNoise[i] = random() * 2 - 1;

	for (let y = 0; y < size; y += 1) {
		const phase = (y / size) * streaks * Math.PI * 2;
		for (let x = 0; x < size; x += 1) {
			const fine = Math.sin(phase + rowNoise[y] * 3.1) * 0.5;
			const broad = Math.sin((x / size) * Math.PI * 4 + rowNoise[(y * 7) % size] * 2) * 0.25;
			const grit = (random() - 0.5) * 0.3;
			const value = base + (fine + broad + grit) * strength * 0.5;
			data[y * size + x] = clamp255(value * 255);
		}
	}

	return { width: size, height: size, channels: 1, data };
}

/**
 * Fingerprint / dust map for cover glass. Used as a clearcoat roughness map:
 * clean glass stays mirror-smooth, the smudged patches scatter.
 *
 * @param {object} [options]
 * @param {number} [options.size]
 * @param {number} [options.smudges] Number of oil patches.
 * @param {number} [options.dust] Number of dust specks.
 * @param {number} [options.seed]
 * @returns {TextureData}
 */
export function glassSmudge({ size = 256, smudges = 9, dust = 240, seed = 21 } = {}) {
	const random = createRandom(seed);
	const data = new Uint8Array(size * size); // 0 = perfectly smooth

	for (let i = 0; i < smudges; i += 1) {
		const cx = random() * size;
		const cy = random() * size;
		const radius = size * (0.05 + random() * 0.12);
		const peak = 90 + random() * 90;
		// Elliptical, because a fingertip is not a circle.
		const squash = 0.6 + random() * 0.8;

		const minY = Math.max(0, Math.floor(cy - radius));
		const maxY = Math.min(size - 1, Math.ceil(cy + radius));
		for (let y = minY; y <= maxY; y += 1) {
			for (let x = 0; x < size; x += 1) {
				const dx = (x - cx) / radius;
				const dy = (y - cy) / (radius * squash);
				const d = dx * dx + dy * dy;
				if (d > 1) continue;
				// Ridged falloff: real prints leave concentric ridges, not a blob.
				const ridge = 0.6 + 0.4 * Math.sin(Math.sqrt(d) * 26);
				const value = (1 - d) * peak * ridge;
				const index = y * size + x;
				if (value > data[index]) data[index] = clamp255(value);
			}
		}
	}

	for (let i = 0; i < dust; i += 1) {
		const x = Math.floor(random() * size);
		const y = Math.floor(random() * size);
		data[y * size + x] = 255;
	}

	return { width: size, height: size, channels: 1, data };
}

/**
 * OLED subpixel lattice. At normal zoom it reads as the faint texture you see
 * on a phone screen under a macro lens; it also breaks up the emissive panel so
 * it stops looking like a flat coloured rectangle.
 *
 * @param {object} [options]
 * @param {number} [options.cells] Subpixel triads across the texture.
 * @param {number} [options.cellSize] Pixels per triad.
 * @returns {TextureData} RGB data.
 */
export function oledSubpixelGrid({ cells = 64, cellSize = 4 } = {}) {
	const size = cells * cellSize;
	const data = new Uint8Array(size * size * 3);

	for (let y = 0; y < size; y += 1) {
		const rowGap = y % cellSize === cellSize - 1; // black matrix between rows
		for (let x = 0; x < size; x += 1) {
			const stripe = Math.floor((x % cellSize) / Math.max(cellSize / 3, 1));
			const i = (y * size + x) * 3;
			if (rowGap) continue; // leaves 0,0,0
			if (stripe === 0) data[i] = 255;
			else if (stripe === 1) data[i + 1] = 255;
			else data[i + 2] = 255;
		}
	}

	return { width: size, height: size, channels: 3, data };
}

/**
 * @param {number} value
 * @returns {number}
 */
function clamp255(value) {
	return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

/**
 * Wrap generated data in a tiling THREE texture.
 *
 * @param {TextureData} source
 * @param {object} [options]
 * @param {number} [options.repeat]
 * @param {boolean} [options.srgb] Colour data (not a data map).
 * @returns {THREE.DataTexture}
 */
export function toDataTexture(source, { repeat = 1, srgb = false } = {}) {
	// WebGL2 dropped three-channel byte textures, so RGB data is expanded to RGBA.
	let { data, channels } = source;
	if (channels === 3) {
		const rgba = new Uint8Array((data.length / 3) * 4);
		for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
			rgba[o] = data[i];
			rgba[o + 1] = data[i + 1];
			rgba[o + 2] = data[i + 2];
			rgba[o + 3] = 255;
		}
		data = rgba;
		channels = 4;
	}

	const format = channels === 1 ? THREE.RedFormat : THREE.RGBAFormat;
	const texture = new THREE.DataTexture(data, source.width, source.height, format);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeat, repeat);
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = true;
	if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}
