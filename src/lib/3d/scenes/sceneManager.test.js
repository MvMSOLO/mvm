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

	return {
		layers,
		basePhoneGroup: new THREE.Group(),
		explodedGroup: new THREE.Group(),
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

	it('always shows exactly one of the assembled/exploded groups', () => {
		for (let p = 0; p <= 1.0001; p += 0.01) {
			directScene(engine, p);
			expect(engine.basePhoneGroup.visible !== engine.explodedGroup.visible).toBe(true);
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

	it('starts the architecture chapter fully collapsed', () => {
		const architecture = CHAPTERS.find((c) => c.id === 'architecture');
		directScene(engine, architecture.start);
		for (const layer of LAYERS) {
			expect(engine.layers[layer.key].position.z).toBeCloseTo(0, 5);
		}
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
		expect(engine.explodedGroup.visible).toBe(false);
	});

	it('collapses the stack before swapping models', () => {
		const reassembly = CHAPTERS.find((c) => c.id === 'reassembly');
		directScene(engine, reassembly.start + 0.005);
		expect(engine.explodedGroup.visible).toBe(true);
	});
});
