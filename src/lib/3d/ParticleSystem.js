import * as THREE from 'three';

/**
 * Ambient dust field. Uses a per-point size attribute and a soft circular
 * sprite so points don't read as hard squares, and lerps its colour towards
 * the active chapter accent instead of snapping.
 */
export class ParticleSystem {
	/**
	 * @param {THREE.Scene} scene
	 * @param {number} [count]
	 */
	constructor(scene, count = 320) {
		this.scene = scene;
		this.count = count;
		this.currentColor = new THREE.Color(0x00f0ff);
		this.targetColor = new THREE.Color(0x00f0ff);

		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);
		const sizes = new Float32Array(count);

		for (let i = 0; i < count; i++) {
			// Spherical distribution keeps density even instead of cube-biased.
			const radius = 3 + Math.random() * 5;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);

			positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = radius * Math.cos(phi) * 0.7;
			sizes[i] = Math.random() * 0.03 + 0.008;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: this.currentColor },
				uOpacity: { value: 0.42 },
				uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
			},
			vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uPixelRatio;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * 900.0 * uPixelRatio / -mvPosition.z;
        }
      `,
			fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.0, d) * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});

		this.geometry = geometry;
		this.material = material;
		this.points = new THREE.Points(geometry, material);
		this.points.frustumCulled = false;
		scene.add(this.points);
	}

	/**
	 * @param {number} time elapsed seconds
	 * @param {number} accentHex active chapter accent
	 * @param {boolean} [reducedMotion]
	 */
	update(time, accentHex = 0x00f0ff, reducedMotion = false) {
		this.targetColor.setHex(accentHex);
		this.currentColor.lerp(this.targetColor, 0.04);

		if (!reducedMotion) {
			this.points.rotation.y = time * 0.02;
			this.points.rotation.x = Math.sin(time * 0.01) * 0.05;
		}
	}

	dispose() {
		this.scene.remove(this.points);
		this.geometry.dispose();
		this.material.dispose();
	}
}
