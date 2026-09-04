import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CinematicRig } from './CinematicRig.js';
import { ParticleSystem } from './ParticleSystem.js';
import { LabelSystem } from './LabelSystem.js';
import { setupEnvironmentAndMaterials, configurePhoneModel } from './modelPipeline.js';
import { directScene } from './scenes/sceneManager.js';
import { LAYERS } from '$lib/data/product.js';

const BG = 0x050609;

/**
 * @typedef {object} Hotspot
 * @property {string} key
 * @property {string} num
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {boolean} visible
 */

/**
 * @typedef {object} EngineOptions
 * @property {(progress: number) => void} [onProgress]
 * @property {(items: Hotspot[]) => void} [onHotspots]
 * @property {(error: unknown) => void} [onError]
 * @property {boolean} [reducedMotion]
 */

/**
 * Cinematic product scene.
 *
 * Owns the renderer, the camera rig, the phone model and the procedural
 * exploded-view layers. Scroll progress is pushed in from the outside via
 * `updateProgress`; everything else is driven by the internal render loop.
 */
export class PhoneSceneEngine {
	/**
	 * @param {HTMLElement} container
	 * @param {EngineOptions} [options]
	 */
	constructor(container, options = {}) {
		this.container = container;
		this.options = options;
		this.reducedMotion = Boolean(options.reducedMotion);
		this.disposed = false;
		this.visible = true;
		this.contextLost = false;
		this.modelReady = false;
		/** Id of the chapter currently being rendered, set by the scene director. */
		this.activeChapterId = '';

		/** @type {{ dispose?: () => void }[]} Tracked for explicit GPU disposal. */
		this.disposables = [];

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(BG);
		this.scene.fog = new THREE.FogExp2(BG, 0.075);

		const width = container.clientWidth || 1;
		const height = container.clientHeight || 1;

		this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
		this.rig = new CinematicRig(this.camera);

		this.renderer = new THREE.WebGLRenderer({
			powerPreference: 'high-performance',
			antialias: true,
			alpha: false
		});
		this.renderer.setSize(width, height);
		this.basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		this.pixelRatio = this.basePixelRatio;
		this.renderer.setPixelRatio(this.pixelRatio);
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.25;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		container.appendChild(this.renderer.domElement);
		this.renderer.domElement.setAttribute('aria-hidden', 'true');

		// Image-based lighting so titanium actually reads as metal.
		this.envTarget = setupEnvironmentAndMaterials(this.scene, this.renderer);

		this.particleSystem = new ParticleSystem(this.scene);
		this.labelSystem = new LabelSystem(this.camera, container);

		this.mainGroup = new THREE.Group();
		this.scene.add(this.mainGroup);

		this.basePhoneGroup = new THREE.Group();
		this.explodedGroup = new THREE.Group();
		this.mainGroup.add(this.basePhoneGroup, this.explodedGroup);

		/** @type {Record<string, THREE.Group>} */
		this.layers = {};
		for (const layer of LAYERS) {
			this.layers[layer.key] = new THREE.Group();
			this.explodedGroup.add(this.layers[layer.key]);
		}

		this.accentColorHex = 0xffffff;
		this.accentColor = new THREE.Color(0xffffff);
		this.scrollProgress = 0;
		/** @type {Record<string, THREE.ShaderMaterial>} */
		this.shaderMaterials = {};
		/** @type {Hotspot[]} */
		this.hotspots = [];

		const lights = this.initLights();
		this.keyLight = lights.keyLight;
		this.fillLight = lights.fillLight;
		this.backLight = lights.backLight;
		this.rimLight = lights.rimLight;

		this.buildProceduralExplodedLayers();
		this.loadBaseModel();
		this.bindEvents();

		this.clock = new THREE.Clock();
		/** @type {number[]} */
		this.fpsSamples = [];
		this.animate = this.animate.bind(this);
		this.reqId = requestAnimationFrame(this.animate);
	}

