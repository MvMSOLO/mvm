import * as THREE from 'three';

/**
 * Camera rig driven by scroll progress.
 *
 * Interpolates position, look-at target, focal length and roll across a
 * keyframe table, then adds frame-rate independent smoothing, a subtle idle
 * breath and a decaying impact shake.
 */
export class CinematicRig {
	/** @param {THREE.PerspectiveCamera} camera */
	constructor(camera) {
		this.camera = camera;

		this.currentPos = new THREE.Vector3(0, 0, 4.8);
		this.targetPos = new THREE.Vector3(0, 0, 4.8);
		this.currentLookAt = new THREE.Vector3(0, 0, 0);
		this.targetLookAt = new THREE.Vector3(0, 0, 0);

		this.currentFov = 45;
		this.targetFov = 45;
		this.rollAngle = 0;
		this.targetRoll = 0;
		this.shakeIntensity = 0;

		/**
		 * Keyframe boundaries match the chapter ranges in `$lib/data/product.js`.
		 * pos/target are world space; fov in degrees; roll in radians.
		 */
		this.keyframes = [
			{ progress: 0.0, pos: [0, 0, 4.8], target: [0, 0, 0], fov: 45, roll: 0 },
			{ progress: 0.12, pos: [0.35, 0.1, 3.6], target: [0, 0, 0], fov: 40, roll: -0.02 },
			{ progress: 0.25, pos: [0.0, 0.0, 2.1], target: [0, 0, 0], fov: 35, roll: 0 },
			{ progress: 0.35, pos: [0.35, 0.45, 1.8], target: [0.25, 0.4, 0], fov: 30, roll: 0.03 },
			{ progress: 0.53, pos: [1.8, 0.3, 3.2], target: [0, 0, 0], fov: 45, roll: -0.04 },
			{ progress: 0.67, pos: [0.0, 0.2, 2.6], target: [0, 0.2, 0], fov: 42, roll: 0 },
			{ progress: 0.77, pos: [-0.35, -0.3, 2.4], target: [0, -0.25, 0], fov: 40, roll: 0.02 },
			{ progress: 0.88, pos: [0.0, 0.0, 2.8], target: [0, 0, 0], fov: 45, roll: 0 },
			{ progress: 1.0, pos: [0, 0, 4.6], target: [0, 0, 0], fov: 45, roll: 0 }
		];
	}

	/** @param {number} [intensity] */
	triggerShake(intensity = 0.04) {
		this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
	}

	/**
	 * Locate the keyframe pair bracketing `progress`.
	 * @param {number} progress
	 */
	segmentAt(progress) {
		const frames = this.keyframes;
		for (let i = 0; i < frames.length - 1; i++) {
			if (progress >= frames[i].progress && progress <= frames[i + 1].progress) {
				return [frames[i], frames[i + 1]];
			}
		}
		return progress < frames[0].progress
			? [frames[0], frames[0]]
			: [frames[frames.length - 1], frames[frames.length - 1]];
	}

	/**
	 * @param {number} progress 0..1
	 * @param {number} deltaTime seconds since last frame
	 * @param {number} elapsedTime seconds since start (pass 0 to disable idle motion)
	 */
	update(progress, deltaTime, elapsedTime) {
		const clamped = Math.min(Math.max(progress, 0), 1);
		const [k1, k2] = this.segmentAt(clamped);

		const range = k2.progress - k1.progress || 1;
		const t = THREE.MathUtils.smoothstep((clamped - k1.progress) / range, 0, 1);

		this.targetPos.set(
			THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], t),
			THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], t),
			THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], t)
		);
		this.targetLookAt.set(
			THREE.MathUtils.lerp(k1.target[0], k2.target[0], t),
			THREE.MathUtils.lerp(k1.target[1], k2.target[1], t),
			THREE.MathUtils.lerp(k1.target[2], k2.target[2], t)
		);
		this.targetFov = THREE.MathUtils.lerp(k1.fov, k2.fov, t);
		this.targetRoll = THREE.MathUtils.lerp(k1.roll, k2.roll, t);

		const factor = 1 - Math.exp(-6 * Math.max(deltaTime, 0.0001));
		this.currentPos.lerp(this.targetPos, factor);
		this.currentLookAt.lerp(this.targetLookAt, factor);
		this.currentFov += (this.targetFov - this.currentFov) * factor;
		this.rollAngle += (this.targetRoll - this.rollAngle) * factor;

		const breathX = elapsedTime ? Math.sin(elapsedTime * 0.8) * 0.012 : 0;
		const breathY = elapsedTime ? Math.cos(elapsedTime * 0.6) * 0.012 : 0;

		let shakeX = 0;
		let shakeY = 0;
		if (this.shakeIntensity > 0.001) {
			shakeX = (Math.random() - 0.5) * this.shakeIntensity;
			shakeY = (Math.random() - 0.5) * this.shakeIntensity;
			// Time-based decay so the shake lasts the same wall-clock duration
			// regardless of frame rate.
			this.shakeIntensity *= Math.exp(-8 * deltaTime);
		} else {
			this.shakeIntensity = 0;
		}

		this.camera.position.set(
			this.currentPos.x + breathX + shakeX,
			this.currentPos.y + breathY + shakeY,
			this.currentPos.z
		);

		if (Math.abs(this.camera.fov - this.currentFov) > 0.001) {
			this.camera.fov = this.currentFov;
			this.camera.updateProjectionMatrix();
		}

		// lookAt rewrites the full rotation, so roll is applied afterwards.
		this.camera.lookAt(this.currentLookAt);
		this.camera.rotation.z += this.rollAngle;
	}
}
