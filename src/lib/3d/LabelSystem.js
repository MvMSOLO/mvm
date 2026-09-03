import * as THREE from 'three';

export class LabelSystem {
  constructor(camera, container) {
    this.camera = camera;
    this.container = container;
  }

  projectToScreen(vector3) {
    const vector = vector3.clone();
    vector.project(this.camera);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const x = (vector.x * 0.5 + 0.5) * width;
    const y = (-vector.y * 0.5 + 0.5) * height;

    return { x, y, visible: vector.z < 1 };
  }
}
