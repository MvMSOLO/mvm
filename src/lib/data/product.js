/**
 * Single source of truth for all NOVA ONE product content.
 * Sections, scene ranges, specs and pricing all derive from here so the
 * DOM, the progress rail and the 3D scene director can never drift apart.
 */

/**
 * Accent colours used by both CSS and the 3D scenes.
 * @type {Record<string, number>}
 */
export const ACCENTS = {
	white: 0xffffff,
	cyan: 0x00f0ff,
	violet: 0xaa00ff,
	electric: 0x0088ff,
	amber: 0xffaa00,
	mint: 0x00ffaa
};

/**
 * The eight cinematic chapters. `start`/`end` are normalised positions inside
 * the cinematic scroll region (NOT the whole document).
 * Each entry maps 1:1 to a <section> in the page and to a rail item.
 */
export const CHAPTERS = [
	{
		id: 'form',
		index: 1,
		rail: 'FORM',
		badge: '01 — FORM',
		title: 'THE NEXT FORM.',
		body: 'A single block of grade 5 titanium, micro-milled to 0.02 mm tolerance. No seams. No compromise.',
		accent: 'white',
		start: 0,
		end: 0.12
	},
	{
		id: 'display',
		index: 2,
		rail: 'DISPLAY',
		badge: '02 — DISPLAY',
		title: '120Hz PURE MOTION',
		body: 'Adaptive OLED panel with sub-millisecond pixel response. Per-unit factory colour calibration across the full DCI-P3 gamut.',
		accent: 'cyan',
		start: 0.12,
		end: 0.25,
		stats: [
			{ value: '1—120Hz', label: 'ADAPTIVE RANGE' },
			{ value: '2600', label: 'PEAK NITS' }
		]
	},
	{
		id: 'optics',
		index: 3,
		rail: 'OPTICS',
		badge: '03 — OPTICS',
		title: 'SEE MORE.',
		body: 'Five lens modules behind optical sapphire, including a 5x periscope. Sensor-shift stabilisation holds the frame still at 1/4 s.',
		accent: 'violet',
		start: 0.25,
		end: 0.35,
		callout: { value: '50 MP', label: 'PURE DETAIL SENSOR' }
	},
	{
		id: 'architecture',
		index: 4,
		rail: 'ARCHITECTURE',
		badge: '04 — ARCHITECTURE',
		title: 'PRECISION ENGINEERED',
		body: 'Six structural layers aligned on a rigid titanium spine. A vapour chamber runs the full length of the chassis for unrestricted thermal dispersal.',
		accent: 'cyan',
		start: 0.35,
		end: 0.53
	},
	{
		id: 'compute',
		index: 5,
		rail: 'NPU CORE',
		badge: '05 — COMPUTE ENGINE',
		title: '4nm NPU ARCHITECTURE',
		body: 'Dedicated matrix accelerators run neural inference on-device. Nothing leaves the phone, and nothing waits on a network.',
		accent: 'electric',
		start: 0.53,
		end: 0.67,
		stats: [
			{ value: '48 TOPS', label: 'NEURAL THROUGHPUT' },
			{ value: '4 nm', label: 'PROCESS NODE' }
		]
	},
	{
		id: 'energy',
		index: 6,
		rail: 'ENERGY',
		badge: '06 — ENERGY',
		title: '5000mAh ARCHITECTURE',
		body: 'A high-density silicon-carbon cell built for sustained GPU and NPU load. Adaptive charging protects capacity across 1000 cycles.',
		accent: 'amber',
		start: 0.67,
		end: 0.77,
		stats: [
			{ value: '5000', label: 'mAh CAPACITY' },
			{ value: '80%', label: 'IN 18 MINUTES' }
		]
	},
	{
		id: 'intelligence',
		index: 7,
		rail: 'AI MODEL',
		badge: '07 — INTELLIGENCE',
		title: 'ON-DEVICE REASONING',
		body: 'A 7-billion-parameter model resident in memory. Live translation, computational photography and semantic search with no round trip.',
		accent: 'mint',
		start: 0.77,
		end: 0.88
	},
	{
		id: 'reassembly',
		index: 8,
		rail: 'REASSEMBLY',
		badge: '08 — THE WHOLE',
		title: 'ONE OBJECT.',
		body: 'Every layer returns to its place. What remains is a single, quiet object that disappears into the hand.',
		accent: 'white',
		start: 0.88,
		end: 1
	}
];

/** Layer stack shown as a HUD during the exploded chapter. */
export const LAYERS = [
	{ key: 'glass', num: '01', name: 'SAPPHIRE GLASS' },
	{ key: 'display', num: '02', name: 'OLED MATRIX' },
	{ key: 'frame', num: '03', name: 'TITANIUM CHASSIS' },
	{ key: 'camera', num: '04', name: 'PENTA CAMERA' },
	{ key: 'board', num: '05', name: 'NPU LOGIC BOARD' },
	{ key: 'battery', num: '06', name: '5000mAh CELL' }
];

/** Configurator options. Price is base + finish + storage. */
export const MODELS = [
	{ id: 'NOVA ONE', price: 1099 },
	{ id: 'NOVA ONE PRO', price: 1399 }
];

export const FINISHES = [
	{ id: 'Titanium', hex: 0x4a4d56, css: '#6d7280', price: 0 },
	{ id: 'Obsidian', hex: 0x14171a, css: '#14171a', price: 0 },
	{ id: 'Silver', hex: 0xd0d5dd, css: '#d0d5dd', price: 50 }
];

export const STORAGE = [
	{ id: '256GB', price: 0 },
	{ id: '512GB', price: 120 },
	{ id: '1TB', price: 300 }
];

export const GALLERY = [
	{
		title: 'Chassis Engineering',
		desc: 'Grade 5 titanium frame, micro-milled and bead-blasted in a single pass.',
		meta: 'TITANIUM · 0.02mm'
	},
	{
		title: 'OLED Pure Motion',
		desc: 'A 120Hz adaptive panel with a 1.2 mm bezel on all four sides.',
		meta: 'DISPLAY · 6.8"'
	},
	{
		title: 'Penta Camera System',
		desc: 'A 50MP custom sensor paired with a 5x periscope and sapphire covers.',
		meta: 'OPTICS · 5 LENSES'
	},
	{
		title: 'Neural Compute Core',
		desc: 'A 4nm NPU engine dedicated to on-device inference workloads.',
		meta: 'SILICON · 48 TOPS'
	}
];

export const SPECS = [
	{ value: '6.8"', label: 'OLED PANEL' },
	{ value: '120Hz', label: 'REFRESH RATE' },
	{ value: '50 MP', label: 'MAIN SENSOR' },
	{ value: '5000mAh', label: 'BATTERY' },
	{ value: '1TB', label: 'MAX STORAGE' }
];

/**
 * Resolve the active chapter for a normalised cinematic progress value.
 * @param {number} progress 0..1
 */
export function chapterAt(progress) {
	for (const chapter of CHAPTERS) {
		if (progress < chapter.end) return chapter;
	}
	return CHAPTERS[CHAPTERS.length - 1];
}

/**
 * Local 0..1 progress inside a chapter.
 * @param {number} progress 0..1
 * @param {{start:number,end:number}} chapter
 */
export function localProgress(progress, chapter) {
	const span = chapter.end - chapter.start || 1;
	return Math.min(Math.max((progress - chapter.start) / span, 0), 1);
}
