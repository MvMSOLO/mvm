import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { directScene, DIRECTED_CHAPTERS } from './sceneManager.js';
import { ACCENTS, CHAPTERS, LAYERS } from '$lib/data/product.js';

/**
 * Minimal stand-in for PhoneSceneEngine — just the surface the scene
 * director touches. Keeps these tests free of WebGL.
 */
function createStubEngine() {
	/** @type {Record<string, THREE.Group>} */
	const layers = {};
	for (const layer of LAYERS) layers[layer.key] = new THREE.Group();

	// Assembled model: give it a basic material so the cross-fade opacity
	// code has something to traverse.
	const assembledMesh = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshStandardMaterial({ color: 0x666666, transparent: true, opacity: 1 })
	);

	return {
		layers,
		basePhoneGroup: new THREE.Group().add(assembledMesh),
		explodedGroup: new THREE.Group(
			new THREE.Mesh(
				new THREE.BoxGeometry(1, 1, 1),
				new THREE.MeshStandardMaterial({ color: 0x444444, transparent: true, opacity: 1 })
			)
		),
		shaderMaterials: {
			displayShader: { uniforms: { uScroll: { value: 0 } } },
			boardShader: { uniforms: { uScroll: { value: 0 } } }
		},
		batteryGlowMat: { opacity: 0 },
		clock: { getElapsedTime: () => 1.25 },
		reducedMotion: true,
		accentColorHex: 0,
		activeChapterId: ''
	};
}

/** @type {ReturnType<typeof createStubEngine>} */
let engine;

beforeEach(() => {
	engine = createStubEngine();
});

describe('directScene coverage', () => {
	it('knows a director for every chapter', () => {
		expect(DIRECTED_CHAPTERS).toEqual(CHAPTERS.map((c) => c.id));
	});

	it('sets a valid accent for every position in the range', () => {
		const validAccents = Object.values(ACCENTS);
		for (let p = 0; p <= 1.0001; p += 0.02) {
			directScene(engine, p);
			expect(validAccents).toContain(engine.accentColorHex);
		}
	});

	it('never hides both groups at the same time', () => {
		for (let p = 0; p <= 1.0001; p += 0.01) {
			directScene(engine, p);
			expect(engine.basePhoneGroup.visible || engine.explodedGroup.visible).toBe(true);
		}
	});

	it('clamps out-of-range progress instead of throwing', () => {
		expect(() => directScene(engine, -0.5)).not.toThrow();
		expect(engine.activeChapterId).toBe(CHAPTERS[0].id);

		expect(() => directScene(engine, 1.5)).not.toThrow();
		expect(engine.activeChapterId).toBe(CHAPTERS.at(-1).id);
	});

	it('produces finite layer positions everywhere', () => {
		for (let p = 0; p <= 1.0001; p += 0.02) {
			directScene(engine, p);
			for (const layer of LAYERS) {
				expect(Number.isFinite(engine.layers[layer.key].position.z)).toBe(true);
			}
		}
	});
});

describe('exploded chapter behaviour', () => {
	it('separates every layer to a distinct depth when fully exploded', () => {
		const architecture = CHAPTERS.find((c) => c.id === 'architecture');
		directScene(engine, architecture.end - 1e-6);

		const depths = LAYERS.map((l) => engine.layers[l.key].position.z);
		expect(new Set(depths).size).toBe(depths.length);
		expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(1);
	});

	it('starts the architecture chapter nearly collapsed (gap inherits from optics)', () => {
		const architecture = CHAPTERS.find((c) => c.id === 'architecture');
		directScene(engine, architecture.start);
		// Optics already opened a small gap; architecture inherits it rather than
		// starting from zero, so there is no freeze-snap.
		const range =
			Math.max(...LAYERS.map((l) => engine.layers[l.key].position.z)) -
			Math.min(...LAYERS.map((l) => engine.layers[l.key].position.z));
		expect(range).toBeGreaterThan(0);
	});

	it('pulls the logic board forward during the compute chapter', () => {
		const compute = CHAPTERS.find((c) => c.id === 'compute');
		directScene(engine, (compute.start + compute.end) / 2);
		const board = engine.layers.board.position.z;
		for (const layer of LAYERS) {
			if (layer.key === 'board') continue;
			expect(board).toBeGreaterThan(engine.layers[layer.key].position.z - 1e-9);
		}
	});

	it('only lights the battery glow during the energy chapter', () => {
		const energy = CHAPTERS.find((c) => c.id === 'energy');
		directScene(engine, (energy.start + energy.end) / 2);
		expect(engine.batteryGlowMat.opacity).toBeGreaterThan(0);

		directScene(engine, CHAPTERS.find((c) => c.id === 'intelligence').start + 0.01);
		expect(engine.batteryGlowMat.opacity).toBe(0);
	});

	it('pulls the camera module forward during the optics chapter', () => {
		const optics = CHAPTERS.find((c) => c.id === 'optics');
		directScene(engine, optics.end - 1e-6);
		const camera = engine.layers.camera.position.z;
		// Camera should be the forward-most layer in optics.
		for (const layer of LAYERS) {
			if (layer.key === 'camera') continue;
			expect(camera).toBeGreaterThan(engine.layers[layer.key].position.z - 0.05);
		}
	});
});

describe('shader uniforms', () => {
	it('drives the display sweep during the display chapter', () => {
		const display = CHAPTERS.find((c) => c.id === 'display');
		directScene(engine, display.end - 1e-6);
		expect(engine.shaderMaterials.displayShader.uniforms.uScroll.value).toBeCloseTo(1, 3);
	});

	it('drives the board pulse during the compute chapter', () => {
		const compute = CHAPTERS.find((c) => c.id === 'compute');
		directScene(engine, compute.end - 1e-6);
		expect(engine.shaderMaterials.boardShader.uniforms.uScroll.value).toBeCloseTo(1, 3);
	});
});

describe('reassembly chapter', () => {
	it('ends on the solid model', () => {
		directScene(engine, 1);
		expect(engine.basePhoneGroup.visible).toBe(true);
	});

	it('shows the exploded stack at the start of reassembly', () => {
		const reassembly = CHAPTERS.find((c) => c.id === 'reassembly');
		directScene(engine, reassembly.start + 0.005);
		expect(engine.explodedGroup.visible).toBe(true);
	});
});
