import * as THREE from 'three';

/**
 * Projects world-space positions into container pixel coordinates so DOM
 * labels can be pinned to 3D geometry.
 */
export class LabelSystem {
	/**
	 * @param {THREE.Camera} camera
	 * @param {HTMLElement} container
	 */
	constructor(camera, container) {
		this.camera = camera;
		this.container = container;
		this.scratch = new THREE.Vector3();
	}

	/**
	 * @param {THREE.Vector3} vector3 world position
	 * @returns {{ x:number, y:number, visible:boolean, depth:number }}
	 */
	projectToScreen(vector3) {
		const vector = this.scratch.copy(vector3).project(this.camera);

		const width = this.container.clientWidth || window.innerWidth;
		const height = this.container.clientHeight || window.innerHeight;

		return {
			x: (vector.x * 0.5 + 0.5) * width,
			y: (-vector.y * 0.5 + 0.5) * height,
			// Behind the camera or outside the frustum edges.
			visible: vector.z < 1 && Math.abs(vector.x) < 1.1 && Math.abs(vector.y) < 1.1,
			depth: vector.z
		};
	}
}
