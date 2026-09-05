import * as THREE from 'three';

/**
 * Post-processing chain, kept in its own module so the bundler can split it out:
 * low-tier devices never download the composer, the bloom pass or the shaders.
 *
 * The grade pass is the cheap "camera" layer that sells the render as a photo
 * rather than a WebGL demo: a touch of chromatic aberration at the edges,
 * animated film grain, and a vignette. All three are one fullscreen pass.
 */

/**
 * Film-grade shader definition. Returned fresh each call so two composers never
 * share uniform objects.
 */
export function createGradeShader() {
	return {
		name: 'NovaGradeShader',
		uniforms: {
			tDiffuse: { value: null },
			uTime: { value: 0 },
			uGrain: { value: 0.045 },
			uVignette: { value: 0.35 },
			uAberration: { value: 0.0022 }
		},
		vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
		fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uAberration;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 centred = vUv - 0.5;
        float r2 = dot(centred, centred);

        // Lateral chromatic aberration: zero in the centre, strongest at the
        // corners, exactly like a real wide-aperture lens.
        vec2 offset = centred * uAberration * r2 * 4.0;
        vec4 color;
        color.r = texture2D(tDiffuse, vUv + offset).r;
        color.g = texture2D(tDiffuse, vUv).g;
        color.b = texture2D(tDiffuse, vUv - offset).b;
        color.a = 1.0;

        // Vignette.
        color.rgb *= 1.0 - uVignette * smoothstep(0.15, 0.85, r2 * 2.0);

        // Animated grain, luminance-weighted so shadows stay clean.
        float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        float grain = (hash(vUv * 1024.0 + fract(uTime) * 71.3) - 0.5) * uGrain;
        color.rgb += grain * (0.35 + luma);

        gl_FragColor = color;
      }
    `
	};
}

/**
 * Decide the pass order for a budget, as plain data. Keeping this pure means
 * the ordering contract (occlusion before bloom, grade before output, output
 * always last) is unit-testable without a GPU.
 *
 * @param {{ ssao?: boolean, bloom?: boolean, dof?: boolean, grade?: boolean }} budget
 * @returns {string[]}
 */
export function resolvePassPlan(budget = {}) {
	const plan = ['render'];
	// Ambient occlusion reads scene depth, so it must run before anything that
	// blurs or tints the buffer.
	if (budget.ssao) plan.push('ssao');
	// Depth of field also needs untouched depth, but must come after AO so the
	// contact shadows are blurred together with the geometry they sit on.
	if (budget.dof) plan.push('dof');
	if (budget.bloom) plan.push('bloom');
	if (budget.grade) plan.push('grade');
	plan.push('output');
	return plan;
}

/**
 * @typedef {object} PostChain
 * @property {import('three/examples/jsm/postprocessing/EffectComposer.js').EffectComposer} composer
 * @property {import('three/examples/jsm/postprocessing/UnrealBloomPass.js').UnrealBloomPass | null} bloom
 * @property {import('three/examples/jsm/postprocessing/ShaderPass.js').ShaderPass | null} [grade]
 * @property {any} [ssao]
 * @property {any} [dof]
 * @property {string[]} [plan]
 * @property {(width: number, height: number) => void} setSize
 * @property {(elapsed: number, focusDistance?: number) => void} update
 * @property {() => void} dispose
 */

/**
 * Build the composer. Every heavy import happens here, lazily.
 *
 * @param {object} args
 * @param {THREE.WebGLRenderer} args.renderer
 * @param {THREE.Scene} args.scene
 * @param {THREE.Camera} args.camera
 * @param {number} args.width
 * @param {number} args.height
 * @param {{ bloom: boolean, grade: boolean, ssao?: boolean, dof?: boolean }} args.budget
 * @returns {Promise<PostChain>}
 */
export async function createPostChain({ renderer, scene, camera, width, height, budget }) {
	const [{ EffectComposer }, { RenderPass }, { OutputPass }] = await Promise.all([
		import('three/examples/jsm/postprocessing/EffectComposer.js'),
		import('three/examples/jsm/postprocessing/RenderPass.js'),
		import('three/examples/jsm/postprocessing/OutputPass.js')
	]);

	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));

	// --- Ambient occlusion -------------------------------------------------
	// Without contact shadows a phone floats above its own reflection; SAO adds
	// the dark seam where the frame meets the glass and where parts meet in the
	// exploded view, which is most of what reads as "rendered by a studio".
	/** @type {any} */
	let ssao = null;
	if (budget.ssao) {
		const { SAOPass } = await import('three/examples/jsm/postprocessing/SAOPass.js');
		ssao = new SAOPass(scene, camera);
		ssao.params.saoBias = 0.35;
		ssao.params.saoIntensity = 0.012;
		ssao.params.saoScale = 6;
		ssao.params.saoKernelRadius = 24;
		ssao.params.saoBlur = true;
		ssao.params.saoBlurRadius = 8;
		ssao.params.saoBlurStdDev = 4;
		composer.addPass(ssao);
	}

	// --- Depth of field ----------------------------------------------------
	// Focus distance is driven per frame from the camera-to-target distance, so
	// the device stays sharp while the background particles melt away.
	/** @type {any} */
	let dof = null;
	if (budget.dof) {
		const { BokehPass } = await import('three/examples/jsm/postprocessing/BokehPass.js');
		dof = new BokehPass(scene, camera, { focus: 8, aperture: 0.00018, maxblur: 0.006 });
		composer.addPass(dof);
	}

	/** @type {any} */
	let bloom = null;
	if (budget.bloom) {
		const { UnrealBloomPass } = await import(
			'three/examples/jsm/postprocessing/UnrealBloomPass.js'
		);
		bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.75, 0.82);
		composer.addPass(bloom);
	}

	/** @type {any} */
	let grade = null;
	if (budget.grade) {
		const { ShaderPass } = await import('three/examples/jsm/postprocessing/ShaderPass.js');
		grade = new ShaderPass(createGradeShader());
		composer.addPass(grade);
	}

	// OutputPass owns tone mapping + colour space conversion, so it must be last.
	composer.addPass(new OutputPass());
	composer.setSize(width, height);

	return {
		composer,
		bloom,
		grade,
		ssao,
		dof,
		plan: resolvePassPlan(budget),
		setSize(w, h) {
			composer.setSize(w, h);
			bloom?.setSize(w, h);
			ssao?.setSize?.(w, h);
			dof?.setSize?.(w, h);
		},
		update(elapsed, focusDistance = 0) {
			if (grade) grade.uniforms.uTime.value = elapsed;
			// Keep the plane of focus glued to whatever the rig is looking at.
			if (dof && focusDistance > 0) {
				const uniforms = dof.uniforms ?? dof.materialBokeh?.uniforms;
				if (uniforms?.focus) uniforms.focus.value = focusDistance;
			}
		},
		dispose() {
			bloom?.dispose?.();
			grade?.dispose?.();
			ssao?.dispose?.();
			dof?.dispose?.();
			composer.dispose?.();
		}
	};
}
