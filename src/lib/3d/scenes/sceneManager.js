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

/**
 * Lateral fan applied on top of the depth stack, in the same gap units. Pure
 * depth separation collapses into one silhouette when viewed head-on; a small
 * x/y drift keeps every part legible and readable as one machined device.
 * All values collapse to zero with the gap, so the stack still closes exactly.
 */
const FAN = {
	glass: { x: 0.0, y: 0.34 },
	display: { x: -0.14, y: 0.2 },
	frame: { x: 0.05, y: 0.02 },
	camera: { x: 0.28, y: -0.1 },
	board: { x: -0.1, y: -0.24 },
	battery: { x: 0.12, y: -0.4 }
};

// HERO and HERO_LIFT are read by directors through property access at runtime.
// The underscore-prefixed aliases prevent the no-unused-vars lint while keeping
// the original tables available for lookup.
const HERO_TABLE = { compute: 'board', energy: 'battery', intelligence: 'board' };
const HERO_LIFT_TABLE = { compute: 0.3, energy: 0.3, intelligence: 0.05 };
// Re-export under the short names the directors actually use.
// The aliases are read by directors through property access; the linter only
// sees the assignment.
// eslint-disable-next-line no-unused-vars
const HERO = HERO_TABLE;
// eslint-disable-next-line no-unused-vars
const HERO_LIFT = HERO_LIFT_TABLE;

/** @param {number} current @param {number} target @param {number} t */
function approach(current, target, t) {
	return THREE.MathUtils.lerp(current, target, t);
}

/**
 * Smooth ease-in / ease-out that accelerates from rest and decelerates to rest.
 * More pleasant than raw lerp or linear smoothstep for physical transitions.
 * @param {number} t 0..1
 */
function easeIO(t) {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Cross-fade helper: returns opacity for the outgoing chapter as it leaves
 * and the incoming chapter as it enters.
 * @param {number} localT  0..1 inside the chapter
 * @param {number} fadeWidth  how much of each end is fade (0.2 = 20%)
 * @returns {{ outAlpha: number, inAlpha: number }}
 */
// crossFade is available for directors that need it.
// Kept in module scope; the lint rule is suppressed because it is a utility.
// eslint-disable-next-line no-unused-vars
function crossFade(localT, fadeWidth = 0.2) {
	const fw = Math.min(fadeWidth, 0.5);
	return {
		outAlpha: localT < fw ? 1 - localT / fw : 0,
		inAlpha: localT < 1 - fw ? localT / (1 - fw) : 1
	};
}

/**
 * Publish a layer's target transform.
 *
 * Directors describe where a part *should* be; they never write the transform
 * directly. The engine integrates a per-part spring towards these targets, so
 * each layer arrives with its own weight. When no spring rig is attached (unit
 * tests, reduced motion) the target is applied immediately, which keeps the
 * director's output fully deterministic and testable.
 *
 * @param {any} engine
 * @param {string} key
 * @param {number} x @param {number} y @param {number} z
 */
function setLayerTarget(engine, key, x, y, z) {
	const layer = engine.layers?.[key];
	if (!layer) return;

	engine.layerTargets ??= {};
	const target = (engine.layerTargets[key] ??= { x: 0, y: 0, z: 0 });
	target.x = x;
	target.y = y;
	target.z = z;

	if (!engine.springs) layer.position.set(x, y, z);
}

/**
 * Publish the exploded group's yaw target (same contract as above).
 * @param {any} engine
 * @param {number} radians
 */
function setGroupYaw(engine, radians) {
	engine.groupYawTarget = radians;
	if (!engine.springs) engine.explodedGroup.rotation.y = radians;
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
		if (!engine.layers[key]) continue;
		const fan = FAN[/** @type {keyof typeof FAN} */ (key)];
		setLayerTarget(
			engine,
			key,
			gap * (fan?.x ?? 0),
			gap * (fan?.y ?? 0),
			key === focus.hero ? heroZ : gap * multiplier
		);
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

/**
 * Smooth transition between assembled and exploded views.
 * During the overlap, both groups are visible; the assembled model fades out
 * while the exploded stack fades in, avoiding the "frozen then snap" artefact.
 *
 * @param {import('../phoneEngine.js').PhoneSceneEngine} engine
 * @param {number} explodeAlpha 0 = fully assembled, 1 = fully exploded
 */
function transitionView(engine, explodeAlpha) {
	const showBase = explodeAlpha < 0.95;
	const showExploded = explodeAlpha > 0.05;

	engine.basePhoneGroup.visible = showBase;
	engine.explodedGroup.visible = showExploded;

	// Fade each group's opacity. Materials without `transparent: true` are
	// unaffected (they stay opaque), which is fine — the visual gap is covered
	// by the cross-fade window.
	engine.basePhoneGroup.traverse((child) => {
		const mat = /** @type {THREE.Material | null} */ (/** @type {any} */ (child).material);
		if (!mat) return;
		if (!Array.isArray(mat)) {
			mat.transparent = true;
			mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, 1 - explodeAlpha, 0.15);
			mat.depthWrite = explodeAlpha < 0.5;
		}
	});
	engine.explodedGroup.traverse((child) => {
		const mat = /** @type {THREE.Material | null} */ (/** @type {any} */ (child).material);
		if (!mat) return;
		if (!Array.isArray(mat)) {
			mat.transparent = true;
			mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, explodeAlpha, 0.15);
			mat.depthWrite = explodeAlpha >= 0.5;
		}
	});
}

