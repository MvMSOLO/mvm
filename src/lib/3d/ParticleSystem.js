import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.count = 250;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const scales = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      scales[i] = Math.random() * 0.04 + 0.01;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.03,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  update(time, energyColorHex = 0x00f0ff) {
    if (this.points) {
      this.points.rotation.y = time * 0.02;
      this.points.rotation.x = Math.sin(time * 0.01) * 0.05;
      this.points.material.color.setHex(energyColorHex);
    }
  }
}
