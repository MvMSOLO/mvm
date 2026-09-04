/**
 * Frame-rate independent spring integrator.
 *
 * Every motion in the scene used to be an exponential `lerp`, which always
 * arrives "softly" and never has weight: a battery cell and a sheet of glass
 * move identically. A spring has stiffness and damping, so each part can have
 * its own mass and settle with a hint of overshoot - that is what makes an
 * assembly read as mechanical instead of as a slideshow.
 *
 * The integrator is semi-implicit Euler with a fixed internal substep, so the
 * result is identical at 30, 60 or 144 fps (an explicit spring with a variable
 * dt explodes on a long frame - exactly the scroll-jump artefact we hit).
 */

const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 8;

/**
 * @typedef {object} SpringState
 * @property {number} value
 * @property {number} velocity
 */

/**
 * @typedef {object} SpringConfig
 * @property {number} [stiffness] Higher = snappier. Default 120.
 * @property {number} [damping]   Higher = less overshoot. Default 18.
 * @property {number} [mass]      Higher = heavier, slower. Default 1.
 */

/** Named presets so the whole scene shares one motion vocabulary. */
export const SPRINGS = {
	/** Glass / display: light, crisp, tiny overshoot. */
	light: { stiffness: 210, damping: 14, mass: 0.6 },
	/** Chassis and boards: the default feel. */
	solid: { stiffness: 150, damping: 21, mass: 1 },
	/** Battery: visibly the heaviest part in the device. */
	heavy: { stiffness: 110, damping: 24, mass: 1.7 },
	/** Camera / rig moves: no overshoot at all, critically damped. */
	critical: { stiffness: 140, damping: 24, mass: 1 }
};

/**
 * @param {number} value
 * @returns {SpringState}
 */
export function createSpring(value = 0) {
	return { value, velocity: 0 };
}

/**
 * Advance a spring towards `target`.
 *
 * @param {SpringState} state mutated in place (zero allocations per frame)
 * @param {number} target
 * @param {number} deltaTime seconds
 * @param {SpringConfig} [config]
 * @returns {SpringState}
 */
export function stepSpring(state, target, deltaTime, config = {}) {
	const stiffness = config.stiffness ?? 120;
	const damping = config.damping ?? 18;
	const mass = Math.max(config.mass ?? 1, 1e-3);

	if (!Number.isFinite(target)) return state;
	if (!Number.isFinite(deltaTime) || deltaTime <= 0) return state;

	// Clamp the simulated time so a 3-second stall (tab wake, huge scroll jump)
	// cannot turn into 360 substeps of catch-up.
	let remaining = Math.min(deltaTime, SUBSTEP * MAX_SUBSTEPS);

	while (remaining > 0) {
		const h = Math.min(SUBSTEP, remaining);
		const acceleration = (-stiffness * (state.value - target) - damping * state.velocity) / mass;
		state.velocity += acceleration * h;
		state.value += state.velocity * h;
		remaining -= h;
	}

	// Snap when the motion is below display resolution, so springs do not idle
	// forever and keep the render loop awake.
	if (Math.abs(state.value - target) < 1e-4 && Math.abs(state.velocity) < 1e-3) {
		state.value = target;
		state.velocity = 0;
	}

	return state;
}

/**
 * Snap a spring to a value, killing velocity. Used when a chapter change should
 * be instant (reduced motion) rather than animated.
 * @param {SpringState} state
 * @param {number} value
 */
export function snapSpring(state, value) {
	state.value = value;
	state.velocity = 0;
	return state;
}

/**
 * A spring per axis, for positions.
 * @param {number} [x] @param {number} [y] @param {number} [z]
 */
export function createVectorSpring(x = 0, y = 0, z = 0) {
	return { x: createSpring(x), y: createSpring(y), z: createSpring(z) };
}

/**
 * Step a vector spring and write the result into an object with x/y/z
 * (typically a `THREE.Vector3`), without allocating.
 *
 * @param {{ x: SpringState, y: SpringState, z: SpringState }} springs
 * @param {{ x: number, y: number, z: number }} target
 * @param {number} deltaTime
 * @param {SpringConfig} [config]
 * @param {{ x: number, y: number, z: number }} [out]
 */
export function stepVectorSpring(springs, target, deltaTime, config, out) {
	stepSpring(springs.x, target.x, deltaTime, config);
	stepSpring(springs.y, target.y, deltaTime, config);
	stepSpring(springs.z, target.z, deltaTime, config);
	if (out) {
		out.x = springs.x.value;
		out.y = springs.y.value;
		out.z = springs.z.value;
	}
	return springs;
}
