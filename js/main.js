import { Transform } from './core/transform.js';
import { Camera } from './core/camera.js';
import { PointLight, AmbientLight } from './core/light.js';
import { InputSystem } from './core/input.js';

import { FlyingControls, FlyingControlsSystem } from './controls/flying-controls.js';
import { OrbitControls, OrbitControlsSystem } from './controls/orbit-controls.js';

import { WebGPUWorld } from './webgpu/webgpu-world.js';
import { WebGPULightSystem } from './webgpu/webgpu-light.js';
import { WebGPUCameraSystem } from './webgpu/webgpu-camera.js';
import { WebGPUClusteredLights } from './webgpu/webgpu-clustered-light.js';
import { WebGPURenderer } from './webgpu/webgpu-renderer.js';
import { WebGPULightSpriteSystem } from './webgpu/webgpu-light-sprite.js';
import { WebGPUGeometrySystem } from './webgpu/webgpu-geometry-system.js';
import { WebGPUPBRPipelineSystem } from './webgpu/webgpu-pbr-pipeline.js';
import { WebGPUDefaultPipelineSystem } from './webgpu/webgpu-pipeline.js';
import { GltfScene, WebGPUGltfSystem } from './webgpu/webgpu-gltf.js';

import { createCubeGeometry } from './cube-geometry.js';

import dat from 'dat.gui';
import Stats from 'stats.js';

const appSettings = {
  controls: 'orbit',
};

let gui = new dat.GUI();

document.body.appendChild(gui.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

const world = new WebGPUWorld(document.querySelector('canvas'));
world
  .registerSystem(InputSystem)
  .registerSystem(FlyingControlsSystem)
  .registerSystem(OrbitControlsSystem)
  // Unfortunately the order of these systems is kind of delicate.
  .registerGPUSystem(WebGPULightSystem)
  .registerGPUSystem(WebGPUCameraSystem)
  .registerGPUSystem(WebGPUClusteredLights)
  .registerGPUSystem(WebGPULightSpriteSystem)
  .registerGPUSystem(WebGPUGltfSystem)
  .registerGPUSystem(WebGPUGeometrySystem)
  .registerGPUSystem(WebGPUPBRPipelineSystem)
  .registerGPUSystem(WebGPUDefaultPipelineSystem)
  .registerGPUSystem(WebGPURenderer);

await world.intialize();

const cubeGeometry = createCubeGeometry(world);

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const camera = world.create(
  new Transform([0, 0, 3]),
  new OrbitControls(),
  projection
);

const cube = world.create(
  new Transform([0, 0, 0], [0, 0, 0, 1], [0.5, 0.5, 0.5]),
  new PointLight(0.3, 0.3, 1.0, 10),
  cubeGeometry,
);
const cube2 = world.create(
  new Transform([-3, 0, 0], [0, 0, 0, 1], [0.5, 0.5, 0.5]),
  new PointLight(0.3, 0.3, 1.0, 10),
  cubeGeometry,
);
const cube3 = world.create(
  new Transform([3, 0, 0], [0, 0, 0, 1], [0.5, 0.5, 0.5]),
  new PointLight(0.3, 0.3, 1.0, 10),
  cubeGeometry,
);

// Add some lights
world.create(
  new Transform([3, 3, -2]),
  new PointLight(1, 0.3, 0.3, 10)
);

world.create(
  new Transform([-3, 3, -2]),
  new PointLight(0.3, 1, 0.3, 10)
);

world.create(
  new AmbientLight(0.1, 0.1, 0.1)
);

// Load a scene
world.create(
  new GltfScene('./media/models/dungeon/dungeon.glb')
);

gui.add(appSettings, 'controls', {
  'Orbit': 'orbit',
  'Flying': 'flying',
}).onChange(() => {
  switch (appSettings.controls) {
    case 'orbit': {
      camera.remove(FlyingControls);
      camera.add(new OrbitControls());
      break;
    }
    case 'flying': {
      camera.remove(OrbitControls);
      const flyingControls = new FlyingControls();
      flyingControls.speed = 10;
      camera.add(flyingControls);
      break;
    }
  }
});

function onFrame() {
  requestAnimationFrame(onFrame);

  let transform = cube.get(Transform);
  transform.position[1] = Math.sin(Date.now() / 1000);

  transform = cube2.get(Transform);
  transform.position[1] = Math.sin((Date.now() - 1000) / 1000);

  transform = cube3.get(Transform);
  transform.position[1] = Math.sin((Date.now() + 1000) / 1000);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);
