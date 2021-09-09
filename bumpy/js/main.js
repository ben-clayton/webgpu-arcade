import { Transform } from 'toro/core/transform.js';
import { Camera } from 'toro/core/camera.js';
import { PointLight, AmbientLight, DirectionalLight } from 'toro/core/light.js';
import { Skybox } from 'toro/core/skybox.js';
import { Mesh, AABB } from 'toro/core/mesh.js';

import { GltfLoader } from 'toro/loaders/gltf.js';

import { Tag } from 'toro/core/ecs.js';
import { WebGPUWorld } from 'toro/webgpu/webgpu-world.js';
import { WebGPULightSpriteSystem } from 'toro/webgpu/webgpu-light-sprite.js';

import { VelocityAccelerationSystem } from './velocity.js';
import { PlayerControlSystem } from './player-controls.js';
import { LifetimeSystem, DeadSystem } from './lifetime.js';
import { BasicWeapon, BasicWeaponSystem } from './weapon.js';

import { vec3, quat } from 'gl-matrix';

import Stats from 'stats.js';


const stats = new Stats();
document.body.appendChild(stats.dom);

const canvas = document.querySelector('canvas');

const world = new WebGPUWorld(canvas)
  .registerSystem(PlayerControlSystem)
  .registerSystem(LifetimeSystem)
  .registerSystem(VelocityAccelerationSystem)
  .registerSystem(DeadSystem)
  .registerRenderSystem(BasicWeaponSystem)
  .registerRenderSystem(WebGPULightSpriteSystem)
  ;

const renderer = await world.renderer();

const gltfLoader = new GltfLoader(renderer);

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const cameraOrientation = quat.create();
quat.rotateX(cameraOrientation, cameraOrientation, -Math.PI * 0.5);

const camera = world.create(
  new Transform({ position: [0, 65, 0], orientation: cameraOrientation }),
  projection
);

// Add some lights
world.create(
  // A nice bright sunlight
  new DirectionalLight({
    direction: [0.2, 0.7, -0.5],
    color: [1.0, 1.0, 0.7],
    intensity: 5
  }),
  new AmbientLight(0.05, 0.05, 0.05)
);

const player = world.create(
  Tag('player'),
  new Transform({ position: [0, 0, 50] }),
  new BasicWeapon()
);

// Load the ship models
const shipMeshes = {};
gltfLoader.fromUrl('./media/models/ships.glb').then(scene => {
  for (const mesh of scene.meshes) {
    shipMeshes[mesh.name] = mesh;
  }

  // Add the mesh to the player
  player.add(shipMeshes.Player);

  world.create(shipMeshes.Heavy, new Transform({ position: [-20, 0, -50] }));
  world.create(shipMeshes.Light, new Transform({ position: [-12, 0, -50] }));
  world.create(shipMeshes.Laser, new Transform({ position: [-4, 0, -50] }));
  world.create(shipMeshes.MultiGun, new Transform({ position: [4, 0, -50] }));
  world.create(shipMeshes.Missile, new Transform({ position: [12, 0, -50] }));
  world.create(shipMeshes.Mine, new Transform({ position: [20, 0, -50] }));
});

function onFrame() {
  requestAnimationFrame(onFrame);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);