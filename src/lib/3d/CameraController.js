import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.currentPosition = new THREE.Vector3(0, 0, 4.8);
    this.targetPosition = new THREE.Vector3(0, 0, 4.8);
    this.lookAtTarget = new THREE.Vector3(0, 0, 0);
    this.currentTarget = new THREE.Vector3(0, 0, 0);

    // Camera Flight Keyframes for 8 cinematic scenes
    this.keyframes = [
      { progress: 0.00, pos: [0, 0, 4.8], target: [0, 0, 0] },
      { progress: 0.12, pos: [0.35, 0.1, 3.6], target: [0, 0, 0] },
      { progress: 0.25, pos: [0.0, 0.0, 2.2], target: [0, 0, 0] },
      { progress: 0.35, pos: [0.35, 0.4, 2.0], target: [0.3, 0.4, 0] },
      { progress: 0.53, pos: [1.8, 0.3, 3.2], target: [0, 0, 0] },
      { progress: 0.67, pos: [0.0, 0.2, 2.6], target: [0, 0.2, 0] },
      { progress: 0.77, pos: [-0.3, -0.3, 2.4], target: [0, -0.3, 0] },
      { progress: 0.88, pos: [0.0, 0.0, 2.8], target: [0, 0, 0] },
      { progress: 1.00, pos: [0, 0, 4.8], target: [0, 0, 0] },
    ];
  }

  update(progress, elapsedTime) {
    // Find keyframe segment
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
    const t = (progress - k1.progress) / range;
    const easedT = THREE.MathUtils.smoothstep(t, 0, 1);

    this.targetPosition.set(
      THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easedT),
      THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easedT),
      THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easedT)
    );

    this.lookAtTarget.set(
      THREE.MathUtils.lerp(k1.target[0], k2.target[0], easedT),
      THREE.MathUtils.lerp(k1.target[1], k2.target[1], easedT),
      THREE.MathUtils.lerp(k1.target[2], k2.target[2], easedT)
    );

    // Camera subtle breathing idle motion
    const breathingX = Math.sin(elapsedTime * 0.8) * 0.015;
    const breathingY = Math.cos(elapsedTime * 0.6) * 0.015;

    this.currentPosition.lerp(this.targetPosition, 0.08);
    this.currentTarget.lerp(this.lookAtTarget, 0.08);

    this.camera.position.set(
      this.currentPosition.x + breathingX,
      this.currentPosition.y + breathingY,
      this.currentPosition.z
    );

    this.camera.lookAt(this.currentTarget);
  }
}
