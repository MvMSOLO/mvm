import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function setupEnvironmentAndMaterials(scene, renderer) {
  // Create procedural PMREM Environment Map for metallic IBL reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x1a2030);

  const envLight1 = new THREE.DirectionalLight(0xffffff, 3.0);
  envLight1.position.set(5, 10, 5);
  envScene.add(envLight1);

  const envLight2 = new THREE.DirectionalLight(0x00f0ff, 2.0);
  envLight2.position.set(-5, -5, -5);
  envScene.add(envLight2);

  const renderTarget = pmremGenerator.fromScene(envScene);
  scene.environment = renderTarget.texture;
  pmremGenerator.dispose();
}

export function configurePhoneModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Center model root
  model.position.sub(center);

  // Normalize scale to fit smartphone proportions (~2.5 units tall)
  const scale = 2.5 / (size.y || 1);
  model.scale.set(scale, scale, scale);

  // Preserve original albedo, roughness, and normal textures while enhancing materials
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.envMapIntensity = 1.5;
      child.material.needsUpdate = true;
    }
  });

  return model;
}
