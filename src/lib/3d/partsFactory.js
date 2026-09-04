import * as THREE from 'three';

/**
 * Geometry factory for the exploded view.
 *
 * Everything here is pure CPU work returning plain geometry, so it can be unit
 * tested without a WebGL context. The exploded layers used to be flat
 * `PlaneGeometry` quads, which read as paper cut-outs the moment the camera
 * moved off axis. These builders give every layer real thickness, rounded
 * corners and bevelled edges so the whole device reads as one machined object.
 */

/** Master dimensions. Every part is derived from these, never hard-coded. */
export const PHONE = {
	width: 1.3,
	height: 2.7,
	corner: 0.2,
	depth: 0.1
};

/**
 * Rounded rectangle centred on the origin.
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {THREE.Shape}
 */
export function roundedRectShape(width, height, radius) {
	const w = Math.max(width, 1e-4) / 2;
	const h = Math.max(height, 1e-4) / 2;
	const r = THREE.MathUtils.clamp(radius, 0, Math.min(w, h));

	const shape = new THREE.Shape();
	shape.moveTo(-w + r, -h);
	shape.lineTo(w - r, -h);
	shape.quadraticCurveTo(w, -h, w, -h + r);
	shape.lineTo(w, h - r);
	shape.quadraticCurveTo(w, h, w - r, h);
	shape.lineTo(-w + r, h);
	shape.quadraticCurveTo(-w, h, -w, h - r);
	shape.lineTo(-w, -h + r);
	shape.quadraticCurveTo(-w, -h, -w + r, -h);
	return shape;
}

/**
 * Extrude a shape and centre the result on the origin in all three axes.
 * @param {THREE.Shape} shape
 * @param {{ depth: number, bevel?: number, curveSegments?: number }} options
 */
function extrudeCentred(shape, { depth, bevel = 0, curveSegments = 12 }) {
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth,
		curveSegments,
		bevelEnabled: bevel > 0,
		bevelThickness: bevel,
		bevelSize: bevel,
		bevelSegments: bevel > 0 ? 2 : 0
	});
	geometry.center();
	geometry.computeVertexNormals();
	// ExtrudeGeometry UVs are in world units; normalise them so shaders and
	// textures behave like they would on a plane.
	normaliseUv(geometry);
	return geometry;
}

/**
 * Remap a geometry's UVs into 0..1 based on its own bounding box.
 * @param {THREE.BufferGeometry} geometry
 */
export function normaliseUv(geometry) {
	const uv = geometry.getAttribute('uv');
	if (!uv) return geometry;

	geometry.computeBoundingBox();
	const box = geometry.boundingBox;
	if (!box) return geometry;

	const width = box.max.x - box.min.x || 1;
	const height = box.max.y - box.min.y || 1;
	const position = geometry.getAttribute('position');

	for (let i = 0; i < uv.count; i++) {
		uv.setXY(i, (position.getX(i) - box.min.x) / width, (position.getY(i) - box.min.y) / height);
	}
	uv.needsUpdate = true;
	return geometry;
}

/**
 * Solid rounded slab: glass, display, camera plate, battery cell.
 * @param {{ width?: number, height?: number, depth?: number, radius?: number, bevel?: number }} [options]
 */
export function createSlabGeometry(options = {}) {
	const {
		width = PHONE.width,
		height = PHONE.height,
		depth = 0.03,
		radius = PHONE.corner,
		bevel = Math.min(depth * 0.25, 0.008)
	} = options;

	return extrudeCentred(roundedRectShape(width, height, radius), { depth, bevel });
}

/**
 * Hollow rounded rail: the titanium chassis. A ring, not a filled box, so you
 * can see through the middle of the stack.
 * @param {{ width?: number, height?: number, depth?: number, radius?: number, wall?: number }} [options]
 */
export function createRailGeometry(options = {}) {
	const {
		width = PHONE.width,
		height = PHONE.height,
		depth = PHONE.depth,
		radius = PHONE.corner,
		wall = 0.055
	} = options;

	const outer = roundedRectShape(width, height, radius);
	const innerWidth = Math.max(width - wall * 2, 1e-3);
	const innerHeight = Math.max(height - wall * 2, 1e-3);
	const hole = roundedRectShape(innerWidth, innerHeight, Math.max(radius - wall, 0.01));
	outer.holes.push(new THREE.Path(hole.getPoints(24)));

	return extrudeCentred(outer, { depth, bevel: 0.006 });
}

/**
 * Deterministic chip layout for the logic board, in units of the board size.
 * Exposed so the layout can be asserted in tests instead of eyeballed.
 */
