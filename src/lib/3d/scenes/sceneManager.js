import * as THREE from 'three';
import { ACCENTS, CHAPTERS, chapterAt, localProgress } from '$lib/data/product.js';

/**
 * Target z-offsets per layer, expressed as multipliers of a single "gap"
 * value. Keeping them in one table means the exploded stack can never end up
 * with two layers fighting for the same depth.
 */
const STACK = {
	glass: 3.0,
	display: 2.0,
	frame: 0.5,
	camera: -0.5,
	board: -1.5,
	battery: -2.5
};

/** @param {number} current @param {number} target @param {number} t */
function approach(current, target, t) {
	return THREE.MathUtils.lerp(current, target, t);
}

const FRONT_MULTIPLIER = Math.max(...Object.values(STACK));

/**
 * Lay the six layers out along z from a single gap value, optionally pulling
 * one layer in front of the whole stack as the "hero" of the chapter.
 *
 * The hero offset is derived from the front-most stack position, so the hero
 * layer is always closest to the camera no matter how wide the gap is.
 *
 * @param {import('../phoneEngine.js').PhoneSceneEngine} engine
 * @param {number} gap
 * @param {{ hero?: keyof typeof STACK, lift?: number }} [focus]
 */
function layoutStack(engine, gap, focus = {}) {
	const heroZ = gap * FRONT_MULTIPLIER + (focus.lift ?? 0.35);

	for (const [key, multiplier] of Object.entries(STACK)) {
		const layer = engine.layers[key];
		if (!layer) continue;
		layer.position.z = key === focus.hero ? heroZ : gap * multiplier;
	}
}

/** @param {import('../phoneEngine.js').PhoneSceneEngine} engine */
function showAssembled(engine) {
	engine.basePhoneGroup.visible = true;
	engine.explodedGroup.visible = false;
}

/** @param {import('../phoneEngine.js').PhoneSceneEngine} engine */
function showExploded(engine) {
	engine.basePhoneGroup.visible = false;
	engine.explodedGroup.visible = true;
}

/** @type {Record<string, (engine: any, t: number) => void>} */
const DIRECTORS = {
	form(engine, t) {
		showAssembled(engine);
		engine.basePhoneGroup.rotation.y = t * Math.PI * 0.25;
		engine.basePhoneGroup.rotation.x = engine.reducedMotion
			? 0
			: Math.sin(engine.clock.getElapsedTime() * 0.5) * 0.02;
	},

	display(engine, t) {
		showAssembled(engine);
		engine.basePhoneGroup.rotation.y = (1 - t) * Math.PI * 0.25;
		engine.basePhoneGroup.rotation.x = 0;
		const shader = engine.shaderMaterials.displayShader;
		if (shader) shader.uniforms.uScroll.value = t;
	},

	optics(engine, t) {
		showAssembled(engine);
		// Rotate to the rear so the camera array faces the lens.
		engine.basePhoneGroup.rotation.y = Math.PI * (0.25 + t * 0.75);
	},

	architecture(engine, t) {
		showExploded(engine);
		const eased = THREE.MathUtils.smoothstep(t, 0, 1);
		layoutStack(engine, 0.55 * eased);
		engine.layers.glass.rotation.x = -0.05 * eased;
		engine.layers.display.rotation.x = -0.03 * eased;
		engine.explodedGroup.rotation.y = -0.35 * eased;
		if (engine.batteryGlowMat) engine.batteryGlowMat.opacity = 0;
	},

	compute(engine, t) {
		showExploded(engine);
		// Compress the stack and float the logic board out in front of it.
		layoutStack(engine, 0.5 * (1 - t * 0.35), { hero: 'board', lift: 0.3 + t * 0.5 });
		engine.explodedGroup.rotation.y = approach(-0.35, 0.15, t);
		const shader = engine.shaderMaterials.boardShader;
		if (shader) shader.uniforms.uScroll.value = t;
	},

	energy(engine, t) {
		showExploded(engine);
		layoutStack(engine, 0.35, { hero: 'battery', lift: 0.3 + t * 0.4 });
		engine.explodedGroup.rotation.y = approach(0.15, -0.1, t);
		if (engine.batteryGlowMat) {
			// Charge pulse that fades in with the chapter.
			const pulse = 0.5 + 0.5 * Math.sin(engine.clock.getElapsedTime() * 2.2);
			engine.batteryGlowMat.opacity = 0.12 * t * (engine.reducedMotion ? 1 : pulse);
		}
	},

	intelligence(engine, t) {
		showExploded(engine);
		layoutStack(engine, 0.25 + 0.25 * (1 - t), { hero: 'board', lift: 0.3 * (1 - t) + 0.05 });
		engine.explodedGroup.rotation.y = approach(-0.1, 0, t);
		if (engine.batteryGlowMat) engine.batteryGlowMat.opacity = 0;
	},

	reassembly(engine, t) {
		const eased = THREE.MathUtils.smoothstep(t, 0, 1);
		if (eased < 0.45) {
			// Collapse the stack back together before swapping to the solid model.
			showExploded(engine);
			layoutStack(engine, 0.25 * (1 - eased / 0.45));
			engine.explodedGroup.rotation.y = 0;
		} else {
			showAssembled(engine);
			const local = (eased - 0.45) / 0.55;
			engine.basePhoneGroup.rotation.y = (1 - local) * Math.PI * 0.4;
			engine.basePhoneGroup.rotation.x = 0;
		}
	}
};

/**
 * Single entry point: resolve the chapter, apply its accent colour and run
 * its director. Ranges live in the product data so the DOM and the 3D scene
 * stay in sync by construction.
 *
 * @param {import('../phoneEngine.js').PhoneSceneEngine} engine
 * @param {number} progress normalised 0..1 cinematic progress
 */
export function directScene(engine, progress) {
	const clamped = Math.min(Math.max(progress, 0), 1);
	const chapter = chapterAt(clamped);
	const t = localProgress(clamped, chapter);

	engine.accentColorHex = ACCENTS[chapter.accent] ?? ACCENTS.white;
	engine.activeChapterId = chapter.id;

	DIRECTORS[chapter.id]?.(engine, t);
}

/** Exposed for tests: the chapter ids the director knows how to render. */
export const DIRECTED_CHAPTERS = CHAPTERS.map((chapter) => chapter.id);
