import * as THREE from 'three';

const EASE = {
  power2InOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  power3Out: (t) => 1 - Math.pow(1 - t, 3),
  smoothstep: (t) => THREE.MathUtils.smoothstep(t, 0, 1),
};

export class CinematicRig {
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

    // 8 Cinematic Scenes Camera Trajectory
    this.keyframes = [
      { progress: 0.00, pos: [0, 0, 4.8], target: [0, 0, 0], fov: 45, roll: 0 },
      { progress: 0.12, pos: [0.35, 0.1, 3.6], target: [0, 0, 0], fov: 40, roll: -0.02 },
      { progress: 0.25, pos: [0.0, 0.0, 2.1], target: [0, 0, 0], fov: 35, roll: 0 },
      { progress: 0.35, pos: [0.35, 0.45, 1.8], target: [0.3, 0.45, 0], fov: 30, roll: 0.03 },
      { progress: 0.53, pos: [1.8, 0.3, 3.2], target: [0, 0, 0], fov: 45, roll: -0.04 },
      { progress: 0.67, pos: [0.0, 0.2, 2.6], target: [0, 0.2, 0], fov: 42, roll: 0 },
      { progress: 0.77, pos: [-0.3, -0.3, 2.4], target: [0, -0.3, 0], fov: 40, roll: 0.02 },
      { progress: 0.88, pos: [0.0, 0.0, 2.8], target: [0, 0, 0], fov: 45, roll: 0 },
      { progress: 1.00, pos: [0, 0, 4.8], target: [0, 0, 0], fov: 45, roll: 0 },
    ];
  }

  triggerShake(intensity = 0.05) {
    this.shakeIntensity = intensity;
  }

  update(progress, deltaTime, elapsedTime) {
    let k1 = this.keyframes[0];
    let k2 = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (progress >= this.keyframes[i].progress && progress <= this.keyframes[i + 1].progress) {
        k1 = this.keyframes[i];
        k2 = this.keyframes[i + 1];
        break;
      }
    }

    const range = k2.progress - k1.progress || 1;
    const rawT = (progress - k1.progress) / range;
    const t = EASE.smoothstep(rawT);

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

    // Frame-rate independent lerp using dt
    const lerpFactor = 1 - Math.exp(-6 * deltaTime);
    this.currentPos.lerp(this.targetPos, lerpFactor);
    this.currentLookAt.lerp(this.targetLookAt, lerpFactor);
    this.currentFov += (this.targetFov - this.currentFov) * lerpFactor;
    this.rollAngle += (this.targetRoll - this.rollAngle) * lerpFactor;

    // Perlin-like camera breathing
    const breathX = Math.sin(elapsedTime * 0.8) * 0.012;
    const breathY = Math.cos(elapsedTime * 0.6) * 0.012;

    // Event impact shake decay
    let shakeX = 0, shakeY = 0;
    if (this.shakeIntensity > 0.001) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.9;
    }

    this.camera.position.set(
      this.currentPos.x + breathX + shakeX,
      this.currentPos.y + breathY + shakeY,
      this.currentPos.z
    );

    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    this.camera.lookAt(this.currentLookAt);
    this.camera.rotation.z += this.rollAngle;
  }
}
