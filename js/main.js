import { Transform } from './core/transform.js';
import { Camera } from './core/camera.js';
import { PointLight, AmbientLight } from './core/light.js';
import { Skybox } from './core/skybox.js';
import { Mesh, AABB } from './core/geometry.js';
import { GltfLoader } from './core/gltf.js';

import { FlyingControls, FlyingControlsSystem } from './controls/flying-controls.js';
import { OrbitControls, OrbitControlsSystem } from './controls/orbit-controls.js';

import { WebGPUWorld } from './webgpu/webgpu-world.js';

import { createCubeGeometry } from './cube-geometry.js';
import { PBRMaterial, UnlitMaterial } from './core/materials.js';
import { WebGPULightSpriteSystem } from './webgpu/webgpu-light-sprite.js';

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

//world.registerRenderSystem(WebGPULightSpriteSystem);

const renderer = await world.renderer();

const gltfLoader = new GltfLoader(renderer);

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const orbitControls = new OrbitControls();
orbitControls.distance = 10;
orbitControls.maxDistance = 50;
orbitControls.angle = [0.25, 0];

const camera = world.create(
  new Transform({ position: [0, 0, 10] }),
  orbitControls,
  projection
);

// Add a skybox
//world.create(new Skybox(renderer.textureLoader.fromUrl('./media/textures/skybox/cube-basis-mipmap.ktx2')));

// Add some lights
world.create(
  new Transform({ position: [3, 3, -2] }),
  new PointLight(1, 0.3, 0.3, 10)
);

world.create(
  new Transform({ position: [-3, 3, -2] }),
  new PointLight(0.3, 1, 0.3, 10)
);

world.create(
  new Transform({ position: [2, 3, 6] }),
  new PointLight(0.3, 0.3, 1, 10)
);

world.create(
  new Transform({ position: [-2, 3, 6] }),
  new PointLight(1, 1, 0.3, 10)
);

world.create(
  new AmbientLight(0.1, 0.1, 0.1)
);

// Create a grid of cube instances to test the instancing system.
/*const cubeGeometry = new createCubeGeometry(world);
const cubeMaterial = new PBRMaterial();

const cubeMesh = new Mesh({ geometry: cubeGeometry, material: cubeMaterial });

for (let x = 0; x < 5; ++x) {
  for (let y = 0; y < 5; ++y) {
    for (let z = 0; z < 5; ++z) {
      world.create(
        new Transform({ position: [
          (x-2) * 2.5,
          (y-2) * 2.5,
          (z-2) * 2.5] }),
          cubeMesh
      );
    }
  }
}*/

// Load a scene
//gltfLoader.instanceFromUrl(world, './media/models/dungeon/dungeon.glb');
//gltfLoader.instanceFromUrl(world, './media/models/unlit/UnlitTest.glb');

//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/Lantern/glTF-Binary/Lantern.glb');
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/Fox/glTF-Binary/Fox.glb');
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/Buggy/glTF/Buggy.gltf'); // Broken
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/FlightHelmet/glTF/FlightHelmet.gltf');
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb');
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/SciFiHelmet/glTF/SciFiHelmet.gltf');
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/Suzanne/glTF/Suzanne.gltf');
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/ToyCar/glTF-Binary/ToyCar.glb'); // Broken?
//const dragonGltf = new GltfScene('../glTF-Sample-Models/2.0/SimpleSparseAccessor/glTF/SimpleSparseAccessor.gltf');
let dragon;
gltfLoader.fromUrl('./media/models/dragon/dragon.glb').then(scene => {
  dragon = scene.createInstance(world);

  /*for (let x = 0; x < 5; ++x) {
    for (let y = 0; y < 5; ++y) {
      dragon = scene.createInstance(world);
      const dragonTransform = dragon.get(Transform);
      dragonTransform.position = [
        (x-2) * 3.5,
        (y-2) * 3.5,
        0
      ];
    }
  }*/

  const aabb = dragon.get(AABB);
  console.log('Object Loaded. Min:', aabb.min, ' Max:', aabb.max);

  const size = vec3.distance(aabb.max, aabb.min);

  orbitControls.distance = size * 0.6;
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

  /*if (dragonTransform) {
    quat.rotateY(dragonTransform.orientation, dragonTransform.orientation, 0.01);
  }*/

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);
