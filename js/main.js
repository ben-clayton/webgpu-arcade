import { Transform } from './core/transform.js';
import { Camera } from './core/camera.js';
import { PointLight, AmbientLight } from './core/light.js';
import { InputSystem } from './core/input.js';
import { Skybox } from './core/skybox.js';
import { GltfScene, GltfSystem } from './core/gltf.js';

import { FlyingControls, FlyingControlsSystem } from './controls/flying-controls.js';
import { OrbitControls, OrbitControlsSystem } from './controls/orbit-controls.js';

import { WebGPUWorld } from './webgpu/webgpu-world.js';

import dat from 'dat.gui';
import Stats from 'stats.js';

const appSettings = {
  controls: 'orbit',
};

let gui = new dat.GUI();

document.body.appendChild(gui.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

const canvas = document.querySelector('canvas');

const world = new WebGPUWorld(canvas);
world
  .registerSystem(InputSystem)
  .registerSystem(FlyingControlsSystem)
  .registerSystem(OrbitControlsSystem)
  .registerGPUSystem(GltfSystem);

await world.intialize();

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const orbitControls = new OrbitControls();
orbitControls.distance = 10;
orbitControls.angle = [0.25, 0];

const camera = world.create(
  new Transform([0, 0, 10]),
  orbitControls,
  projection
);

// Add a skybox
world.create(new Skybox(world.textureLoader.fromUrl('./media/textures/skybox/cube-basis-mipmap.ktx2')));

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
  new Transform([2, 3, 6]),
  new PointLight(0.3, 0.3, 1, 10)
);

world.create(
  new Transform([-2, 3, 6]),
  new PointLight(1, 1, 0.3, 10)
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

world.create(
  new GltfScene('./media/models/unlit/UnlitTest.glb')
);

gui.add(appSettings, 'controls', {
  'Orbit': 'orbit',
  'Flying': 'flying',
}).onChange(() => {
  switch (appSettings.controls) {
    case 'orbit': {
      camera.remove(FlyingControls);
      camera.add(orbitControls);
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
  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);
