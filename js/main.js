import { Transform } from './core/transform.js';
import { Camera } from './core/camera.js';
import { PointLight, AmbientLight } from './core/light.js';
import { InputSystem } from './core/input.js';
import { Skybox } from './core/skybox.js';

import { FlyingControls, FlyingControlsSystem } from './controls/flying-controls.js';
import { OrbitControls, OrbitControlsSystem } from './controls/orbit-controls.js';

import { WebGPUWorld } from './webgpu/webgpu-world.js';
import { WebGPULightSystem } from './webgpu/webgpu-light.js';
import { WebGPUCameraSystem } from './webgpu/webgpu-camera.js';
import { WebGPUClusteredLights } from './webgpu/webgpu-clustered-light.js';
import {
  WebGPUBeginRenderPasses,
  WebGPUDefaultRenderPass,
  WebGPUSubmitRenderPasses
} from './webgpu/webgpu-render-pass.js';
import { WebGPULightSpriteSystem } from './webgpu/webgpu-light-sprite.js';
import { WebGPUGeometrySystem } from './webgpu/webgpu-geometry-system.js';
import { WebGPUPBRPipelineSystem } from './webgpu/webgpu-pbr-pipeline.js';
import { WebGPUSkyboxSystem } from './webgpu/webgpu-skybox.js';
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
  .registerGPUSystem(WebGPUSkyboxSystem)
  .registerGPUSystem(WebGPUGeometrySystem)
  .registerGPUSystem(WebGPUPBRPipelineSystem)
  .registerGPUSystem(WebGPUDefaultPipelineSystem)
  .registerGPUSystem(WebGPUBeginRenderPasses)
  .registerGPUSystem(WebGPUDefaultRenderPass)
  .registerGPUSystem(WebGPUSubmitRenderPasses)

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

// Add a skybox
world.textureLoader.fromUrl('./media/textures/skybox/cube-basis-mipmap.ktx2').then((texture) => {
  world.create(new Skybox(texture.texture));
});


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

world.create(
  new GltfScene('./media/models/dragon/dragon.glb')
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
