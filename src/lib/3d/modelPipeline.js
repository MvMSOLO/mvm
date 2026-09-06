import * as THREE from 'three';

/**
 * Build a procedural PMREM environment so metallic surfaces have something to
 * reflect. Returns the render target so the caller can dispose it.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @returns {THREE.WebGLRenderTarget}
 */
export function setupEnvironmentAndMaterials(scene, renderer) {
	const pmremGenerator = new THREE.PMREMGenerator(renderer);
	pmremGenerator.compileEquirectangularShader();

	const envScene = new THREE.Scene();
	envScene.background = new THREE.Color(0x0a0d16);

	/**
	 * Large emissive planes act as studio softboxes & dynamic reflection strips in the environment map.
	 * @param {number} color
	 * @param {number} intensity
	 * @param {[number, number, number]} position
	 * @param {[number, number]} size
	 * @param {[number, number, number]} [rotation]
	 * @returns {[THREE.PlaneGeometry, THREE.MeshBasicMaterial]}
	 */
	const softbox = (color, intensity, position, size, rotation = [0, 0, 0]) => {
		const geometry = new THREE.PlaneGeometry(size[0], size[1]);
		const material = new THREE.MeshBasicMaterial({
			color,
			opacity: intensity,
			transparent: true,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(position[0], position[1], position[2]);
		if (rotation[0] || rotation[1] || rotation[2]) {
			mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
		} else {
			mesh.lookAt(0, 0, 0);
		}
		envScene.add(mesh);
		return [geometry, material];
	};

	const trash = [
		// Main key overhead light ring/box for edge highlights on titanium
		...softbox(0xffffff, 1.2, [0, 10, 2], [14, 14]),
		// Long vertical side softbox for sleek streak reflection down the chassis rail
		...softbox(0xeaf4ff, 0.9, [-9, 0, 1], [3, 16], [0, Math.PI / 3, 0]),
		...softbox(0xffffff, 0.8, [9, 0, 1], [3, 16], [0, -Math.PI / 3, 0]),
		// Futuristic cyan studio rim light accent
		...softbox(0x00f0ff, 0.85, [-6, -4, -5], [12, 10]),
		// High-tech violet back bounce
		...softbox(0xaa00ff, 0.5, [6, 5, -8], [10, 10]),
		// Pure white center fill highlight
		...softbox(0xffffff, 0.6, [0, -8, 6], [8, 8])
	];

	const renderTarget = pmremGenerator.fromScene(envScene, 0.02);
	scene.environment = renderTarget.texture;

	for (const item of trash) item.dispose();
	pmremGenerator.dispose();

	return renderTarget;
}

/**
 * Centre a loaded model on the origin, orient it to face the camera and
 * normalise it to smartphone scale.
 *
 * Orientation is derived from the bounding box rather than hard-coded: the
 * thinnest axis is rotated onto +Z (so the flat face points at the camera)
 * and the longest onto +Y (so the device stands upright). The shipped GLB is
 * a baked slab whose thin axis is X, which without this correction is
 * presented to the viewer edge-on.
 *
 * @template {THREE.Object3D} T
 * @param {T} model
 * @returns {T}
 */
export function configurePhoneModel(model) {
	const measure = () => {
		const box = new THREE.Box3().setFromObject(model);
		return { box, size: box.getSize(new THREE.Vector3()) };
	};

	const { size } = measure();
	const axes = /** @type {const} */ (['x', 'y', 'z']);
	const thin = [...axes].sort((a, b) => size[a] - size[b])[0];

	// Quarter turns only, applied about WORLD axes so a second turn isn't
	// interpreted in the already-rotated local frame.
	const turn = (/** @type {THREE.Vector3} */ axis) => {
		model.rotateOnWorldAxis(axis, Math.PI / 2);
		model.updateMatrixWorld(true);
	};

	// 1. Put the flat face towards the camera (thinnest axis on Z).
	if (thin === 'x') turn(new THREE.Vector3(0, 1, 0));
	else if (thin === 'y') turn(new THREE.Vector3(1, 0, 0));

	// 2. Stand the device upright (longest remaining axis on Y).
	if (measure().size.x > measure().size.y) turn(new THREE.Vector3(0, 0, 1));

	// Scale BEFORE centring. `position` is applied after `scale` in an
	// Object3D's transform, so centring first and scaling afterwards leaves the
	// model off-origin by (1 - scale) * centre.
	const tallest = Math.max(measure().size.x, measure().size.y, measure().size.z) || 1;
	model.scale.multiplyScalar(2.5 / tallest);
	model.updateMatrixWorld(true);

	const center = measure().box.getCenter(new THREE.Vector3());
	model.position.sub(center);
	model.updateMatrixWorld(true);

	model.traverse((child) => {
		const mesh = /** @type {THREE.Mesh & {material?: THREE.MeshStandardMaterial}} */ (child);
		if (mesh.isMesh && mesh.material && 'envMapIntensity' in mesh.material) {
			mesh.material.envMapIntensity = 1.5;
			mesh.material.needsUpdate = true;
		}
	});

	return model;
}