export function createChipLayout() {
	return [
		{ name: 'npu', x: 0, y: 0.02, width: 0.34, height: 0.34, depth: 0.05, emissive: true },
		{ name: 'modem', x: -0.3, y: 0.26, width: 0.2, height: 0.16, depth: 0.035, emissive: false },
		{ name: 'ram', x: 0.3, y: 0.26, width: 0.22, height: 0.14, depth: 0.035, emissive: false },
		{ name: 'pmic', x: -0.3, y: -0.24, width: 0.18, height: 0.18, depth: 0.03, emissive: false },
		{ name: 'storage', x: 0.3, y: -0.24, width: 0.24, height: 0.16, depth: 0.03, emissive: false },
		{ name: 'connector', x: 0, y: -0.38, width: 0.42, height: 0.06, depth: 0.02, emissive: false }
	];
}

/** Lens positions for the penta camera array, in plate-relative units. */
export function createLensLayout() {
	return [
		{ name: 'wide', x: -0.17, y: 0.17, radius: 0.13 },
		{ name: 'ultrawide', x: 0.17, y: 0.17, radius: 0.13 },
		{ name: 'tele', x: -0.17, y: -0.17, radius: 0.13 },
		{ name: 'periscope', x: 0.17, y: -0.17, radius: 0.13 },
		{ name: 'tof', x: 0, y: 0, radius: 0.075 }
	];
}

/**
 * Soft contact shadow: a radial falloff quad that sits under the device and
 * grounds it, without needing a shadow map.
 * @param {number} radius
 */
export function createContactShadow(radius = PHONE.width * 1.6) {
	const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
	const material = new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: { uOpacity: { value: 0.55 } },
		vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
		fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.0, 1.0, d));
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOpacity);
      }
    `
	});

	const mesh = new THREE.Mesh(geometry, material);
	mesh.rotation.x = -Math.PI / 2;
	mesh.renderOrder = -1;
	return { mesh, geometry, material };
}

/**
 * Speaker grille: real holes, evenly spaced along the bottom rail. Returned as
 * positions for an `InstancedMesh` so 24 holes cost one draw call.
 * @param {{ count?: number, span?: number, y?: number }} [options]
 */
export function createGrilleLayout(options = {}) {
	const { count = 14, span = PHONE.width * 0.42, y = -PHONE.height / 2 + 0.02 } = options;
	const safeCount = Math.max(1, Math.floor(count));
	const step = safeCount > 1 ? span / (safeCount - 1) : 0;

	return Array.from({ length: safeCount }, (_, index) => ({
		x: -span / 2 + step * index,
		y,
		radius: 0.012
	}));
}

/**
 * Chassis screws: the single cheapest detail that makes a render read as a real
 * machined product rather than a smooth CAD preview.
 * @param {{ width?: number, height?: number, inset?: number }} [options]
 */
export function createScrewLayout(options = {}) {
	const { width = PHONE.width, height = PHONE.height, inset = 0.11 } = options;
	const x = width / 2 - inset;
	const y = height / 2 - inset;

	return [
		{ name: 'tl', x: -x, y },
		{ name: 'tr', x, y },
		{ name: 'bl', x: -x, y: -y },
		{ name: 'br', x, y: -y },
		{ name: 'ml', x: -x, y: 0 },
		{ name: 'mr', x, y: 0 }
	];
}

/**
 * Antenna break lines on the titanium rail, as normalised heights (-0.5..0.5).
 */
export function createAntennaLines() {
	return [0.34, 0.02, -0.3];
}

/**
 * Flex cable: a swept tube along a smooth curve, so the board and the display
 * stay physically connected while the stack pulls apart.
 *
 * @param {{ from?: [number, number, number], to?: [number, number, number], bulge?: number, radius?: number, segments?: number }} [options]
 */
export function createFlexCableGeometry(options = {}) {
	const { from = [0, 0, 0], to = [0, 1, 0], bulge = 0.25, radius = 0.012, segments = 48 } = options;

	const start = new THREE.Vector3(...from);
	const end = new THREE.Vector3(...to);
	const middle = start.clone().lerp(end, 0.5);
	// Push the midpoint sideways so the cable bows instead of stretching straight.
	middle.x += bulge;

	const curve = new THREE.CatmullRomCurve3([start, middle, end], false, 'catmullrom', 0.5);
	return new THREE.TubeGeometry(curve, Math.max(4, segments), Math.max(radius, 1e-4), 8, false);
}
