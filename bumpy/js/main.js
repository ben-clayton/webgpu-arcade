import { Transform } from 'toro/core/transform.js';
import { Camera } from 'toro/core/camera.js';
import { PointLight, AmbientLight, DirectionalLight } from 'toro/core/light.js';
import { Skybox } from 'toro/core/skybox.js';
import { Mesh, AABB } from 'toro/core/mesh.js';

import { GltfLoader } from 'toro/loaders/gltf.js';

import { Tag } from 'toro/core/ecs.js';
import { WebGPUWorld } from 'toro/webgpu/webgpu-world.js';

import { VelocityAccelerationSystem } from './velocity.js';
import { PlayerControlSystem } from './player-controls.js';
import { LifetimeHealthSystem, DeadSystem, Health } from './lifetime.js';
import { BasicWeapon, BasicWeaponSystem } from './weapon.js';
import { Collider, CollisionSystem } from './collision.js';
import { ImpactDamage, ImpactDamageSystem } from './impact-damage.js';
import { ColliderVisualizerSystem } from './debug-visualizers/collision-visualizer.js';

import { vec3, quat } from 'gl-matrix';

import dat from 'dat.gui';
import Stats from 'stats.js';


const appSettings = {
  showCollisionVolumes: false,
};

let gui = new dat.GUI();
document.body.appendChild(gui.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

const canvas = document.querySelector('canvas');

const world = new WebGPUWorld(canvas)
  .registerSystem(PlayerControlSystem)
  .registerSystem(VelocityAccelerationSystem)
  .registerSystem(CollisionSystem)
  .registerSystem(ImpactDamageSystem)
  .registerSystem(LifetimeHealthSystem)
  .registerSystem(DeadSystem)
  .registerRenderSystem(BasicWeaponSystem)
  ;

// Debug visualizations
gui.add(appSettings, 'showCollisionVolumes').onChange(() => {
  let colliderSystem = world.getSystem(ColliderVisualizerSystem);
  if (appSettings.showCollisionVolumes) {
    world.registerRenderSystem(ColliderVisualizerSystem);
  } else {
    world.removeSystem(ColliderVisualizerSystem);
  }
});

const renderer = await world.renderer();

const gltfLoader = new GltfLoader(renderer);

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const cameraOrientation = quat.create();
quat.rotateX(cameraOrientation, cameraOrientation, -Math.PI * 0.45);

const camera = world.create(
  new Transform({ position: [0, 60, 15], orientation: cameraOrientation }),
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
  new BasicWeapon(),
  new Health(5),
  new Collider(2.5),
  new ImpactDamage(10, Tag('player-bullet'))
);

// Load the ship models
const shipMeshes = {};
gltfLoader.fromUrl('./media/models/ships.glb').then(scene => {
  for (const mesh of scene.meshes) {
    shipMeshes[mesh.name] = mesh;
  }

  // Add the mesh to the player
  player.add(shipMeshes.Player);

  // Create some enemies
  world.create(shipMeshes.Heavy,
    new Transform({ position: [-20, 0, -50] }),
    new Collider(3),
    new Health(30),
    new ImpactDamage(20)
  );
  world.create(shipMeshes.Light,
    new Transform({ position: [-12, 0, -50] }),
    new Collider(2),
    new Health(5),
    new ImpactDamage(5)
  );
  world.create(shipMeshes.Laser,
    new Transform({ position: [-4, 0, -50] }),
    new Collider(3),
    new Health(20),
    new ImpactDamage(10)
  );
  world.create(shipMeshes.MultiGun,
    new Transform({ position: [4, 0, -50] }),
    new Collider(3),
    new Health(10),
    new ImpactDamage(10)
  );
  world.create(shipMeshes.Missile,
    new Transform({ position: [12, 0, -50] }),
    new Collider(3),
    new Health(15),
    new ImpactDamage(10)
  );
  world.create(shipMeshes.Mine,
    new Transform({ position: [20, 0, -50] }),
    new Collider(3),
    new Health(10),
    new ImpactDamage(10)
  );
});

function onFrame() {
  requestAnimationFrame(onFrame);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);