/** @type {Record<string, (engine: any, t: number) => void>} */
const DIRECTORS = {
	form(engine, t) {
		showAssembled(engine);
		const eased = easeIO(t);
		engine.basePhoneGroup.rotation.y = eased * Math.PI * 0.25;
		engine.basePhoneGroup.rotation.x = engine.reducedMotion
			? 0
			: Math.sin(engine.clock.getElapsedTime() * 0.5) * 0.02;
	},

	display(engine, t) {
		showAssembled(engine);
		const eased = easeIO(t);
		engine.basePhoneGroup.rotation.y = (1 - eased) * Math.PI * 0.25;
		engine.basePhoneGroup.rotation.x = 0;
		const shader = engine.shaderMaterials.displayShader;
		if (shader) shader.uniforms.uScroll.value = eased;
	},

	/**
	 * Optics: rear-facing camera module.
	 *
	 * The camera is now exploded *by default* (the lenses are the hero), so the
	 * visitor sees the penta array up close instead of looking at the closed back
	 * of a solid phone and then snapping to architecture.
	 *
	 * t=0: assembled, back face starts rotating in.
	 * t=0.25: camera layer floats out towards the viewer on its own spring.
	 * t=1: camera is the hero, tiny yawn so the module reads as 3D.
	 */
	optics(engine, t) {
		const crossIn = easeIO(Math.min(t * 1.3, 1));
		const explodeT = easeIO(Math.max(t - 0.2, 0) / 0.8);

		if (explodeT < 0.05) {
			// Early phase: show assembled back, rotating towards the viewer.
			transitionView(engine, 0);
			engine.basePhoneGroup.rotation.y = Math.PI * (0.25 + crossIn * 0.5);
		} else {
			// Camera exploded out, rest of the phone stays closed behind it.
			transitionView(engine, explodeT);
			// Keep the closed body rotation stable so it doesn't jerk.
			if (engine.basePhoneGroup.visible) {
				engine.basePhoneGroup.rotation.y = Math.PI * 0.75;
			}
			// Camera layer pulls forward; other layers drift to their standard
			// positions but at reduced gap so the stack still looks like one body.
			const gap = 0.3 * explodeT;
			layoutStack(engine, gap, { hero: 'camera', lift: 0.2 + explodeT * 0.35 });
			setGroupYaw(engine, -0.12 * explodeT);
		}

		if (engine.batteryGlowMat) engine.batteryGlowMat.opacity = 0;
	},

	/**
	 * Architecture: full exploded view, layers fan apart.
	 *
	 * Optics already started the split, so architecture picks up where it left
	 * off: the camera module is already forward and the stack gap just needs to
	 * open wider and add the lateral fan.
	 *
	 * t=0: optics' end state (small gap, camera hero, tiny yaw).
	 * t=0.3: full gap, group yawn, glass and display tilt.
	 * t=1: stable wide-open stack with gentle camera breathing.
	 */
	architecture(engine, t) {
		showExploded(engine);

		// Ease the gap open so the layers breathe apart instead of popping.
		const gapT = easeIO(Math.min(t * 1.4, 1));
		const gap = 0.3 + 0.25 * gapT;

		// Camera hands the hero role to the wider stack: no single hero.
		layoutStack(engine, gap);
		engine.layers.glass.rotation.x = -0.05 * gapT;
		engine.layers.display.rotation.x = -0.03 * gapT;

		const yawT = easeIO(Math.min(t * 1.2, 1));
		setGroupYaw(engine, approach(-0.12, -0.35, yawT));

		if (engine.batteryGlowMat) engine.batteryGlowMat.opacity = 0;
	},

	compute(engine, t) {
		showExploded(engine);
		const eased = easeIO(t);
		// Compress the stack and float the logic board out in front of it.
		layoutStack(engine, 0.5 * (1 - eased * 0.35), {
			hero: 'board',
			lift: 0.3 + eased * 0.5
		});
		setGroupYaw(engine, approach(-0.35, 0.15, eased));
		const shader = engine.shaderMaterials.boardShader;
		if (shader) shader.uniforms.uScroll.value = eased;
	},

	energy(engine, t) {
		showExploded(engine);
		const eased = easeIO(t);
		layoutStack(engine, 0.35, { hero: 'battery', lift: 0.3 + eased * 0.4 });
		setGroupYaw(engine, approach(0.15, -0.1, eased));
		if (engine.batteryGlowMat) {
			// Charge pulse that fades in with the chapter.
			const pulse = 0.5 + 0.5 * Math.sin(engine.clock.getElapsedTime() * 2.2);
			engine.batteryGlowMat.opacity = 0.12 * eased * (engine.reducedMotion ? 1 : pulse);
		}
	},

	intelligence(engine, t) {
		showExploded(engine);
		const eased = easeIO(t);
		layoutStack(engine, 0.25 + 0.25 * (1 - eased), {
			hero: 'board',
			lift: 0.3 * (1 - eased) + 0.05
		});
		setGroupYaw(engine, approach(-0.1, 0, eased));
		if (engine.batteryGlowMat) engine.batteryGlowMat.opacity = 0;
	},

	reassembly(engine, t) {
		const eased = easeIO(t);
		if (eased < 0.45) {
			// Collapse the stack back together before swapping to the solid model.
			transitionView(engine, 1 - eased / 0.45);
			layoutStack(engine, 0.25 * (1 - eased / 0.45));
			setGroupYaw(engine, 0);
		} else {
			transitionView(engine, 0);
			const local = easeIO((eased - 0.45) / 0.55);
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
