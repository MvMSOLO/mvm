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

/**
 * Side buttons, as CAD-style placements on the titanium rail.
 *
 * A real device has a power key with a knurled edge on one side and a two-piece
 * volume rocker on the other, both sunk into the rail with a visible seam. The
 * measurements below are the ones a mechanical drawing would carry: position
 * along the height, length, and how far the key stands off the rail.
 *
 * @param {{ height?: number, width?: number }} [options]
 * @returns {Array<{ name: string, side: 'left' | 'right', y: number, length: number, thickness: number, standoff: number, knurled: boolean }>}
 */
export function createButtonLayout(options = {}) {
	const { height = PHONE.height, width = PHONE.width } = options;
	const standoff = width * 0.012;

	return [
		{
			name: 'power',
			side: 'right',
			y: height * 0.14,
			length: height * 0.09,
			thickness: PHONE.depth * 0.42,
			standoff,
			knurled: true
		},
		{
			name: 'volume-up',
			side: 'left',
			y: height * 0.2,
			length: height * 0.07,
			thickness: PHONE.depth * 0.38,
			standoff,
			knurled: false
		},
		{
			name: 'volume-down',
			side: 'left',
			y: height * 0.11,
			length: height * 0.07,
			thickness: PHONE.depth * 0.38,
			standoff,
			knurled: false
		}
	];
}

/**
 * USB-C receptacle: a rounded slot on the bottom rail. Returned as a shape so
 * the caller can extrude it and subtract it, or render it as an inset plate.
 *
 * @param {{ width?: number, height?: number }} [options]
 * @returns {{ shape: THREE.Shape, width: number, height: number, y: number }}
 */
export function createPortShape(options = {}) {
	const { width = PHONE.width * 0.21, height = PHONE.depth * 0.34 } = options;
	return {
		shape: roundedRectShape(width, height, Math.min(width, height) / 2),
		width,
		height,
		y: -PHONE.height / 2
	};
}

/**
 * The raised camera deck. Real flagships do not put lenses on the back panel:
 * there is a milled plateau with a chamfered wall, and the lens barrels sit on
 * top of it. Without the plateau the optics look painted on.
 *
 * @param {{ width?: number, height?: number, rise?: number, chamfer?: number }} [options]
 */
export function createCameraPlateau(options = {}) {
	const {
		width = PHONE.width * 0.62,
		height = PHONE.width * 0.62,
		rise = PHONE.depth * 0.55,
		chamfer = 0.012
	} = options;

	const geometry = new THREE.ExtrudeGeometry(
		roundedRectShape(width - chamfer * 2, height - chamfer * 2, Math.min(width, height) * 0.28),
		{
			depth: Math.max(rise - chamfer, 1e-4),
			bevelEnabled: true,
			bevelThickness: chamfer,
			bevelSize: chamfer,
			bevelSegments: 3,
			curveSegments: 24
		}
	);
	geometry.center();
	normaliseUv(geometry);

	return {
		geometry,
		offset: { x: -PHONE.width * 0.14, y: PHONE.height * 0.3 },
		rise
	};
}

/**
 * Lathe profile for one camera barrel, in cross-section.
 *
 * A real lens barrel is not a cylinder: it steps down through a retaining ring,
 * a knurled focus collar and a chamfer before the cover glass. Because the
 * silhouette is what the eye reads first, these four steps do more for realism
 * than any texture on a straight cylinder would.
 *
 * @param {{ radius?: number, height?: number }} [options]
 * @returns {THREE.Vector2[]} profile points, from the axis outward and up
 */
export function createLensProfile(options = {}) {
	const { radius = 0.13, height = 0.085 } = options;
	const r = Math.max(radius, 1e-4);
	const h = Math.max(height, 1e-4);

	// x = distance from the axis, y = height above the plateau.
	return [
		new THREE.Vector2(0, 0),
		new THREE.Vector2(r * 1.05, 0),
		new THREE.Vector2(r * 1.05, h * 0.18),
		new THREE.Vector2(r * 0.97, h * 0.26),
		new THREE.Vector2(r * 0.97, h * 0.6),
		new THREE.Vector2(r * 0.88, h * 0.72),
		new THREE.Vector2(r * 0.86, h * 0.9),
		new THREE.Vector2(r * 0.72, h),
		new THREE.Vector2(0, h)
	];
}

/**
 * Aperture blade angles. Nine blades is the flagship convention, and it is why
 * point lights in a photo come out as nine-pointed stars.
 * @param {number} [count]
 * @returns {number[]} radians
 */
export function createApertureBladeLayout(count = 9) {
	const safe = Math.max(3, Math.floor(count));
	return Array.from({ length: safe }, (_, i) => (i / safe) * Math.PI * 2);
}

/**
 * Everything punched through the display glass: the front camera hole and the
 * earpiece slot above it.
 * @returns {Array<{ name: string, x: number, y: number, radius?: number, width?: number, height?: number }>}
 */
export function createPunchHoleLayout() {
	return [
		{ name: 'selfie', x: 0, y: PHONE.height * 0.4, radius: 0.052 },
		{
			name: 'earpiece',
			x: 0,
			y: PHONE.height * 0.455,
			width: PHONE.width * 0.22,
			height: 0.018
		}
	];
}

/**
 * Microphone and speaker perforations on the top and bottom rails.
 * @returns {Array<{ name: string, x: number, y: number, radius: number }>}
 */
export function createMicSlotLayout() {
	const bottom = -PHONE.height / 2;
	const top = PHONE.height / 2;
	return [
		{ name: 'mic-bottom', x: -PHONE.width * 0.3, y: bottom + 0.012, radius: 0.014 },
		{ name: 'mic-top', x: PHONE.width * 0.28, y: top - 0.012, radius: 0.012 },
		{ name: 'mic-noise', x: -PHONE.width * 0.05, y: top - 0.012, radius: 0.01 }
	];
}

/**
 * Deterministic copper trace layout for the logic board. Seeded so the same
 * board comes back every run: a board that reshuffles on reload reads as noise.
 *
 * @param {{ count?: number, seed?: number }} [options]
 * @returns {Array<{ x: number, y: number, length: number, vertical: boolean }>}
 */
export function createPcbTraceLayout(options = {}) {
	const { count = 26, seed = 1337 } = options;
	const safe = Math.max(1, Math.floor(count));
	let state = seed >>> 0;
	const random = () => {
		// xorshift32: tiny, dependency-free, and identical across platforms.
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return ((state >>> 0) % 100000) / 100000;
	};

	return Array.from({ length: safe }, (_, index) => {
		const vertical = index % 3 === 0;
		return {
			x: (random() - 0.5) * 0.86,
			y: (random() - 0.5) * 0.86,
			length: 0.08 + random() * 0.3,
			vertical
		};
	});
}
