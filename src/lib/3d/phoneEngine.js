import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createPostChain } from './postFx.js';
import { attachDecoders, modelUrl } from './assetLoaders.js';
import { brushedMetalRoughness, glassSmudge, oledSubpixelGrid, toDataTexture } from './textures.js';
import { detectArMode, launchAr } from './ar.js';
import { detectTier, collectSignals, adaptTier, budgetFor } from './qualityTier.js';
import { CinematicRig } from './CinematicRig.js';
import { ParticleSystem } from './ParticleSystem.js';
import { LabelSystem } from './LabelSystem.js';
import { setupEnvironmentAndMaterials, configurePhoneModel } from './modelPipeline.js';
import {
	PHONE,
	createSlabGeometry,
	createRailGeometry,
	createChipLayout,
	createLensLayout,
	createContactShadow,
	createGrilleLayout,
	createScrewLayout,
	createAntennaLines,
	createButtonLayout,
	createPortShape,
	createCameraPlateau,
	createFlexCableGeometry,
	createLensProfile,
	createApertureBladeLayout,
	createPunchHoleLayout,
	createMicSlotLayout,
	createPcbTraceLayout,
	createCoilSpiral,
	createSimTray,
	createBatteryTabs,
	createDisplayStack,
	createTapticEngine
} from './partsFactory.js';
import { directScene } from './scenes/sceneManager.js';
import {
	SPRINGS,
	createSpring,
	createVectorSpring,
	stepSpring,
	stepVectorSpring
} from './spring.js';
import { LAYERS } from '$lib/data/product.js';

const BG = 0x050609;

/** Which spring preset each layer moves with: this is the parts list's "mass". */
/** @type {Record<string, import('./spring.js').SpringConfig>} */
const LAYER_SPRING = {
	glass: SPRINGS.light,
	display: SPRINGS.light,
	frame: SPRINGS.solid,
	camera: SPRINGS.solid,
	board: SPRINGS.solid,
	battery: SPRINGS.heavy
};

/**
 * `?quality=low|mid|high` forces a tier. Used by QA and by the screenshot
 * harness, which runs on a software rasteriser and would otherwise always be
 * classified as low-end.
 * @returns {import('./qualityTier.js').Tier | null}
 */
