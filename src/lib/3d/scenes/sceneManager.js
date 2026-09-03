import * as THREE from 'three';

export function updateHeroScene(engine, localProgress) {
  engine.accentColorHex = 0xffffff;
  if (engine.basePhoneGroup) {
    engine.basePhoneGroup.visible = true;
    engine.explodedGroup.visible = false;
    engine.basePhoneGroup.rotation.y = localProgress * Math.PI * 0.25;
    engine.basePhoneGroup.rotation.x = Math.sin(engine.clock.getElapsedTime() * 0.5) * 0.02;
  }
}

export function updateDisplayScene(engine, localProgress) {
  engine.accentColorHex = 0x00f0ff; // Cyan
  if (engine.basePhoneGroup) {
    engine.basePhoneGroup.visible = true;
    engine.explodedGroup.visible = false;
    engine.basePhoneGroup.rotation.y = (1 - localProgress) * Math.PI * 0.25;
  }
  if (engine.shaderMaterials.displayShader && engine.shaderMaterials.displayShader.uniforms.uScroll) {
    engine.shaderMaterials.displayShader.uniforms.uScroll.value = localProgress;
  }
}

export function updateCameraScene(engine, localProgress) {
  engine.accentColorHex = 0xaa00ff; // Violet
  if (engine.basePhoneGroup) {
    engine.basePhoneGroup.visible = true;
    engine.explodedGroup.visible = false;
    engine.basePhoneGroup.rotation.y = Math.PI + localProgress * 0.3;
  }
}

export function updateExplodedScene(engine, localProgress) {
  engine.accentColorHex = 0x00f0ff; // Cyan
  engine.basePhoneGroup.visible = false;
  engine.explodedGroup.visible = true;

  const gap = 0.5 * localProgress;
  engine.layers.glass.position.z = gap * 3.0;
  engine.layers.display.position.z = gap * 2.0;
  engine.layers.frame.position.z = gap * 0.5;
  engine.layers.camera.position.z = -gap * 0.5;
  engine.layers.board.position.z = -gap * 1.5;
  engine.layers.battery.position.z = -gap * 2.5;

  engine.layers.glass.rotation.x = -0.05 * localProgress;
  engine.layers.display.rotation.x = -0.03 * localProgress;
}

export function updatePerformanceScene(engine, localProgress) {
  engine.accentColorHex = 0x0088ff; // Electric Blue
  engine.basePhoneGroup.visible = false;
  engine.explodedGroup.visible = true;

  const gap = 0.5 * (1.0 - localProgress * 0.3);
  engine.layers.glass.position.z = gap * 3.0;
  engine.layers.display.position.z = gap * 2.0;
  engine.layers.frame.position.z = gap * 0.5;
  engine.layers.camera.position.z = -gap * 0.5;
  engine.layers.board.position.z = 0.4 + localProgress * 0.2;
  engine.layers.battery.position.z = -gap * 2.5;

  if (engine.shaderMaterials.boardShader && engine.shaderMaterials.boardShader.uniforms.uScroll) {
    engine.shaderMaterials.boardShader.uniforms.uScroll.value = localProgress;
  }
}

export function updateBatteryScene(engine, localProgress) {
  engine.accentColorHex = 0xffaa00; // Warm Amber Energy
  engine.basePhoneGroup.visible = false;
  engine.explodedGroup.visible = true;

  const gap = 0.35;
  engine.layers.glass.position.z = gap * 3.0;
  engine.layers.display.position.z = gap * 2.0;
  engine.layers.frame.position.z = gap * 0.5;
  engine.layers.camera.position.z = -gap * 0.5;
  engine.layers.board.position.z = -gap * 1.2;
  engine.layers.battery.position.z = 0.5 + localProgress * 0.2;
}

export function updateAIScene(engine, localProgress) {
  engine.accentColorHex = 0x00ffaa; // Green-Cyan
  engine.basePhoneGroup.visible = false;
  engine.explodedGroup.visible = true;

  const gap = 0.25 + 0.25 * (1.0 - localProgress);
  engine.layers.glass.position.z = gap * 2.5;
  engine.layers.display.position.z = gap * 1.8;
  engine.layers.frame.position.z = gap * 0.5;
  engine.layers.camera.position.z = -gap * 0.5;
  engine.layers.board.position.z = gap * 0.2;
  engine.layers.battery.position.z = -gap * 1.5;
}

export function updateFinalScene(engine, localProgress) {
  engine.accentColorHex = 0xffffff;
  engine.basePhoneGroup.visible = true;
  engine.explodedGroup.visible = false;
  engine.basePhoneGroup.rotation.y = (1 - localProgress) * Math.PI * 0.4;
}
