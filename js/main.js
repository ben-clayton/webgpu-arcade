import { Transform } from './core/transform.js';
import { Camera } from './core/camera.js';
import { PointLight, AmbientLight } from './core/light.js';
import { Skybox } from './core/skybox.js';
import { AABB } from './core/geometry.js';
import { GltfScene } from './core/gltf.js';

import { FlyingControls, FlyingControlsSystem } from './controls/flying-controls.js';
import { OrbitControls, OrbitControlsSystem } from './controls/orbit-controls.js';

import { WebGPUWorld } from './webgpu/webgpu-world.js';

import { vec3, quat } from 'gl-matrix';

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
  .registerSystem(FlyingControlsSystem)
  .registerSystem(OrbitControlsSystem);

const renderer = await world.renderer();

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
world.create(new Skybox(renderer.textureLoader.fromUrl('./media/textures/skybox/cube-basis-mipmap.ktx2')));

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
const dungeon = world.create(
  new GltfScene('./media/models/dungeon/dungeon.glb')
);

const dragonTransform = new Transform();
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/Duck/glTF-Binary/Duck.glb');
const dragonGltf = new GltfScene('./media/models/dragon/dragon.glb');
const dragon = world.create(
  dragonTransform,
  dragonGltf
);

dragonGltf.loaded.then(() => {
  const aabb = dragon.get(AABB);
  console.log('Object Loaded. Min:', aabb.min, ' Max:', aabb.max);

  const size = vec3.distance(aabb.max, aabb.min);

  orbitControls.distance = size;
  orbitControls.maxDistance = size * 5;
  orbitControls.minDistance = Math.min(1, size / 2);
  projection.zNear = size / 20;
  projection.zFar = size * 20;

  vec3.set(orbitControls.target,
    (aabb.max[0] + aabb.min[0]) / 2,
    (aabb.max[1] + aabb.min[1]) / 2,
    (aabb.max[2] + aabb.min[2]) / 2,
  );
});

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

  quat.rotateY(dragonTransform.orientation, dragonTransform.orientation, 0.01);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);