	/**
	 * Three-point studio lighting plus an accent rim light.
	 * Returning the lights (instead of assigning to `this` here) keeps the
	 * fields definitely-assigned for the type checker.
	 */
	initLights() {
		this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

		const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
		keyLight.position.set(3, 5, 4);

		const fillLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
		fillLight.position.set(-4, -2, -2);

		const backLight = new THREE.DirectionalLight(0xffffff, 1.8);
		backLight.position.set(0, 2, -4);

		// Accent rim light that tracks the current chapter colour.
		const rimLight = new THREE.PointLight(0x00f0ff, 0, 8);
		rimLight.position.set(0, 0, 2.4);

		this.scene.add(keyLight, fillLight, backLight, rimLight);

		return { keyLight, fillLight, backLight, rimLight };
	}

	loadBaseModel() {
		const loader = new GLTFLoader();
		// The shipped GLB is meshopt-compressed and quantised (EXT_meshopt_compression
		// + KHR_mesh_quantization), which cuts it from ~53 MB to ~1.6 MB.
		loader.setMeshoptDecoder(MeshoptDecoder);
		loader.load(
			`${import.meta.env.BASE_URL ?? '/'}models/nova_one.glb`.replace('//models', '/models'),
			(gltf) => {
				if (this.disposed) return;
				const model = configurePhoneModel(gltf.scene);
				model.traverse((child) => {
					if (!(/** @type {THREE.Mesh} */ (child).isMesh)) return;
					const mesh = /** @type {THREE.Mesh} */ (child);
					const source = /** @type {THREE.MeshStandardMaterial} */ (
						Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
					);

					// Upgrade the baked GLB material to a clearcoated physical one while
					// keeping its baked maps, so the finish tint modulates real texture
					// detail instead of replacing it with flat colour.
					const material = new THREE.MeshPhysicalMaterial({
						color: 0x4a4d56,
						map: source?.map ?? null,
						normalMap: source?.normalMap ?? null,
						metalnessMap: source?.metalnessMap ?? null,
						roughnessMap: source?.roughnessMap ?? null,
						metalness: 0.92,
						roughness: 0.28,
						clearcoat: 0.6,
						clearcoatRoughness: 0.2,
						envMapIntensity: 1.6
					});
					mesh.material = material;
					// `Material.dispose()` never touches textures, so track the reused maps
					// explicitly or the GLB's GPU textures outlive the page.
					this.disposeLater(
						source,
						material,
						material.map ?? undefined,
						material.normalMap ?? undefined,
						material.metalnessMap ?? undefined,
						material.roughnessMap ?? undefined
					);
				});

				this.basePhoneGroup.add(model);
				this.modelReady = true;
				this.options.onProgress?.(1);
			},
			(event) => {
				if (event.total > 0) {
					// Reserve the last 10% for first-frame compilation.
					this.options.onProgress?.(Math.min((event.loaded / event.total) * 0.9, 0.9));
				}
			},
			(error) => {
				this.options.onError?.(error);
				this.buildFallbackBasePhone();
			}
		);
	}

	/** Simple stand-in body so the page still works if the GLB fails. */
	buildFallbackBasePhone() {
		if (this.disposed) return;
		const geometry = new THREE.BoxGeometry(1.3, 2.7, 0.12);
		const material = new THREE.MeshPhysicalMaterial({
			color: 0x4a4d56,
			metalness: 0.9,
			roughness: 0.3,
			envMapIntensity: 1.5
		});
		this.basePhoneGroup.add(new THREE.Mesh(geometry, material));
		this.disposeLater(geometry, material);
		this.modelReady = true;
		this.options.onProgress?.(1);
	}

