import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class PhoneSceneEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.08);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 4.5);

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      precision: 'mediump',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Groups & Layers
    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);

    this.basePhoneGroup = new THREE.Group();
    this.explodedGroup = new THREE.Group();
    this.mainGroup.add(this.basePhoneGroup);
    this.mainGroup.add(this.explodedGroup);

    // Exploded sub-layers
    this.layers = {
      glass: new THREE.Group(),
      display: new THREE.Group(),
      frame: new THREE.Group(),
      camera: new THREE.Group(),
      board: new THREE.Group(),
      battery: new THREE.Group(),
    };

    Object.values(this.layers).forEach((layer) => this.explodedGroup.add(layer));

    // Interaction targets
    this.targetRotation = { x: 0, y: 0 };
    this.currentRotation = { x: 0, y: 0 };
    this.scrollProgress = 0;
    this.activeSection = 'HERO';
    this.isMobile = window.innerWidth < 768;

    // Shader materials references
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.keyLight.position.set(3, 5, 4);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    this.fillLight.position.set(-4, -2, -2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0x7000ff, 2.0);
    this.rimLight.position.set(0, -4, -3);
    this.scene.add(this.rimLight);

    this.npuLight = new THREE.PointLight(0x00ffff, 0, 5);
    this.npuLight.position.set(0, 0, 0);
    this.scene.add(this.npuLight);

    this.cameraLight = new THREE.PointLight(0xff00aa, 0, 5);
    this.cameraLight.position.set(0.3, 0.5, 0.5);
    this.scene.add(this.cameraLight);
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

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.4 / maxDim;
        model.scale.set(scale, scale, scale);

        model.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x181a20,
              metalness: 0.95,
              roughness: 0.2,
            });
          }
        });

        this.basePhoneGroup.add(model);
        if (this.options.onProgress) {
          this.options.onProgress(1.0);
        }
      },
      (xhr) => {
        if (this.options.onProgress && xhr.total > 0) {
          this.options.onProgress(xhr.loaded / xhr.total);
        }
      },
      (err) => {
        console.warn('Fallback exterior creation:', err);
        this.buildFallbackBasePhone();
      }
    );
  }

  buildFallbackBasePhone() {
    const bodyGeo = new THREE.BoxGeometry(1.3, 2.7, 0.12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      metalness: 0.95,
      roughness: 0.2,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.basePhoneGroup.add(bodyMesh);
    if (this.options.onProgress) {
      this.options.onProgress(1.0);
    }
  }

  buildProceduralExplodedLayers() {
    const width = 1.3;
    const height = 2.7;
    const thickness = 0.04;

    // 1. FRONT GLASS PANEL
    const glassGeo = new THREE.PlaneGeometry(width, height);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      opacity: 0.95,
      transparent: true,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    this.layers.glass.add(glassMesh);

    // 2. DISPLAY PANEL
    const displayGeo = new THREE.PlaneGeometry(width * 0.95, height * 0.96);
    this.shaderMaterials.displayShader = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          vec3 bg = vec3(0.02, 0.03, 0.06);
          float sweep = smoothstep(0.0, 0.03, abs(uv.y - mod(uTime * 0.4, 1.2)));
          vec3 sweepColor = mix(vec3(0.0, 0.8, 1.0), vec3(0.4, 0.0, 1.0), uv.x);
          float grid = step(0.98, fract(uv.x * 30.0)) + step(0.98, fract(uv.y * 60.0));
          vec3 gridColor = vec3(0.0, 0.4, 0.8) * grid * 0.15;

          vec2 centerUv = (uv - 0.5) * 2.0;
          float ring = abs(length(centerUv) - 0.3);
          float ringGlow = smoothstep(0.05, 0.0, ring) * 0.6;

          vec3 finalColor = bg + (1.0 - sweep) * sweepColor + gridColor + ringGlow * vec3(0.0, 0.9, 1.0);
          gl_FragColor = vec4(finalColor, 0.95);
        }
      `,
      transparent: true,
    });
    const displayMesh = new THREE.Mesh(displayGeo, this.shaderMaterials.displayShader);
    displayMesh.position.z = -0.01;
    this.layers.display.add(displayMesh);

    // 3. TITANIUM FRAME
    const frameGeo = new THREE.BoxGeometry(width, height, thickness);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x3a3d45,
      metalness: 0.95,
      roughness: 0.25,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.layers.frame.add(frameMesh);

    // 4. CAMERA MODULE
    const cameraGroup = new THREE.Group();
    const camBaseGeo = new THREE.BoxGeometry(0.5, 0.7, 0.06);
    const camBaseMat = new THREE.MeshStandardMaterial({ color: 0x111215, metalness: 0.9, roughness: 0.1 });
    const camBase = new THREE.Mesh(camBaseGeo, camBaseMat);
    camBase.position.set(0.3, 0.7, 0);
    cameraGroup.add(camBase);

    const lensGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 32);
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x051525,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.85,
    });
    const lensPositions = [
      [0.2, 0.8, 0.04],
      [0.4, 0.8, 0.04],
      [0.2, 0.6, 0.04],
      [0.4, 0.6, 0.04],
      [0.3, 0.45, 0.04],
    ];
    lensPositions.forEach((pos) => {
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(pos[0], pos[1], pos[2]);
      cameraGroup.add(lens);
    });
    this.layers.camera.add(cameraGroup);

    // 5. MAIN LOGIC BOARD
    const boardGeo = new THREE.PlaneGeometry(width * 0.9, height * 0.45);
    this.shaderMaterials.boardShader = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          vec3 pcbColor = vec3(0.05, 0.07, 0.1);
          float trace1 = step(0.95, sin(uv.x * 50.0 + uTime * 2.0));
          float trace2 = step(0.95, cos(uv.y * 40.0 - uTime * 1.5));
          vec2 npuPos = vec2(0.5, 0.5);
          float npuDist = length(uv - npuPos);
          float npuGlow = smoothstep(0.2, 0.0, npuDist) * (0.8 + 0.2 * sin(uTime * 5.0));

          vec3 finalCol = pcbColor + (trace1 + trace2) * vec3(0.0, 0.4, 0.8) * 0.3 + npuGlow * vec3(0.0, 1.0, 0.8);
          gl_FragColor = vec4(finalCol, 0.95);
        }
      `,
      transparent: true,
    });
    const boardMesh = new THREE.Mesh(boardGeo, this.shaderMaterials.boardShader);
    boardMesh.position.set(0, 0.4, 0);
    this.layers.board.add(boardMesh);

    // 6. BATTERY CELL
    const batteryGeo = new THREE.BoxGeometry(width * 0.85, height * 0.45, 0.03);
    const batteryMat = new THREE.MeshStandardMaterial({
      color: 0x1f2128,
      metalness: 0.8,
      roughness: 0.3,
    });
    const batteryMesh = new THREE.Mesh(batteryGeo, batteryMat);
    batteryMesh.position.set(0, -0.6, 0);
    this.layers.battery.add(batteryMesh);

    this.explodedGroup.visible = false;
  }

  bindEvents() {
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);

    window.addEventListener('resize', this.onWindowResize, false);
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.isMobile = window.innerWidth < 768;
  }

  onMouseMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.targetRotation.y = x * 0.35;
    this.targetRotation.x = -y * 0.35;
  }

  updateScrollProgress(progress, section = 'HERO') {
    this.scrollProgress = progress;
    this.activeSection = section;

    if (progress < 0.25) {
      this.basePhoneGroup.visible = true;
      this.explodedGroup.visible = false;

      const p = progress / 0.25;
      this.basePhoneGroup.rotation.y = p * Math.PI * 0.2;
      this.basePhoneGroup.position.z = p * 0.5;
    } else if (progress >= 0.25 && progress <= 0.85) {
      this.basePhoneGroup.visible = false;
      this.explodedGroup.visible = true;

      const expProgress = (progress - 0.25) / 0.6;

      if (this.isMobile) {
        this.layers.glass.position.set(0, 1.2 * expProgress, 0.1);
        this.layers.display.position.set(0, 0.7 * expProgress, 0.05);
        this.layers.frame.position.set(0, 0, 0);
        this.layers.camera.position.set(0, -0.4 * expProgress, -0.05);
        this.layers.board.position.set(0, -0.8 * expProgress, -0.1);
        this.layers.battery.position.set(0, -1.2 * expProgress, -0.15);
      } else {
        const gap = 0.45 * expProgress;
        this.layers.glass.position.z = gap * 3;
        this.layers.display.position.z = gap * 2;
        this.layers.frame.position.z = gap * 0.5;
        this.layers.camera.position.z = -gap * 0.5;
        this.layers.board.position.z = -gap * 1.5;
        this.layers.battery.position.z = -gap * 2.5;
      }
    } else {
      this.basePhoneGroup.visible = true;
      this.explodedGroup.visible = false;

      const reassembleProgress = (progress - 0.85) / 0.15;
      this.basePhoneGroup.rotation.y = (1 - reassembleProgress) * Math.PI * 0.5;
      this.basePhoneGroup.position.z = 0;
    }
  }

  setMaterialFinish(finishName) {
    let colorHex = 0x181a20;
    if (finishName === 'Titanium') colorHex = 0x3c3f46;
    if (finishName === 'Obsidian') colorHex = 0x0c0d10;
    if (finishName === 'Silver') colorHex = 0xd0d5dd;

    this.basePhoneGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.color.setHex(colorHex);
      }
    });
  }

  animate() {
    this.reqId = requestAnimationFrame(this.animate);

    const elapsedTime = this.clock.getElapsedTime();

    if (this.shaderMaterials.displayShader) {
      this.shaderMaterials.displayShader.uniforms.uTime.value = elapsedTime;
    }
    if (this.shaderMaterials.boardShader) {
      this.shaderMaterials.boardShader.uniforms.uTime.value = elapsedTime;
    }

    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;

    this.mainGroup.rotation.x = this.currentRotation.x;
    this.mainGroup.rotation.y = this.currentRotation.y;

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.reqId);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}
