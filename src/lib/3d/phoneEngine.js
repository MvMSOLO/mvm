import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CameraController } from './CameraController.js';
import { ParticleSystem } from './ParticleSystem.js';
import { LabelSystem } from './LabelSystem.js';
import {
  updateHeroScene,
  updateDisplayScene,
  updateCameraScene,
  updateExplodedScene,
  updatePerformanceScene,
  updateBatteryScene,
  updateAIScene,
  updateFinalScene,
} from './scenes/sceneManager.js';

export class PhoneSceneEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050609);
    this.scene.fog = new THREE.FogExp2(0x050609, 0.08);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    this.cameraController = new CameraController(this.camera);
    this.particleSystem = new ParticleSystem(this.scene);
    this.labelSystem = new LabelSystem(this.camera, container);

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      precision: 'mediump',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    container.appendChild(this.renderer.domElement);

    // Main Group
    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);

    this.basePhoneGroup = new THREE.Group();
    this.explodedGroup = new THREE.Group();
    this.mainGroup.add(this.basePhoneGroup);
    this.mainGroup.add(this.explodedGroup);

    this.layers = {
      glass: new THREE.Group(),
      display: new THREE.Group(),
      frame: new THREE.Group(),
      camera: new THREE.Group(),
      board: new THREE.Group(),
      battery: new THREE.Group(),
    };

    Object.values(this.layers).forEach((layer) => this.explodedGroup.add(layer));

    this.accentColorHex = 0xffffff;
    this.scrollProgress = 0;
    this.shaderMaterials = {};

    this.initLights();
    this.buildProceduralExplodedLayers();
    this.loadBaseModel();
    this.bindEvents();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.reqId = requestAnimationFrame(this.animate);
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
    this.keyLight.position.set(3, 5, 4);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
    this.fillLight.position.set(-4, -2, -2);
    this.scene.add(this.fillLight);

    this.backLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.backLight.position.set(0, 2, -4);
    this.scene.add(this.backLight);
  }

  loadBaseModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/nova_one.glb',
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);
        const scale = 2.4 / Math.max(size.x, size.y, size.z);
        model.scale.set(scale, scale, scale);

        model.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x3a3d46,
              metalness: 0.8,
              roughness: 0.3,
            });
          }
        });

        this.basePhoneGroup.add(model);
        if (this.options.onProgress) this.options.onProgress(1.0);
      },
      null,
      () => this.buildFallbackBasePhone()
    );
  }

  buildFallbackBasePhone() {
    const bodyGeo = new THREE.BoxGeometry(1.3, 2.7, 0.12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3d46, metalness: 0.8, roughness: 0.3 });
    this.basePhoneGroup.add(new THREE.Mesh(bodyGeo, bodyMat));
    if (this.options.onProgress) this.options.onProgress(1.0);
  }

  buildProceduralExplodedLayers() {
    const width = 1.3, height = 2.7, thickness = 0.04;

    const glassMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.92, opacity: 0.95, transparent: true })
    );
    this.layers.glass.add(glassMesh);

    this.shaderMaterials.displayShader = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScroll: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime; uniform float uScroll; varying vec2 vUv;
        void main() {
          vec3 bg = vec3(0.04, 0.06, 0.12);
          float sweep = smoothstep(0.0, 0.04, abs(vUv.y - mod(uTime * 0.4 + uScroll, 1.2)));
          gl_FragColor = vec4(bg + (1.0 - sweep) * vec3(0.0, 0.8, 1.0), 0.95);
        }
      `,
      transparent: true,
    });
    this.layers.display.add(new THREE.Mesh(new THREE.PlaneGeometry(width * 0.95, height * 0.96), this.shaderMaterials.displayShader));

    this.layers.frame.add(new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), new THREE.MeshStandardMaterial({ color: 0x5a5d65, metalness: 0.8 })));
    this.layers.battery.add(new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, height * 0.45, 0.03), new THREE.MeshStandardMaterial({ color: 0x2f3138, metalness: 0.7 })));

    // Board Shader
    this.shaderMaterials.boardShader = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScroll: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime; uniform float uScroll; varying vec2 vUv;
        void main() {
          vec3 bg = vec3(0.05, 0.1, 0.2);
          float trace = step(0.95, sin(vUv.x * 40.0 + uTime * 3.0 + uScroll * 10.0));
          gl_FragColor = vec4(bg + trace * vec3(0.0, 0.8, 1.0), 0.95);
        }
      `,
      transparent: true,
    });
    this.layers.board.add(new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, height * 0.45), this.shaderMaterials.boardShader));

    this.explodedGroup.visible = false;
  }

  bindEvents() {
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize, false);
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  updateProgress(progress) {
    this.scrollProgress = progress;

    if (progress < 0.12) updateHeroScene(this, progress / 0.12);
    else if (progress < 0.25) updateDisplayScene(this, (progress - 0.12) / 0.13);
    else if (progress < 0.35) updateCameraScene(this, (progress - 0.25) / 0.10);
    else if (progress < 0.53) updateExplodedScene(this, (progress - 0.35) / 0.18);
    else if (progress < 0.67) updatePerformanceScene(this, (progress - 0.53) / 0.14);
    else if (progress < 0.77) updateBatteryScene(this, (progress - 0.67) / 0.10);
    else if (progress < 0.88) updateAIScene(this, (progress - 0.77) / 0.11);
    else updateFinalScene(this, (progress - 0.88) / 0.12);
  }

  setMaterialFinish(finishName) {
    let colorHex = 0x3a3d46;
    if (finishName === 'Titanium') colorHex = 0x4a4d56;
    if (finishName === 'Obsidian') colorHex = 0x1a1d20;
    if (finishName === 'Silver') colorHex = 0xd0d5dd;

    this.basePhoneGroup.traverse((child) => {
      if (child.isMesh && child.material) child.material.color.setHex(colorHex);
    });
  }

  animate() {
    this.reqId = requestAnimationFrame(this.animate);
    const elapsedTime = this.clock.getElapsedTime();

    this.cameraController.update(this.scrollProgress, elapsedTime);
    this.particleSystem.update(elapsedTime, this.accentColorHex);

    if (this.shaderMaterials.displayShader) {
      this.shaderMaterials.displayShader.uniforms.uTime.value = elapsedTime;
    }
    if (this.shaderMaterials.boardShader) {
      this.shaderMaterials.boardShader.uniforms.uTime.value = elapsedTime;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.reqId);
    window.removeEventListener('resize', this.onWindowResize);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}