	buildProceduralExplodedLayers() {
		const width = 1.3;
		const height = 2.7;
		const thickness = 0.04;

		// 01 — sapphire glass
		const glassGeo = new THREE.PlaneGeometry(width, height);
		const glassMat = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,
			metalness: 0,
			roughness: 0.05,
			transmission: 0.92,
			thickness: 0.4,
			transparent: true,
			opacity: 0.4,
			side: THREE.DoubleSide
		});
		this.layers.glass.add(new THREE.Mesh(glassGeo, glassMat));
		this.disposeLater(glassGeo, glassMat);

		// 02 — OLED matrix (animated sweep)
		this.shaderMaterials.displayShader = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uScroll: { value: 0 },
				uAccent: { value: new THREE.Color(0x00f0ff) }
			},
			vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
			fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uScroll;
        uniform vec3 uAccent;
        varying vec2 vUv;

        void main() {
          vec3 bg = vec3(0.03, 0.05, 0.09);

          // Travelling scan line.
          float head = mod(uTime * 0.35 + uScroll, 1.4) - 0.2;
          float sweep = 1.0 - smoothstep(0.0, 0.05, abs(vUv.y - head));

          // Faint sub-pixel grid so the panel reads as a display.
          float grid = step(0.75, fract(vUv.x * 220.0)) * 0.05;

          // Soft vignette towards the bezel.
          vec2 c = vUv - 0.5;
          float vignette = 1.0 - smoothstep(0.35, 0.72, length(c));

          vec3 color = bg + sweep * uAccent * 0.9 + grid;
          gl_FragColor = vec4(color * vignette, 0.94);
        }
      `,
			transparent: true
		});
		const displayGeo = new THREE.PlaneGeometry(width * 0.95, height * 0.96);
		this.layers.display.add(new THREE.Mesh(displayGeo, this.shaderMaterials.displayShader));
		this.disposeLater(displayGeo, this.shaderMaterials.displayShader);

		// 03 — titanium chassis
		const frameGeo = new THREE.BoxGeometry(width, height, thickness);
		const frameMat = new THREE.MeshPhysicalMaterial({
			color: 0x5a5d65,
			metalness: 0.95,
			roughness: 0.25,
			envMapIntensity: 1.8
		});
		this.layers.frame.add(new THREE.Mesh(frameGeo, frameMat));
		this.disposeLater(frameGeo, frameMat);

		// 04 — penta camera array (was previously an empty group)
		const plateGeo = new THREE.BoxGeometry(width * 0.62, width * 0.62, 0.03);
		const plateMat = new THREE.MeshPhysicalMaterial({
			color: 0x24262b,
			metalness: 0.85,
			roughness: 0.35,
			envMapIntensity: 1.4
		});
		const plate = new THREE.Mesh(plateGeo, plateMat);
		plate.position.y = height * 0.28;
		this.layers.camera.add(plate);
		this.disposeLater(plateGeo, plateMat);

		const barrelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 32);
		const lensGeo = new THREE.SphereGeometry(0.105, 24, 16);
		const barrelMat = new THREE.MeshPhysicalMaterial({
			color: 0x101215,
			metalness: 0.9,
			roughness: 0.2
		});
		const lensMat = new THREE.MeshPhysicalMaterial({
			color: 0x0a1a24,
			metalness: 0.4,
			roughness: 0.05,
			clearcoat: 1,
			envMapIntensity: 2.2
		});
		this.disposeLater(barrelGeo, lensGeo, barrelMat, lensMat);

		const lensOffsets = [
			[-0.17, 0.17],
			[0.17, 0.17],
			[-0.17, -0.17],
			[0.17, -0.17],
			[0, 0]
		];
		for (const [x, y] of lensOffsets) {
			const barrel = new THREE.Mesh(barrelGeo, barrelMat);
			barrel.rotation.x = Math.PI / 2;
			barrel.position.set(x, height * 0.28 + y, 0.04);
			const lens = new THREE.Mesh(lensGeo, lensMat);
			lens.position.set(x, height * 0.28 + y, 0.06);
			this.layers.camera.add(barrel, lens);
		}

		// 05 — NPU logic board (animated traces)
		this.shaderMaterials.boardShader = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uScroll: { value: 0 },
				uAccent: { value: new THREE.Color(0x0088ff) }
			},
			vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
			fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uScroll;
        uniform vec3 uAccent;
        varying vec2 vUv;

        void main() {
          vec3 bg = vec3(0.03, 0.07, 0.14);

          // Static copper traces.
          float traceX = step(0.93, fract(vUv.x * 18.0));
          float traceY = step(0.95, fract(vUv.y * 9.0));
          float traces = max(traceX, traceY) * 0.35;

          // Data pulses running along the traces.
          float pulse = smoothstep(0.9, 1.0, sin(vUv.x * 12.0 - uTime * 2.4 + uScroll * 8.0));
          float die = 1.0 - smoothstep(0.16, 0.2, length(vUv - 0.5));

          vec3 color = bg + (traces + pulse * 0.8) * uAccent + die * uAccent * 0.45;
          gl_FragColor = vec4(color, 0.96);
        }
      `,
			transparent: true
		});
		const boardGeo = new THREE.PlaneGeometry(width * 0.9, height * 0.45);
		this.layers.board.add(new THREE.Mesh(boardGeo, this.shaderMaterials.boardShader));
		this.disposeLater(boardGeo, this.shaderMaterials.boardShader);

		// 06 — battery cell
		const cellGeo = new THREE.BoxGeometry(width * 0.85, height * 0.45, 0.03);
		const cellMat = new THREE.MeshPhysicalMaterial({
			color: 0x2f3138,
			metalness: 0.7,
			roughness: 0.4,
			envMapIntensity: 1.2
		});
		this.layers.battery.add(new THREE.Mesh(cellGeo, cellMat));
		this.disposeLater(cellGeo, cellMat);

		this.batteryGlowMat = new THREE.MeshBasicMaterial({
			color: 0xffaa00,
			transparent: true,
			opacity: 0
		});
		const glowGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.4);
		const glow = new THREE.Mesh(glowGeo, this.batteryGlowMat);
		glow.position.z = 0.03;
		this.layers.battery.add(glow);
		this.disposeLater(glowGeo, this.batteryGlowMat);

		this.explodedGroup.visible = false;
	}

	/** @param {...({ dispose?: () => void } | { dispose?: () => void }[] | undefined)} items */
	disposeLater(...items) {
		for (const item of items) {
			if (Array.isArray(item)) this.disposables.push(...item);
			else if (item) this.disposables.push(item);
		}
	}

	bindEvents() {
		this.onWindowResize = this.onWindowResize.bind(this);
		this.onVisibilityChange = this.onVisibilityChange.bind(this);
		this.onContextLost = this.onContextLost.bind(this);
		this.onContextRestored = this.onContextRestored.bind(this);

		window.addEventListener('resize', this.onWindowResize, { passive: true });
		document.addEventListener('visibilitychange', this.onVisibilityChange);
		this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
		this.renderer.domElement.addEventListener(
			'webglcontextrestored',
			this.onContextRestored,
			false
		);

		// Stop rendering entirely when the canvas is scrolled out of view.
		if ('IntersectionObserver' in window) {
			this.observer = new IntersectionObserver(
				([entry]) => {
					this.visible = entry.isIntersecting;
				},
				{ threshold: 0 }
			);
			this.observer.observe(this.renderer.domElement);
		}
	}

	onVisibilityChange() {
		// Avoid a huge delta spike after the tab comes back.
		if (!document.hidden) this.clock.getDelta();
	}

	/** @param {Event} event */
	onContextLost(event) {
		event.preventDefault();
		cancelAnimationFrame(this.reqId);
		this.contextLost = true;
	}

	onContextRestored() {
		this.contextLost = false;
		if (!this.disposed) this.reqId = requestAnimationFrame(this.animate);
	}

	onWindowResize() {
		const width = this.container.clientWidth || 1;
		const height = this.container.clientHeight || 1;
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}

	/**
	 * Push normalised cinematic progress (0..1) into the scene director.
	 * @param {number} progress
	 */
	updateProgress(progress) {
		this.scrollProgress = progress;
		directScene(this, progress);
	}

	/**
	 * Recolour the chassis when the configurator finish changes.
	 * @param {number} colorHex
	 */
	setMaterialFinish(colorHex) {
		this.basePhoneGroup.traverse((child) => {
			const mesh = /** @type {THREE.Mesh & {material?: THREE.MeshStandardMaterial}} */ (child);
			if (mesh.isMesh && mesh.material && 'color' in mesh.material) {
				mesh.material.color.setHex(colorHex);
			}
		});
		this.rig.triggerShake(this.reducedMotion ? 0 : 0.02);
	}

	/** Recompute 2D hotspot positions for the exploded-view callouts. */
	updateHotspots() {
		if (!this.explodedGroup.visible) {
			if (this.hotspots.length) this.hotspots = [];
			return;
		}

		const worldPosition = new THREE.Vector3();
		this.hotspots = LAYERS.map((layer) => {
			const group = this.layers[layer.key];
			group.getWorldPosition(worldPosition);
			const projected = this.labelSystem.projectToScreen(worldPosition);
			return { ...layer, x: projected.x, y: projected.y, visible: projected.visible };
		});
	}

	/** Drop pixel ratio if we are consistently missing frame budget.
	 * @param {number} delta seconds since the previous frame
	 */
	monitorPerformance(delta) {
		if (delta <= 0) return;
		this.fpsSamples.push(1 / delta);
		if (this.fpsSamples.length < 90) return;

		const average = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
		this.fpsSamples = [];

		if (average < 40 && this.pixelRatio > 1) {
			this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
			this.renderer.setPixelRatio(this.pixelRatio);
		} else if (average > 58 && this.pixelRatio < this.basePixelRatio) {
			this.pixelRatio = Math.min(this.basePixelRatio, this.pixelRatio + 0.25);
			this.renderer.setPixelRatio(this.pixelRatio);
		}
	}

	animate() {
		if (this.disposed) return;
		this.reqId = requestAnimationFrame(this.animate);

		const delta = Math.min(this.clock.getDelta(), 0.1);
		const elapsed = this.clock.getElapsedTime();

		if (document.hidden || !this.visible || this.contextLost) return;

		this.accentColor.setHex(this.accentColorHex);

		this.rig.update(this.scrollProgress, delta, this.reducedMotion ? 0 : elapsed);
		this.particleSystem.update(elapsed, this.accentColorHex, this.reducedMotion);

		this.rimLight.color.copy(this.accentColor);
		this.rimLight.intensity = THREE.MathUtils.lerp(
			this.rimLight.intensity,
			this.explodedGroup.visible ? 3.5 : 1.4,
			1 - Math.exp(-4 * delta)
		);
		this.fillLight.color.copy(this.accentColor);

		const display = this.shaderMaterials.displayShader;
		if (display) {
			display.uniforms.uTime.value = elapsed;
			display.uniforms.uAccent.value.copy(this.accentColor);
		}
		const board = this.shaderMaterials.boardShader;
		if (board) {
			board.uniforms.uTime.value = elapsed;
			board.uniforms.uAccent.value.copy(this.accentColor);
		}

		this.updateHotspots();
		this.options.onHotspots?.(this.hotspots);

		this.monitorPerformance(delta);
		this.renderer.render(this.scene, this.camera);
	}

	destroy() {
		this.disposed = true;
		cancelAnimationFrame(this.reqId);

		window.removeEventListener('resize', this.onWindowResize);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
		this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
		this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
		this.observer?.disconnect();

		for (const item of this.disposables) item.dispose?.();
		this.disposables = [];
		this.particleSystem.dispose();
		this.envTarget?.dispose();

		this.scene.traverse((child) => {
			const mesh = /** @type {THREE.Mesh} */ (child);
			if (!mesh.isMesh) return;
			mesh.geometry?.dispose();
			const material = mesh.material;
			if (Array.isArray(material)) material.forEach((m) => m.dispose());
			else material?.dispose();
		});

		if (this.renderer.domElement.parentNode === this.container) {
			this.container.removeChild(this.renderer.domElement);
		}
		this.renderer.dispose();
		this.renderer.forceContextLoss?.();
	}
}