function readQualityOverride() {
	if (typeof window === 'undefined') return null;
	try {
		const value = new URLSearchParams(window.location.search).get('quality');
		return value === 'low' || value === 'mid' || value === 'high' ? value : null;
	} catch {
		return null;
	}
}

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
 * @property {(budget: import('./qualityTier.js').TierBudget) => void} [onTier]
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
		/** Resolved URL of the model actually being loaded. @type {string} */
		this.modelUrl = '';
		/** Lazily created asset decoders. @type {{ ktx2: any, draco: any } | null} */
		this.decoders = null;

		// Scratch objects for the per-frame subject measurement (no allocations
		// inside the render loop).
		this.subjectBox = new THREE.Box3();
		this.subjectSphere = new THREE.Sphere();

		this.renderer = new THREE.WebGLRenderer({
			powerPreference: 'high-performance',
			antialias: true,
			alpha: false
		});
		this.renderer.setSize(width, height);

		// Decide the budget BEFORE building anything: a mid-range phone should never
		// be asked to composite a bloom chain at 3x pixel ratio and only get rescued
		// afterwards by dropping resolution.
		this.budget = detectTier({
			...collectSignals(this.renderer.getContext()),
			reducedMotion: this.reducedMotion
		});
		const override = readQualityOverride();
		if (override) this.budget = budgetFor(override);
		this.options.onTier?.(this.budget);

		this.basePixelRatio = Math.min(window.devicePixelRatio || 1, this.budget.pixelRatio);
		this.pixelRatio = this.basePixelRatio;
		this.renderer.setPixelRatio(this.pixelRatio);
		// AgX keeps saturated accents (the cyan UI glow) from clipping to white the
		// way ACES does, and rolls highlights off closer to a real camera sensor.
		this.renderer.toneMapping = THREE.AgXToneMapping;
		this.renderer.toneMappingExposure = 1.5;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		container.appendChild(this.renderer.domElement);
		this.renderer.domElement.setAttribute('aria-hidden', 'true');

		// Image-based lighting so titanium actually reads as metal.
		this.envTarget = setupEnvironmentAndMaterials(this.scene, this.renderer);

		// Post-processing is code-split: on the low tier the composer, the bloom
		// pass and the grade shader are never even downloaded.
		/** @type {import('./postFx.js').PostChain | null} */
		this.post = null;
		if (this.budget.postFx) this.initPostProcessing(width, height);

		this.particleSystem = new ParticleSystem(this.scene, Math.round(320 * this.budget.particles));
		this.labelSystem = new LabelSystem(this.camera, container);

		/** @type {THREE.RectAreaLight[]} */
		this.softboxes = [];
		this.averageFps = 0;
		this.frameAccumulator = 0;

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

		// Per-part spring rig. Glass is light and snaps into place with a hint of
		// overshoot; the battery is the heaviest thing in the device and lands last.
		// Reduced motion keeps the targets but skips the physics entirely.
		/** @type {Record<string, ReturnType<typeof createVectorSpring>> | null} */
		this.springs = this.reducedMotion ? null : {};
		if (this.springs) {
			for (const layer of LAYERS) this.springs[layer.key] = createVectorSpring();
		}
		this.yawSpring = createSpring(0);
		/** @type {Record<string, { x: number, y: number, z: number }>} */
		this.layerTargets = {};
		this.groupYawTarget = 0;

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
		this.initShadows(this.keyLight);
		this.loadBaseModel();
		this.bindEvents();

		// THREE.Clock is deprecated in favour of THREE.Timer. The wrapper keeps the
		// `getDelta()` / `getElapsedTime()` shape the scene directors already use.
		const timer = new THREE.Timer();
		this.timer = timer;
		this.clock = {
			getDelta() {
				timer.update();
				return timer.getDelta();
			},
			getElapsedTime() {
				return timer.getElapsed();
			}
		};
		/** @type {number[]} */
		this.fpsSamples = [];
		this.animate = this.animate.bind(this);
		this.reqId = requestAnimationFrame(this.animate);
	}

	/**
	 * Build the post-processing chain asynchronously. The scene renders with the
	 * plain renderer until it resolves, so nothing is ever blocked on it.
	 * @param {number} width
	 * @param {number} height
	 */
	initPostProcessing(width, height) {
		createPostChain({
			renderer: this.renderer,
			scene: this.scene,
			camera: this.camera,
			width,
			height,
			budget: {
				bloom: this.budget.bloom,
				grade: this.budget.grade,
				ssao: this.budget.ssao,
				dof: this.budget.dof
			}
		})
			.then((chain) => {
				if (this.disposed) {
					chain.dispose();
					return;
				}
				this.post = chain;
				this.onWindowResize();
			})
			.catch((error) => {
				// A failed effects download must never take the product page with it.
				this.options.onError?.(error);
			});
	}

	/**
	 * Three-point studio lighting plus an accent rim light.
	 * Returning the lights (instead of assigning to `this` here) keeps the
	 * fields definitely-assigned for the type checker.
	 */
	initLights() {
		this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

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

		// Real softboxes. A directional light produces a point highlight on metal;
		// an area light produces the long soft streak you see in every studio
		// product photo, which is most of what makes titanium look like titanium.
		// Mid and high tier only: rect area lights cost a BRDF LUT upload.
		if (this.budget.tier !== 'low') {
			RectAreaLightUniformsLib.init();

			const softboxLeft = new THREE.RectAreaLight(0xffffff, 3.2, 1.2, 4.2);
			softboxLeft.position.set(-2.6, 0.6, 2.4);
			softboxLeft.lookAt(0, 0, 0);

			const softboxRight = new THREE.RectAreaLight(0xdfe9ff, 2.2, 0.8, 3.6);
			softboxRight.position.set(2.8, -0.2, 1.8);
			softboxRight.lookAt(0, 0, 0);

			const softboxTop = new THREE.RectAreaLight(0xffffff, 1.8, 3.2, 0.9);
			softboxTop.position.set(0, 2.8, 1.2);
			softboxTop.lookAt(0, 0, 0);

			this.scene.add(softboxLeft, softboxRight, softboxTop);
			this.softboxes = [softboxLeft, softboxRight, softboxTop];
		}

		return { keyLight, fillLight, backLight, rimLight };
	}

	loadBaseModel() {
		const loader = new GLTFLoader();
		const base = import.meta.env.BASE_URL ?? '/';
		// The shipped GLB is meshopt-compressed and quantised (EXT_meshopt_compression
		// + KHR_mesh_quantization), which cuts it from ~53 MB to ~1.6 MB. On top of
		// that, when the build produced a KTX2/Basis variant we load that instead:
		// GPU-compressed textures stay compressed in VRAM.
		const wantsKtx2 = Boolean(this.budget.ktx2);
		const hasKtx2Model = import.meta.env.VITE_KTX2_MODEL === 'true';
		this.modelUrl = modelUrl({ ktx2: wantsKtx2, hasKtx2Model, base });

		attachDecoders({
			loader,
			meshoptDecoder: MeshoptDecoder,
			renderer: this.renderer,
			base,
			ktx2: wantsKtx2 && hasKtx2Model
		}).then((decoders) => {
			this.decoders = decoders;
			if (this.disposed) {
				decoders.ktx2?.dispose?.();
				return;
			}
			this.loadModelFile(loader, this.modelUrl);
		});
	}

	/**
	 * @param {GLTFLoader} loader
	 * @param {string} url
	 */
	loadModelFile(loader, url) {
		loader.load(
			url,
			(gltf) => {
				if (this.disposed) return;
				const model = configurePhoneModel(gltf.scene);
				model.traverse((child) => {
					if (!(/** @type {THREE.Mesh} */ (child).isMesh)) return;
					const mesh = /** @type {THREE.Mesh} */ (child);
					if (this.budget.shadows) {
						mesh.castShadow = true;
						mesh.receiveShadow = true;
					}
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
		const width = PHONE.width;
		const height = PHONE.height;
		const env = this.budget.envIntensity;
		const micro = this.microDetail();

		// 01 — sapphire glass (rounded, with real thickness so the edge catches light)
		const glassGeo = createSlabGeometry({ depth: 0.014 });
		const glassMat = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,
			metalness: 0.02,
			roughness: 0.03,
			// Ultra-realistic sapphire glass with high transmission and refractive index
			ior: 1.55,
			transmission: 0.95,
			thickness: 0.5,
			clearcoat: 1,
			clearcoatRoughness: 0.04,
			clearcoatRoughnessMap: micro.smudge,
			sheen: 0.4,
			sheenRoughness: 0.2,
			specularIntensity: 1.35,
			transparent: true,
			opacity: 0.45,
			envMapIntensity: 2.2 * env,
			side: THREE.DoubleSide
		});
		this.layers.glass.add(new THREE.Mesh(glassGeo, glassMat));
		this.disposeLater(glassGeo, glassMat);

		// 02 — OLED matrix (animated sweep)
		this.shaderMaterials.displayShader = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uScroll: { value: 0 },
				uAccent: { value: new THREE.Color(0x00f0ff) },
				uSubpixel: { value: micro.subpixel },
				uHasSubpixel: { value: micro.subpixel ? 1 : 0 }
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

          vec3 color = (bg + sweep * uAccent * 0.9 + grid) * subpixel;
          gl_FragColor = vec4(color * vignette, 0.94);
        }
      `,
			transparent: true
		});
		const displayGeo = createSlabGeometry({
			width: width * 0.95,
			height: height * 0.96,
			depth: 0.018,
			radius: PHONE.corner * 0.88
		});
		this.layers.display.add(new THREE.Mesh(displayGeo, this.shaderMaterials.displayShader));
		this.disposeLater(displayGeo, this.shaderMaterials.displayShader);
		this.buildDisplayCutouts(width, height, env);
		this.buildDisplayStack(width, height);

		// 03 — titanium chassis: a hollow rail, so the stack stays see-through
		const frameGeo = createRailGeometry();
		const frameMat = new THREE.MeshPhysicalMaterial({
			color: 0x5a5d65,
			metalness: 0.98,
			roughness: 0.18,
			// Precision anisotropic titanium rail with brilliant directional sheen
			anisotropy: 0.8,
			anisotropyRotation: Math.PI / 2,
			roughnessMap: micro.brushed,
			clearcoat: 0.5,
			clearcoatRoughness: 0.15,
			envMapIntensity: 2.4 * env
		});
		this.layers.frame.add(new THREE.Mesh(frameGeo, frameMat));
		this.disposeLater(frameGeo, frameMat);
		this.buildRailDetails(frameMat, env);
		this.buildSimTray(frameMat);

		// 04 — penta camera array (was previously an empty group)
		const plateGeo = createSlabGeometry({
			width: width * 0.62,
			height: width * 0.62,
			depth: 0.05,
			radius: 0.16
		});
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

		const barrelGeo = new THREE.LatheGeometry(
			createLensProfile({ radius: 0.13, height: 0.085 }),
			48
		);
		const ringGeo = new THREE.TorusGeometry(0.135, 0.012, 16, 48);
		const lensGeo = new THREE.SphereGeometry(0.105, 40, 24);
		const tofGeo = new THREE.SphereGeometry(0.06, 24, 16);
		const barrelMat = new THREE.MeshPhysicalMaterial({
			color: 0x101215,
			metalness: 0.9,
			roughness: 0.2
		});
		const lensMat = new THREE.MeshPhysicalMaterial({
			color: 0x071522,
			metalness: 0.45,
			roughness: 0.02,
			clearcoat: 1,
			clearcoatRoughness: 0.01,
			// Multi-layer anti-reflective optical coating with rich iridescence
			iridescence: 0.85,
			iridescenceIOR: 2.1,
			iridescenceThicknessRange: [160, 580],
			envMapIntensity: 3.2 * env
		});
		this.disposeLater(barrelGeo, ringGeo, lensGeo, tofGeo, barrelMat, lensMat);

		// Milled camera plateau. Real flagships raise the module on a chamfered
		// deck; lenses sitting flush on the back panel always look painted on.
		const plateau = createCameraPlateau();
		const plateauMat = new THREE.MeshPhysicalMaterial({
			color: 0x3c4048,
			metalness: 1,
			roughness: 0.24,
			clearcoat: 0.4,
			clearcoatRoughness: 0.18,
			envMapIntensity: 2 * env
		});
		const plateauMesh = new THREE.Mesh(plateau.geometry, plateauMat);
		plateauMesh.position.set(plateau.offset.x, height * 0.28, plateau.rise * 0.5);
		this.layers.camera.add(plateauMesh);
		this.disposeLater(plateau.geometry, plateauMat);

		// Penta array: four full barrels plus a smaller time-of-flight sensor.
		// Each barrel is a real assembly — machined housing, retaining ring, nine
		// aperture blades, a coated front element and a sensor die behind it — and
		// each one is kept in `this.lensRigs` so it can be animated later.
		/** @type {Array<{ name: string, element: THREE.Mesh, blades: THREE.Group, phase: number }>} */
		this.lensRigs = [];
		const bladeGeo = new THREE.BoxGeometry(0.085, 0.006, 0.004);
		const bladeMat = new THREE.MeshPhysicalMaterial({
			color: 0x1b1e24,
			metalness: 0.85,
			roughness: 0.35
		});
		const sensorGeo = new THREE.BoxGeometry(0.11, 0.11, 0.01);
		const sensorMat = new THREE.MeshPhysicalMaterial({
			color: 0x1d2f3a,
			metalness: 0.5,
			roughness: 0.5,
			emissive: new THREE.Color(0x06202c),
			emissiveIntensity: 0.4
		});
		this.disposeLater(bladeGeo, bladeMat, sensorGeo, sensorMat);

		for (const lensSpec of createLensLayout()) {
			const y = height * 0.28 + lensSpec.y;
			const small = lensSpec.name === 'tof';

			if (!small) {
				// The lathe profile is built along +Y, so rotate +Y onto +Z: the barrel
				// has to grow out of the plateau towards the viewer, not into the body.
				const barrel = new THREE.Mesh(barrelGeo, barrelMat);
				barrel.rotation.x = Math.PI / 2;
				barrel.position.set(lensSpec.x, y, 0.01);

				const ring = new THREE.Mesh(ringGeo, barrelMat);
				ring.position.set(lensSpec.x, y, 0.075);

				const lens = new THREE.Mesh(lensGeo, lensMat);
				lens.position.set(lensSpec.x, y, 0.07);
				lens.scale.z = 0.55;

				// Aperture blades, sunk just inside the barrel mouth.
				const blades = new THREE.Group();
				blades.position.set(lensSpec.x, y, 0.052);
				for (const angle of createApertureBladeLayout(9)) {
					const blade = new THREE.Mesh(bladeGeo, bladeMat);
					// Offset each blade outward from the axis, then spin it around that
					// axis: closing the iris is a single rotation of this group.
					blade.position.set(Math.cos(angle) * 0.062, Math.sin(angle) * 0.062, 0);
					blade.rotation.z = angle + Math.PI / 2;
					blades.add(blade);
				}

				const sensor = new THREE.Mesh(sensorGeo, sensorMat);
				sensor.position.set(lensSpec.x, y, 0.012);

				this.layers.camera.add(barrel, ring, lens, blades, sensor);
				this.lensRigs.push({
					name: lensSpec.name,
					element: lens,
					blades,
					// Staggered phase, so the four modules never focus in unison.
					phase: this.lensRigs.length * 1.7
				});
			} else {
				const sensor = new THREE.Mesh(tofGeo, lensMat);
				sensor.position.set(lensSpec.x, y, 0.055);
				sensor.scale.z = 0.5;
				this.layers.camera.add(sensor);
			}
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
		const boardWidth = width * 0.9;
		const boardHeight = height * 0.45;
		const boardGeo = createSlabGeometry({
			width: boardWidth,
			height: boardHeight,
			depth: 0.016,
			radius: 0.05
		});
		this.layers.board.add(new THREE.Mesh(boardGeo, this.shaderMaterials.boardShader));
		this.disposeLater(boardGeo, this.shaderMaterials.boardShader);
		this.buildBoardTraces(boardWidth, boardHeight);
		this.buildTapticEngine(width, height, env);

		// Real silicon on the board: the NPU die plus its supporting packages.
		const chipMat = new THREE.MeshPhysicalMaterial({
			color: 0x14161b,
			metalness: 0.65,
			roughness: 0.45,
			envMapIntensity: 1.1
		});
		this.npuMat = new THREE.MeshPhysicalMaterial({
			color: 0x1a1d24,
			metalness: 0.8,
			roughness: 0.3,
			emissive: new THREE.Color(0x0088ff),
			emissiveIntensity: 0.35,
			envMapIntensity: 1.4
		});
		this.disposeLater(chipMat, this.npuMat);

		for (const chip of createChipLayout()) {
			const geometry = createSlabGeometry({
				width: boardWidth * chip.width,
				height: boardHeight * chip.height,
				depth: chip.depth,
				radius: 0.012
			});
			const mesh = new THREE.Mesh(geometry, chip.emissive ? this.npuMat : chipMat);
			mesh.position.set(boardWidth * chip.x, boardHeight * chip.y, 0.012 + chip.depth / 2);
			this.layers.board.add(mesh);
			this.disposeLater(geometry);
		}

		// Flex cable: the board never floats free, it stays tethered to the display
		// stack. Rebuilt each frame would be wasteful, so it is one static tube that
		// is scaled/rotated by the director as the gap changes.
		const cableGeo = createFlexCableGeometry({
			from: [0, boardHeight * 0.5, 0.01],
			to: [0, boardHeight * 0.5 + 0.5, 0.01],
			bulge: 0.22,
			radius: 0.014
		});
		const cableMat = new THREE.MeshStandardMaterial({
			color: 0xd6a54a,
			metalness: 0.55,
			roughness: 0.55
		});
		const cable = new THREE.Mesh(cableGeo, cableMat);
		this.flexCable = cable;
		this.layers.board.add(cable);
		this.disposeLater(cableGeo, cableMat);

		// 06 — battery cell
		const cellGeo = createSlabGeometry({
			width: width * 0.85,
			height: height * 0.45,
			depth: 0.06,
			radius: 0.06
		});
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
		glow.position.z = 0.04;
		this.layers.battery.add(glow);
		this.disposeLater(glowGeo, this.batteryGlowMat);
		this.buildPowerDetails(width, height);

		// Soft contact shadow under the whole device: grounds the object so it no
		// longer looks like it is floating in a void.
		const shadow = createContactShadow(width * 1.7);
		shadow.mesh.position.y = -height * 0.62;
		this.contactShadow = shadow.mesh;
		this.mainGroup.add(shadow.mesh);
		this.disposeLater(shadow.geometry, shadow.material);

		// Assembled reference body lying flat beneath the exploded stack, so the
		// parts always read as belonging to one device.
		const ghostGeo = createSlabGeometry({ depth: PHONE.depth });
		const ghostMat = new THREE.MeshPhysicalMaterial({
			color: 0x1b1e24,
			metalness: 0.9,
			roughness: 0.42,
			envMapIntensity: 0.9
		});
		const ghost = new THREE.Mesh(ghostGeo, ghostMat);
		ghost.rotation.x = -Math.PI / 2;
		ghost.position.y = -height * 0.6;
		ghost.visible = false;
		this.ghostPhone = ghost;
		this.mainGroup.add(ghost);
		this.disposeLater(ghostGeo, ghostMat);

		this.explodedGroup.visible = false;
	}

	/**
	 * Machined detail on the titanium rail: speaker grille, chassis screws and
	 * antenna break lines. All three are `InstancedMesh`es, so 14 grille holes and
	 * 6 screws cost one draw call each instead of twenty.
	 *
	 * @param {THREE.MeshPhysicalMaterial} railMat
	 * @param {number} env
	 */
	buildRailDetails(railMat, env) {
		const matrix = new THREE.Matrix4();

		// Microphone and noise-cancelling perforations. Tiny, but their absence is
		// why featureless rails read as a CAD preview.
		const slots = createMicSlotLayout();
		const slotGeo = new THREE.CylinderGeometry(1, 1, PHONE.depth * 0.9, 10);
		const slotMat = new THREE.MeshStandardMaterial({
			color: 0x04050a,
			metalness: 0.2,
			roughness: 0.95
		});
		const mics = new THREE.InstancedMesh(slotGeo, slotMat, slots.length);
		slots.forEach((slot, index) => {
			matrix.makeRotationX(Math.PI / 2);
			matrix.scale(new THREE.Vector3(slot.radius, 1, slot.radius));
			matrix.setPosition(slot.x, slot.y, 0);
			mics.setMatrixAt(index, matrix);
		});
		mics.instanceMatrix.needsUpdate = true;
		this.layers.frame.add(mics);
		this.disposeLater(slotGeo, slotMat);

		// Speaker grille: real drilled holes along the bottom edge.
		const holes = createGrilleLayout();
		const holeGeo = new THREE.CylinderGeometry(holes[0].radius, holes[0].radius, PHONE.depth, 10);
		const holeMat = new THREE.MeshStandardMaterial({
			color: 0x05060a,
			metalness: 0.3,
			roughness: 0.9
		});
		const grille = new THREE.InstancedMesh(holeGeo, holeMat, holes.length);
		holes.forEach((hole, index) => {
			matrix.makeRotationX(Math.PI / 2);
			matrix.setPosition(hole.x, hole.y, 0);
			grille.setMatrixAt(index, matrix);
		});
		grille.instanceMatrix.needsUpdate = true;
		this.layers.frame.add(grille);
		this.disposeLater(holeGeo, holeMat);

		// Chassis screws.
		const screws = createScrewLayout();
		const screwGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12);
		const screwMat = new THREE.MeshPhysicalMaterial({
			color: 0x8d9099,
			metalness: 1,
			roughness: 0.28,
			envMapIntensity: 2 * env
		});
		const screwMesh = new THREE.InstancedMesh(screwGeo, screwMat, screws.length);
		screws.forEach((screw, index) => {
			matrix.makeRotationX(Math.PI / 2);
			matrix.setPosition(screw.x, screw.y, PHONE.depth * 0.45);
			screwMesh.setMatrixAt(index, matrix);
		});
		screwMesh.instanceMatrix.needsUpdate = true;
		this.layers.frame.add(screwMesh);
		this.disposeLater(screwGeo, screwMat);

		// Side keys. A rocker sunk into the rail with a chamfered edge, plus a
		// knurled power key: the two details every reviewer photographs.
		for (const button of createButtonLayout()) {
			const keyGeo = new THREE.BoxGeometry(button.standoff * 2, button.length, button.thickness);
			const keyMat = new THREE.MeshPhysicalMaterial({
				color: button.knurled ? 0x9aa0aa : 0x7d828c,
				metalness: 1,
				roughness: button.knurled ? 0.42 : 0.26,
				envMapIntensity: 1.9 * env
			});
			const key = new THREE.Mesh(keyGeo, keyMat);
			const side = button.side === 'right' ? 1 : -1;
			key.position.set(side * (PHONE.width / 2 + button.standoff * 0.4), button.y, 0);
			this.layers.frame.add(key);
			this.disposeLater(keyGeo, keyMat);
		}

		// USB-C receptacle on the bottom rail: a dark rounded slot, inset.
		const port = createPortShape();
		const portGeo = new THREE.ExtrudeGeometry(port.shape, {
			depth: PHONE.depth * 0.5,
			bevelEnabled: false,
			curveSegments: 16
		});
		const portMat = new THREE.MeshStandardMaterial({
			color: 0x04050a,
			metalness: 0.55,
			roughness: 0.55
		});
		const portMesh = new THREE.Mesh(portGeo, portMat);
		portMesh.rotation.x = Math.PI / 2;
		portMesh.position.set(0, port.y + port.height * 0.1, 0);
		this.layers.frame.add(portMesh);
		this.disposeLater(portGeo, portMat);

		// Antenna break lines: thin insulating bands interrupting the metal.
		const bandGeo = new THREE.BoxGeometry(PHONE.width + 0.004, 0.012, PHONE.depth * 0.92);
		const bandMat = new THREE.MeshStandardMaterial({
			color: 0x2a2d34,
			metalness: 0.1,
			roughness: 0.75
		});
		const lines = createAntennaLines();
		const bands = new THREE.InstancedMesh(bandGeo, bandMat, lines.length);
		lines.forEach((normalisedY, index) => {
			matrix.identity();
			matrix.setPosition(0, normalisedY * PHONE.height, 0);
			bands.setMatrixAt(index, matrix);
		});
		bands.instanceMatrix.needsUpdate = true;
		this.layers.frame.add(bands);
		this.disposeLater(bandGeo, bandMat);
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
		this.post?.setSize(width, height);
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
		this.averageFps = average;

		// Step 1: resolution is the cheapest lever, so spend it first.
		if (average < 45 && this.pixelRatio > 1) {
			this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
			this.renderer.setPixelRatio(this.pixelRatio);
			return;
		}
		if (average > 58 && this.pixelRatio < this.basePixelRatio) {
			this.pixelRatio = Math.min(this.basePixelRatio, this.pixelRatio + 0.25);
			this.renderer.setPixelRatio(this.pixelRatio);
			return;
		}

		// Step 2: resolution is already at the floor - change tier instead of
		// stuttering forever. Demotion only; a promotion mid-scroll would change the
		// look of the page under the user.
		const nextTier = adaptTier(this.budget.tier, average);
		if (nextTier !== this.budget.tier && average < 34) this.applyTier(nextTier);
	}

	/**
	 * Move the whole scene to a different quality tier at runtime.
	 * @param {import('./qualityTier.js').Tier} tier
	 */
	applyTier(tier) {
		this.budget = budgetFor(tier);
		this.basePixelRatio = Math.min(window.devicePixelRatio || 1, this.budget.pixelRatio);
		this.pixelRatio = Math.min(this.pixelRatio, this.basePixelRatio);
		this.renderer.setPixelRatio(this.pixelRatio);

		if (!this.budget.postFx && this.post) {
			this.post.dispose();
			this.post = null;
		} else if (this.post?.bloom) {
			this.post.bloom.enabled = this.budget.bloom;
		}
		if (this.post?.grade) this.post.grade.enabled = this.budget.grade;

		for (const light of this.softboxes ?? []) light.visible = tier !== 'low';
		this.options.onTier?.(this.budget);
	}

	/**
	 * Integrate the part springs towards the targets published by the scene
	 * director. Called once per frame, before the subject is measured, so the
	 * camera framing always follows the positions actually on screen.
	 * @param {number} delta
	 */
	settleLayers(delta) {
		if (!this.springs) return;

		for (const [key, target] of Object.entries(this.layerTargets)) {
			const layer = this.layers[key];
			const spring = this.springs[key];
			if (!layer || !spring) continue;
			stepVectorSpring(spring, target, delta, LAYER_SPRING[key] ?? SPRINGS.solid, layer.position);
		}

		stepSpring(this.yawSpring, this.groupYawTarget, delta, SPRINGS.critical);
		this.explodedGroup.rotation.y = this.yawSpring.value;
	}

	/**
	 * Measure the world bounding sphere of whatever is currently on screen and
	 * hand it to the rig, which derives the camera distance from it. This is the
	 * link that keeps the framing correct for the assembled model *and* for the
	 * much deeper exploded stack.
	 */
	measureSubject() {
		const subject = this.explodedGroup.visible ? this.explodedGroup : this.basePhoneGroup;
		if (!subject.visible || subject.children.length === 0) return;

		subject.updateWorldMatrix(true, true);
		this.subjectBox.setFromObject(subject);
		if (this.subjectBox.isEmpty()) return;

		this.subjectBox.getBoundingSphere(this.subjectSphere);
		this.rig.setSubject(this.subjectSphere.center, this.subjectSphere.radius);
	}

	animate() {
		if (this.disposed) return;
		this.reqId = requestAnimationFrame(this.animate);

		const delta = Math.min(this.clock.getDelta(), 0.1);
		const elapsed = this.clock.getElapsedTime();

		if (document.hidden || !this.visible || this.contextLost) return;

		// Frame pacing: on a capped tier we deliberately skip frames instead of
		// letting the GPU run flat out. The same perceived smoothness at half the
		// frames means half the heat, which on a phone is the difference between
		// 60fps for ten seconds and 60fps for ten minutes.
		if (this.budget.maxFps > 0) {
			this.frameAccumulator = (this.frameAccumulator ?? 0) + delta;
			if (this.frameAccumulator < 1 / this.budget.maxFps) return;
			this.frameAccumulator = 0;
		}

		this.accentColor.setHex(this.accentColorHex);

		this.settleLayers(delta);
		this.measureSubject();
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
		this.animateComponentDetail(elapsed);
		this.options.onHotspots?.(this.hotspots);
		// The lying-flat reference body only makes sense while the stack is apart.
		if (this.ghostPhone) this.ghostPhone.visible = this.explodedGroup.visible;
		if (this.contactShadow) this.contactShadow.visible = this.explodedGroup.visible;

		this.monitorPerformance(delta);
		if (this.post) {
			this.post.update(elapsed, this.camera.position.distanceTo(this.rig.currentLookAt));
			this.post.composer.render(delta);
		} else {
			this.renderer.render(this.scene, this.camera);
		}
	}

	/**
	 * Which AR route this device can take, or null when it cannot do AR.
	 * @returns {import('./ar.js').ArMode}
	 */
	arMode() {
		if (typeof navigator === 'undefined') return null;
		return detectArMode({
			userAgent: navigator.userAgent ?? '',
			webxr: Boolean(/** @type {any} */ (navigator).xr),
			maxTouchPoints: navigator.maxTouchPoints ?? 0
		});
	}

	/**
	 * Hand the assembled device over to the platform's AR viewer. iOS gets a USDZ
	 * exported from the live scene, so it carries the finish the visitor picked;
	 * Android gets the GLB through Scene Viewer.
	 * @returns {Promise<{ launched: boolean, mode: import('./ar.js').ArMode, url?: string }>}
	 */
	async enterAr() {
		const mode = this.arMode();
		if (!mode) return { launched: false, mode };
		const absolute =
			typeof window === 'undefined'
				? this.modelUrl
				: new URL(this.modelUrl ?? '/models/nova_one.glb', window.location.href).href;
		return launchAr({
			mode: mode === 'webxr' ? 'scene-viewer' : mode,
			getScene: () => this.basePhoneGroup,
			modelUrl: absolute
		});
	}

	/**
	 * Procedural micro-detail maps, built once and shared by every material.
	 * Skipped entirely on the low tier: three extra texture uploads are not worth
	 * it on a device that is already fill-rate bound.
	 *
	 * @returns {{ brushed: THREE.Texture | null, smudge: THREE.Texture | null, subpixel: THREE.Texture | null }}
	 */
	microDetail() {
		if (this.micro) return this.micro;
		if (!this.budget.microDetail) {
			this.micro = { brushed: null, smudge: null, subpixel: null };
			return this.micro;
		}

		const size = this.budget.tier === 'high' ? 512 : 256;
		const brushed = toDataTexture(brushedMetalRoughness({ size, base: 0.26, seed: 7 }), {
			repeat: 2
		});
		const smudge = toDataTexture(glassSmudge({ size, smudges: 11, dust: size, seed: 21 }));
		const subpixel = toDataTexture(oledSubpixelGrid({ cells: 96, cellSize: 4 }), {
			repeat: 6,
			srgb: true
		});
		this.disposeLater(brushed, smudge, subpixel);
		this.micro = { brushed, smudge, subpixel };
		return this.micro;
	}

	/**
	 * Real shadow maps. The fake blob under the device sells the exploded view,
	 * but only a depth-mapped key light puts the camera plateau's shadow on the
	 * back panel and the rail's shadow on the glass.
	 * @param {THREE.DirectionalLight} keyLight
	 */
	initShadows(keyLight) {
		if (!this.budget.shadows || !this.budget.shadowMapSize) return;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		keyLight.castShadow = true;
		keyLight.shadow.mapSize.set(this.budget.shadowMapSize, this.budget.shadowMapSize);
		// Tight frustum around a 2.5-unit device: a loose one wastes the whole map
		// on empty space and produces the blocky shadows people blame on WebGL.
		const extent = 3.2;
		keyLight.shadow.camera.left = -extent;
		keyLight.shadow.camera.right = extent;
		keyLight.shadow.camera.top = extent;
		keyLight.shadow.camera.bottom = -extent;
		keyLight.shadow.camera.near = 0.5;
		keyLight.shadow.camera.far = 18;
		keyLight.shadow.bias = -0.0006;
		keyLight.shadow.normalBias = 0.02;
		keyLight.shadow.radius = 3;

		this.mainGroup.traverse((child) => {
			const mesh = /** @type {THREE.Mesh} */ (child);
			if (!mesh.isMesh) return;
			const material = /** @type {THREE.Material | THREE.Material[]} */ (mesh.material);
			const first = Array.isArray(material) ? material[0] : material;
			// Transparent parts (glass, the OLED sweep, glow planes) would otherwise
			// throw an opaque black shadow, which looks worse than no shadow at all.
			mesh.castShadow = !first?.transparent;
			mesh.receiveShadow = true;
		});
	}

	/**
	 * Everything punched through the front glass: the selfie-camera hole with its
	 * metal collar and coated element, and the earpiece slot above it. A phone
	 * front with no interruptions reads as a mock-up, not a device.
	 *
	 * @param {number} width
	 * @param {number} height
	 * @param {number} env
	 */
	buildDisplayCutouts(width, height, env) {
		const collarMat = new THREE.MeshPhysicalMaterial({
			color: 0x0a0b0e,
			metalness: 0.8,
			roughness: 0.3,
			envMapIntensity: 1.4 * env
		});
		const glassMat = new THREE.MeshPhysicalMaterial({
			color: 0x060d14,
			metalness: 0.3,
			roughness: 0.05,
			clearcoat: 1,
			iridescence: 0.7,
			iridescenceIOR: 1.8,
			iridescenceThicknessRange: [200, 600],
			envMapIntensity: 2 * env
		});
		this.disposeLater(collarMat, glassMat);

		for (const cutout of createPunchHoleLayout()) {
			if (cutout.radius) {
				const holeGeo = new THREE.CylinderGeometry(cutout.radius, cutout.radius, 0.022, 28);
				const hole = new THREE.Mesh(holeGeo, collarMat);
				hole.rotation.x = Math.PI / 2;
				hole.position.set(cutout.x, cutout.y, 0.006);

				const elementGeo = new THREE.SphereGeometry(cutout.radius * 0.78, 24, 16);
				const element = new THREE.Mesh(elementGeo, glassMat);
				element.scale.z = 0.4;
				element.position.set(cutout.x, cutout.y, 0.014);

				this.layers.display.add(hole, element);
				this.disposeLater(holeGeo, elementGeo);
			} else {
				const slotGeo = createSlabGeometry({
					width: cutout.width ?? 0.2,
					height: cutout.height ?? 0.018,
					depth: 0.014,
					radius: (cutout.height ?? 0.018) / 2
				});
				const slot = new THREE.Mesh(slotGeo, collarMat);
				slot.position.set(cutout.x, cutout.y, 0.008);
				this.layers.display.add(slot);
				this.disposeLater(slotGeo);
			}
		}
	}

	/**
	 * Copper traces on the logic board, as one instanced mesh. The board shader
	 * already paints a trace pattern, but painted traces stay flat under a moving
	 * light; these have real height, so they catch the rim light edge-on.
	 *
	 * @param {number} boardWidth
	 * @param {number} boardHeight
	 */
	buildBoardTraces(boardWidth, boardHeight) {
		const traces = createPcbTraceLayout({ count: this.budget.tier === 'low' ? 12 : 26 });
		const geometry = new THREE.BoxGeometry(1, 1, 0.004);
		const material = new THREE.MeshPhysicalMaterial({
			color: 0xc08b3a,
			metalness: 1,
			roughness: 0.32,
			emissive: new THREE.Color(0x2a1a04),
			emissiveIntensity: 0.5
		});
		const mesh = new THREE.InstancedMesh(geometry, material, traces.length);
		const matrix = new THREE.Matrix4();
		const scale = new THREE.Vector3();

		traces.forEach((trace, index) => {
			const long = trace.length * (trace.vertical ? boardHeight : boardWidth);
			scale.set(trace.vertical ? 0.008 : long, trace.vertical ? long : 0.008, 1);
			matrix.identity();
			matrix.scale(scale);
			matrix.setPosition(trace.x * boardWidth * 0.5, trace.y * boardHeight * 0.5, 0.011);
			mesh.setMatrixAt(index, matrix);
		});
		mesh.instanceMatrix.needsUpdate = true;
		this.boardTraceMat = material;
		this.layers.board.add(mesh);
		this.disposeLater(geometry, material);
	}

	/**
	 * The deep animation layer: motion at the level of individual components,
	 * running underneath the scroll choreography.
	 *
	 * Big camera moves are what people notice first, but what makes a scene feel
	 * alive is the small stuff that never stops — lenses hunting for focus,
	 * an iris breathing, current pulsing through copper. All of it is amplitude
	 * scaled, so reduced-motion visitors get a still, readable device.
	 *
	 * @param {number} elapsed seconds since start
	 */
	animateComponentDetail(elapsed) {
		const amplitude = this.reducedMotion ? 0 : 1;

		// Autofocus: the front element travels a fraction of a millimetre, then
		// settles. Sped up and exaggerated, this is the "hunting" you see when a
		// real camera locks on.
		for (const rig of this.lensRigs ?? []) {
			const hunt = Math.sin(elapsed * 1.3 + rig.phase);
			rig.element.position.z = 0.07 + hunt * 0.004 * amplitude;
			// Iris: slow open/close, offset from the focus cycle so the two motions
			// never look mechanically linked.
			const iris = 0.5 + 0.5 * Math.sin(elapsed * 0.6 + rig.phase * 0.5);
			rig.blades.rotation.z = iris * 0.42 * amplitude;
			rig.blades.scale.setScalar(1 - iris * 0.12 * amplitude);
		}

		// Current through the copper: a slow emissive swell rather than a blink,
		// because a blinking board looks like a warning light.
		if (this.boardTraceMat) {
			this.boardTraceMat.emissiveIntensity =
				0.5 + (0.35 + 0.35 * Math.sin(elapsed * 2.1)) * amplitude;
		}

		// NPU die heat: brighter while the compute chapter is on screen.
		if (this.npuMat) {
			const load = 0.35 + 0.5 * Math.max(0, Math.sin(elapsed * 1.8)) * amplitude;
			this.npuMat.emissiveIntensity = this.explodedGroup.visible ? load : 0.35;
		}

		// Haptic mass: a fast oscillation on the axis it is actually free to move
		// along, at an amplitude you can see but that never detaches from the can.
		if (this.taptic) {
			const buzz = Math.sin(elapsed * 26) * this.taptic.travel * 0.35 * amplitude;
			this.taptic.mass.position.y = this.taptic.home + buzz;
		}

		// The charging coil turns slowly: it reads as an induction field without
		// needing a particle effect.
		if (this.chargingCoil) {
			this.chargingCoil.rotation.z = elapsed * 0.12 * amplitude;
		}
	}

	/**
	 * The panel as a laminate rather than a single sheet: polariser,
	 * encapsulation, digitiser and graphite spreader. When the camera looks along
	 * the edge you can count the layers, the way you can in a teardown photo.
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	buildDisplayStack(width, height) {
		for (const layer of createDisplayStack()) {
			const geometry = createSlabGeometry({
				// Each sheet is cut slightly smaller than the one in front, so the
				// laminate steps inward instead of showing as one thick slab.
				width: width * 0.95 - Math.abs(layer.offset) * 0.6,
				height: height * 0.96 - Math.abs(layer.offset) * 0.6,
				depth: layer.depth,
				radius: PHONE.corner * 0.86
			});
			const material = new THREE.MeshPhysicalMaterial({
				color: layer.name === 'graphite' ? 0x0b0c0f : 0x1a2028,
				metalness: layer.name === 'graphite' ? 0.4 : 0.1,
				roughness: layer.roughness,
				transparent: layer.opacity < 1,
				opacity: layer.opacity,
				depthWrite: layer.opacity >= 1
			});
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.z = layer.offset;
			this.layers.display.add(mesh);
			this.disposeLater(geometry, material);
		}
	}

	/**
	 * Haptic engine: a shielded can with a moving mass inside. Kept on
	 * `this.taptic` so the mass can be driven by the same impulse that shakes the
	 * camera — the part you feel in your hand is visibly the part that moves.
	 *
	 * @param {number} width
	 * @param {number} height
	 * @param {number} env
	 */
	buildTapticEngine(width, height, env) {
		const spec = createTapticEngine({ width, height });
		const canGeo = createSlabGeometry({
			width: spec.width,
			height: spec.height,
			depth: spec.depth,
			radius: 0.014
		});
		const canMat = new THREE.MeshPhysicalMaterial({
			color: 0x9aa0aa,
			metalness: 1,
			roughness: 0.34,
			envMapIntensity: 1.7 * env
		});
		const can = new THREE.Mesh(canGeo, canMat);
		can.position.set(spec.x, spec.y, 0.02);

		const massGeo = createSlabGeometry({
			width: spec.mass.width,
			height: spec.mass.height,
			depth: 0.016,
			radius: 0.006
		});
		const massMat = new THREE.MeshPhysicalMaterial({
			color: 0x3a3d44,
			metalness: 0.95,
			roughness: 0.28
		});
		const mass = new THREE.Mesh(massGeo, massMat);
		mass.position.set(spec.x, spec.y, 0.032);

		this.taptic = { mass, home: spec.y, travel: spec.mass.travel };
		this.layers.board.add(can, mass);
		this.disposeLater(canGeo, canMat, massGeo, massMat);
	}

	/**
	 * Wireless charging coil and the cell's welded terminal tabs, both on the
	 * battery layer. The coil is a single swept spiral, so the crossover where the
	 * wire steps inward is visible instead of reading as concentric rings.
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	buildPowerDetails(width, height) {
		const points = createCoilSpiral({
			turns: this.budget.tier === 'low' ? 6 : 10,
			inner: width * 0.1,
			outer: width * 0.32
		});
		const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
		const coilGeo = new THREE.TubeGeometry(curve, Math.min(points.length, 480), 0.005, 6, false);
		const coilMat = new THREE.MeshPhysicalMaterial({
			color: 0xb5762c,
			metalness: 1,
			roughness: 0.3,
			// Enamel over copper: a thin varnish coat, not bare metal.
			clearcoat: 0.6,
			clearcoatRoughness: 0.35
		});
		const coil = new THREE.Mesh(coilGeo, coilMat);
		coil.position.set(0, height * 0.08, -0.045);
		this.chargingCoil = coil;
		this.layers.battery.add(coil);
		this.disposeLater(coilGeo, coilMat);

		const tabMat = new THREE.MeshPhysicalMaterial({
			color: 0xd7dae0,
			metalness: 1,
			roughness: 0.22
		});
		this.disposeLater(tabMat);
		for (const tab of createBatteryTabs({ width: width * 0.85, height: height * 0.45 })) {
			const geometry = createSlabGeometry({
				width: tab.width,
				height: tab.height,
				depth: 0.008,
				radius: 0.004
			});
			const mesh = new THREE.Mesh(geometry, tabMat);
			mesh.position.set(tab.x, tab.y, 0.02);
			this.layers.battery.add(mesh);
			this.disposeLater(geometry);
		}
	}

	/**
	 * SIM tray: a panel line on the left rail with its ejection pinhole. Panel
	 * lines are what stop a machined body from looking like one solid billet.
	 *
	 * @param {THREE.MeshPhysicalMaterial} railMat
	 */
	buildSimTray(railMat) {
		const spec = createSimTray();
		const trayGeo = new THREE.BoxGeometry(spec.seam * 3, spec.length, spec.depth);
		const tray = new THREE.Mesh(trayGeo, railMat);
		tray.position.set(spec.x + spec.seam, spec.y, 0);

		const seamGeo = new THREE.BoxGeometry(spec.seam, spec.length, spec.depth * 1.02);
		const seamMat = new THREE.MeshStandardMaterial({
			color: 0x07080c,
			metalness: 0.2,
			roughness: 0.9
		});
		const seam = new THREE.Mesh(seamGeo, seamMat);
		seam.position.set(spec.x + spec.seam * 0.2, spec.y, 0);

		const pinGeo = new THREE.CylinderGeometry(spec.pinhole.radius, spec.pinhole.radius, 0.02, 10);
		const pin = new THREE.Mesh(pinGeo, seamMat);
		pin.rotation.z = Math.PI / 2;
		pin.position.set(spec.x + 0.006, spec.y - spec.pinhole.offset, 0);

		this.layers.frame.add(tray, seam, pin);
		this.disposeLater(trayGeo, seamGeo, seamMat, pinGeo);
	}

	destroy() {
		this.disposed = true;
		this.decoders?.ktx2?.dispose?.();
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
		this.post?.dispose();
		this.post = null;

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
