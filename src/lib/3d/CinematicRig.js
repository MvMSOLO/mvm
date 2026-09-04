import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

/**
 * Camera rig driven by scroll progress.
 *
 * Keyframes are *framing* descriptions, not absolute world positions:
 * an orbit direction (`yaw` / `pitch`), a focal length (`fov`), and a `fill`
 * factor saying how much of the frame the subject should occupy. Every frame
 * the rig is told the subject's world bounding sphere (`setSubject`) and it
 * solves the camera distance from it:
 *
 *   distance = (radius / fill) / tan(effectiveHalfAngle)
 *
 * where `effectiveHalfAngle` accounts for the viewport aspect ratio, so the
 * subject stays inside the frame on both axes. This is why the shot can never
 * silently break when the model, the exploded stack spacing or the canvas size
 * changes - the older version hard-coded positions authored for one specific
 * model scale, which is exactly how the middle chapters ended up empty or
 * cropped.
 */
export class CinematicRig {
	/** @param {THREE.PerspectiveCamera} camera */
	constructor(camera) {
		this.camera = camera;

		/** Subject bounding sphere in world space, updated by the engine. */
		this.subjectCenter = new THREE.Vector3(0, 0, 0);
		this.subjectRadius = 1.6;

		this.currentPos = new THREE.Vector3(0, 0, 6);
		this.targetPos = new THREE.Vector3(0, 0, 6);
		this.currentLookAt = new THREE.Vector3(0, 0, 0);
		this.targetLookAt = new THREE.Vector3(0, 0, 0);

		// Orbit state is kept in polar form (angles + distance) rather than as a
		// world position. Damping a world position means a large scroll jump sends
		// the camera on a straight line *through* the subject, which is what made
		// the frame flash empty; damping the angles keeps it on the orbit sphere,
		// so the subject stays framed the whole way.
		this.currentYaw = 0;
		this.currentPitch = 0.06;
		this.currentDistance = 6;
		this.hasOrbit = false;

		this.currentFov = 45;
		this.targetFov = 45;
		this.rollAngle = 0;
		this.targetRoll = 0;
		this.shakeIntensity = 0;

		/** Set true once a real subject has been measured. */
		this.hasSubject = false;

		/**
		 * Keyframe boundaries match the chapter ranges in `$lib/data/product.js`.
		 *
		 * yaw/pitch: orbit angles in radians (yaw 0 = straight on the front face).
		 * fov:       vertical field of view in degrees.
		 * fill:      subject radius as a fraction of the half-frame. 1 = the
		 *            bounding sphere exactly touches the frame edges, so anything
		 *            below 1 is guaranteed to be fully visible.
		 * offset:    look-at shift in subject-radius units (x, y).
		 * roll:      camera roll in radians.
		 */
		this.keyframes = [
			{ progress: 0.0, yaw: 0.0, pitch: 0.06, fov: 45, fill: 0.62, offset: [0, 0], roll: 0 },
			{
				progress: 0.12,
				yaw: 0.22,
				pitch: 0.1,
				fov: 42,
				fill: 0.74,
				offset: [0.05, 0],
				roll: -0.02
			},
			{ progress: 0.25, yaw: -0.1, pitch: 0.02, fov: 38, fill: 0.86, offset: [0, 0.02], roll: 0 },
			{
				progress: 0.35,
				yaw: 0.5,
				pitch: 0.28,
				fov: 34,
				fill: 0.82,
				offset: [0.04, 0.1],
				roll: 0.03
			},
			{ progress: 0.53, yaw: 0.75, pitch: 0.18, fov: 45, fill: 0.7, offset: [0, 0], roll: -0.04 },
			{ progress: 0.67, yaw: 0.32, pitch: 0.12, fov: 44, fill: 0.76, offset: [0, 0.04], roll: 0 },
			{
				progress: 0.77,
				yaw: -0.28,
				pitch: -0.16,
				fov: 42,
				fill: 0.78,
				offset: [0, -0.04],
				roll: 0.02
			},
			{ progress: 0.88, yaw: -0.08, pitch: 0.05, fov: 45, fill: 0.72, offset: [0, 0], roll: 0 },
			{ progress: 1.0, yaw: 0.0, pitch: 0.04, fov: 45, fill: 0.6, offset: [0, 0], roll: 0 }
		];
	}

	/**
	 * Feed the rig the world-space bounding sphere of whatever is on screen.
	 * @param {THREE.Vector3} center
	 * @param {number} radius
	 */
	setSubject(center, radius) {
		if (!Number.isFinite(radius) || radius <= 0) return;
		this.subjectCenter.copy(center);
		// Damp the measured radius so a chapter swap does not snap the framing.
		this.subjectRadius = this.hasSubject
			? THREE.MathUtils.lerp(this.subjectRadius, radius, 0.15)
			: radius;
		this.hasSubject = true;
	}

	/** @param {number} [intensity] */
	triggerShake(intensity = 0.04) {
		this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
	}

