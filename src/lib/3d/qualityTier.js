/**
 * Device quality tiering.
 *
 * The old engine gave every device the same workload and only reacted *after*
 * frames were already being dropped. That is backwards: a mid-range phone
 * should never be asked to composite a bloom chain at 3x pixel ratio in the
 * first place. This module decides the budget up front from cheap signals
 * (GPU string, core count, memory, input type), and then lets the measured
 * frame rate move the device between tiers at runtime.
 *
 * Everything here is pure: no WebGL, no DOM. That is what makes it testable.
 */

/**
 * @typedef {'low' | 'mid' | 'high'} Tier
 *
 * @typedef {object} TierBudget
 * @property {Tier} tier
 * @property {number} pixelRatio      Hard cap on renderer pixel ratio.
 * @property {boolean} postFx         Load the post-processing chain at all.
 * @property {boolean} bloom
 * @property {boolean} grade           Grain / vignette / chromatic aberration.
 * @property {number} maxFps           Frame pacing cap (0 = uncapped).
 * @property {number} particles        Particle count multiplier.
 * @property {number} curveSegments    Geometry smoothness multiplier.
 * @property {number} envIntensity     Reflection strength multiplier.
 */

/** @type {Record<Tier, Omit<TierBudget, 'tier'>>} */
export const BUDGETS = {
	low: {
		pixelRatio: 1,
		postFx: false,
		bloom: false,
		grade: false,
		maxFps: 30,
		particles: 0.25,
		curveSegments: 0.5,
		envIntensity: 0.8
	},
	mid: {
		pixelRatio: 1.5,
		postFx: true,
		bloom: true,
		grade: false,
		maxFps: 60,
		particles: 0.6,
		curveSegments: 1,
		envIntensity: 1
	},
	high: {
		pixelRatio: 2,
		postFx: true,
		bloom: true,
		grade: true,
		maxFps: 0,
		particles: 1,
		curveSegments: 1.5,
		envIntensity: 1.15
	}
};

const TIER_ORDER = /** @type {Tier[]} */ (['low', 'mid', 'high']);

/** GPU substrings that reliably mean "do not attempt post-processing". */
const WEAK_GPU = [
	'swiftshader',
	'software',
	'basic render',
	'llvmpipe',
	'mali-4',
	'mali-t',
	'adreno (tm) 3',
	'adreno (tm) 4',
	'adreno (tm) 5',
	'powervr sgx',
	'intel(r) hd graphics 3',
	'intel(r) hd graphics 4'
];

/** GPU substrings that are safe for the full chain. */
const STRONG_GPU = [
	'apple m',
	'apple a1',
	'apple a2',
	'rtx',
	'radeon rx',
	'arc a',
	'geforce gtx 1'
];

/**
 * @typedef {object} DeviceSignals
 * @property {string} [gpu]            UNMASKED_RENDERER_WEBGL string.
 * @property {number} [cores]          navigator.hardwareConcurrency.
 * @property {number} [memory]         navigator.deviceMemory in GB.
 * @property {boolean} [coarsePointer] matchMedia('(pointer: coarse)').
 * @property {boolean} [reducedMotion]
 * @property {number} [screenPixels]   width * height * dpr of the viewport.
 */

/**
 * Pick a starting tier from device signals.
 * @param {DeviceSignals} [signals]
 * @returns {TierBudget}
 */
export function detectTier(signals = {}) {
	const gpu = (signals.gpu ?? '').toLowerCase();
	const cores = signals.cores ?? 4;
	const memory = signals.memory ?? 4;

	let score = 0;

	const weakGpu = Boolean(gpu) && WEAK_GPU.some((needle) => gpu.includes(needle));
	if (gpu && STRONG_GPU.some((needle) => gpu.includes(needle))) score += 2;

	if (cores >= 8) score += 1;
	else if (cores <= 3) score -= 1;

	if (memory >= 8) score += 1;
	else if (memory <= 2) score -= 2;

	// A coarse pointer is the most reliable "this is a phone" signal, and phones
	// pay for every extra fullscreen pass twice over (thermals).
	if (signals.coarsePointer) score -= 1;

	/** @type {Tier} */
	let tier = score >= 2 ? 'high' : score <= -2 ? 'low' : 'mid';

	// A known-weak GPU is decisive: no amount of CPU cores makes a software
	// rasteriser or a 2015 mobile GPU able to composite fullscreen passes.
	if (weakGpu) tier = 'low';

	// Fullscreen passes are fill-rate bound, so a 6K+ surface is capped to the
	// mid budget however fast the GPU is: 4x the pixels beats any core count.
	if ((signals.screenPixels ?? 0) > 6_000_000 && tier === 'high') tier = 'mid';

	// Reduced motion means the user asked for calm, not for a heavier GPU load:
	// never spend budget on effects they did not want.
	if (signals.reducedMotion && tier === 'high') tier = 'mid';

	return budgetFor(tier);
}

/**
 * @param {Tier} tier
 * @returns {TierBudget}
 */
export function budgetFor(tier) {
	const base = BUDGETS[tier] ?? BUDGETS.mid;
	return { tier: BUDGETS[tier] ? tier : 'mid', ...base };
}

/**
 * Move one step down / up the tier ladder.
 * @param {Tier} tier
 * @param {-1 | 1} direction
 * @returns {Tier}
 */
export function shiftTier(tier, direction) {
	const index = TIER_ORDER.indexOf(tier);
	const next = Math.min(TIER_ORDER.length - 1, Math.max(0, (index < 0 ? 1 : index) + direction));
	return TIER_ORDER[next];
}

/**
 * Runtime adaptation: given the average fps of the last window, decide whether
 * the device should change tier. Hysteresis is deliberately wide so the page
 * never oscillates between two visual looks while you scroll.
 *
 * @param {Tier} tier
 * @param {number} averageFps
 * @returns {Tier}
 */
export function adaptTier(tier, averageFps) {
	if (!Number.isFinite(averageFps) || averageFps <= 0) return tier;
	if (averageFps < 34) return shiftTier(tier, -1);
	if (averageFps > 58 && tier !== 'high') return shiftTier(tier, 1);
	return tier;
}

/**
 * Read the real GPU string from a WebGL context, if the browser exposes it.
 * @param {WebGLRenderingContext | WebGL2RenderingContext | null | undefined} gl
 * @returns {string}
 */
export function readGpuName(gl) {
	if (!gl) return '';
	try {
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
		return String(gl.getParameter(gl.RENDERER) ?? '');
	} catch {
		return '';
	}
}

/**
 * Collect signals from the current browser. Safe to call during SSR: every
 * lookup is guarded and falls back to the mid-tier defaults.
 * @param {WebGLRenderingContext | WebGL2RenderingContext | null} [gl]
 * @returns {DeviceSignals}
 */
export function collectSignals(gl = null) {
	if (typeof navigator === 'undefined' || typeof window === 'undefined') return {};
	const nav = /** @type {Navigator & { deviceMemory?: number }} */ (navigator);
	const dpr = window.devicePixelRatio || 1;
	return {
		gpu: readGpuName(gl),
		cores: nav.hardwareConcurrency,
		memory: nav.deviceMemory,
		coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
		reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
		screenPixels: window.innerWidth * window.innerHeight * dpr * dpr
	};
}