	/**
	 * Half of the smaller frustum angle, in radians: the axis that clips first.
	 * @param {number} fovDeg
	 */
	effectiveHalfAngle(fovDeg) {
		const vertical = Math.tan((fovDeg * DEG2RAD) / 2);
		const aspect =
			Number.isFinite(this.camera.aspect) && this.camera.aspect > 0 ? this.camera.aspect : 1;
		return Math.atan(vertical * Math.min(1, aspect));
	}

	/**
	 * Distance at which a sphere of `radius` fills `fill` of the frame.
	 * @param {number} radius
	 * @param {number} fov
	 * @param {number} fill
	 */
	framingDistance(radius, fov, fill) {
		const safeFill = THREE.MathUtils.clamp(fill, 0.1, 1);
		return radius / safeFill / Math.tan(this.effectiveHalfAngle(fov));
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

		const yaw = THREE.MathUtils.lerp(k1.yaw, k2.yaw, t);
		const pitch = THREE.MathUtils.lerp(k1.pitch, k2.pitch, t);
		const fill = THREE.MathUtils.lerp(k1.fill, k2.fill, t);
		const offsetX = THREE.MathUtils.lerp(k1.offset[0], k2.offset[0], t);
		const offsetY = THREE.MathUtils.lerp(k1.offset[1], k2.offset[1], t);
		this.targetFov = THREE.MathUtils.lerp(k1.fov, k2.fov, t);
		this.targetRoll = THREE.MathUtils.lerp(k1.roll, k2.roll, t);

		const radius = this.subjectRadius;
		const distance = this.framingDistance(radius, this.targetFov, fill);

		// The look-at point drifts inside the subject, never outside it, so the
		// bounding sphere always stays within the guaranteed framing.
		this.targetLookAt.set(
			this.subjectCenter.x + offsetX * radius * 0.5,
			this.subjectCenter.y + offsetY * radius * 0.5,
			this.subjectCenter.z
		);

		const dir = new THREE.Vector3(
			Math.sin(yaw) * Math.cos(pitch),
			Math.sin(pitch),
			Math.cos(yaw) * Math.cos(pitch)
		);
		this.targetPos.copy(this.targetLookAt).addScaledVector(dir, distance);

		const factor = 1 - Math.exp(-6 * Math.max(deltaTime, 0.0001));

		if (!this.hasOrbit) {
			this.currentYaw = yaw;
			this.currentPitch = pitch;
			this.currentDistance = distance;
			this.currentLookAt.copy(this.targetLookAt);
			this.hasOrbit = true;
		} else {
			// Take the short way round so a yaw wrap never swings the long way.
			const deltaYaw = Math.atan2(Math.sin(yaw - this.currentYaw), Math.cos(yaw - this.currentYaw));
			this.currentYaw += deltaYaw * factor;
			this.currentPitch += (pitch - this.currentPitch) * factor;
			this.currentDistance += (distance - this.currentDistance) * factor;
			this.currentLookAt.lerp(this.targetLookAt, factor);
		}

		// Never let the damped distance collapse inside the subject, whatever the
		// scroll does.
		this.currentDistance = Math.max(this.currentDistance, radius * 1.05);

		const currentDir = new THREE.Vector3(
			Math.sin(this.currentYaw) * Math.cos(this.currentPitch),
			Math.sin(this.currentPitch),
			Math.cos(this.currentYaw) * Math.cos(this.currentPitch)
		);
		this.currentPos.copy(this.currentLookAt).addScaledVector(currentDir, this.currentDistance);
		this.currentFov += (this.targetFov - this.currentFov) * factor;
		this.rollAngle += (this.targetRoll - this.rollAngle) * factor;

		// Idle breath and shake scale with the subject so they read the same at
		// any model size.
		const amplitude = radius * 0.008;
		const breathX = elapsedTime ? Math.sin(elapsedTime * 0.8) * amplitude : 0;
		const breathY = elapsedTime ? Math.cos(elapsedTime * 0.6) * amplitude : 0;

		let shakeX = 0;
		let shakeY = 0;
		if (this.shakeIntensity > 0.001) {
			shakeX = (Math.random() - 0.5) * this.shakeIntensity * radius;
			shakeY = (Math.random() - 0.5) * this.shakeIntensity * radius;
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

		// Keep the depth range tight around the subject for good z-precision, but
		// never clip it.
		const eyeDistance = this.camera.position.distanceTo(this.subjectCenter);
		const near = Math.max(0.01, (eyeDistance - radius * 1.6) * 0.5);
		const far = eyeDistance + radius * 6 + 10;
		const fovChanged = Math.abs(this.camera.fov - this.currentFov) > 0.001;
		if (
			fovChanged ||
			Math.abs(this.camera.near - near) > 1e-4 ||
			Math.abs(this.camera.far - far) > 1e-3
		) {
			this.camera.fov = this.currentFov;
			this.camera.near = near;
			this.camera.far = far;
			this.camera.updateProjectionMatrix();
		}

		// lookAt rewrites the full rotation, so roll is applied afterwards.
		this.camera.lookAt(this.currentLookAt);
		this.camera.rotation.z += this.rollAngle;
	}
}
