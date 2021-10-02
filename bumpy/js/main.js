import { Transform } from 'toro/core/transform.js';
import { Camera } from 'toro/core/camera.js';
import { PointLight, AmbientLight, DirectionalLight } from 'toro/core/light.js';
import { Skybox } from 'toro/core/skybox.js';
import { Mesh, AABB } from 'toro/core/mesh.js';
import { InstanceColor } from 'toro/core/instance-color.js';

import { GltfLoader } from 'toro/loaders/gltf.js';

import { Tag, System } from 'toro/core/ecs.js';
import { WebGPUWorld } from 'toro/webgpu/webgpu-world.js';

import { Velocity, VelocitySystem } from './velocity.js';
import { PlayerControlSystem, PlayerBoundsSystem } from './player-controls.js';
import { LifetimeHealthSystem, DeadSystem, Health } from './lifetime.js';
import { BasicWeapon, BasicWeaponSystem } from './weapon.js';
import { Collider, CollisionSystem } from './collision.js';
import { ImpactDamage, ImpactDamageSystem } from './impact-damage.js';
import { ColliderVisualizerSystem } from './debug-visualizers/collision-visualizer.js';

import { vec3, quat } from 'gl-matrix';

import dat from 'dat.gui';
import Stats from 'stats.js';
import { EnemySpawnerSystem } from './enemy-spawner.js';
import { ScoreSystem } from './score.js';

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
  .registerSystem(VelocitySystem)
  .registerSystem(PlayerBoundsSystem)
  .registerSystem(CollisionSystem)
  .registerSystem(ImpactDamageSystem)
  .registerSystem(LifetimeHealthSystem)
  .registerSystem(ScoreSystem)
  .registerSystem(DeadSystem)
  .registerRenderSystem(BasicWeaponSystem)
  ;

//world.timeScale = 0.25;

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
    color: [0.7, 1.0, 1.0],
    intensity: 3
  }),
  new AmbientLight(0.05, 0.05, 0.05)
);



const playerTransform = new Transform({ position: [0, 0, 50] });
const playerWeapon = new BasicWeapon({
  filter: Tag('player'),
  transforms: [
    new Transform({ position: [-1.5, 0, -3], parent: playerTransform }),
    new Transform({ position: [1.5, 0, -3], parent: playerTransform }),
  ]
});

const player = world.create(
  Tag('player'),
  playerWeapon,
  playerTransform,
  new Health(5),
  new Collider(2.5),
  new ImpactDamage(10, Tag('player-bullet')),
  new Velocity(),
);

// Load the environment
const trenchTag = Tag('trench');
let trenchVelocity = new Velocity([0, 0, 10]);
let trenchOffset = -197.5;
export class TrenchSystem extends System {
  init() {
    this.trenchQuery = this.query(trenchTag, Transform);
    this.trenchSegments = [];

    gltfLoader.fromUrl('./media/models/trench/trench.glb').then(scene => {
      this.trenchSegments.push(scene.createInstance(world), scene.createInstance(world));
      const trench1Transform = this.trenchSegments[1].get(Transform);
      trench1Transform.position[2] += trenchOffset;
    
      this.trenchSegments[0].add(trenchTag, trenchVelocity);
      this.trenchSegments[1].add(trenchTag, trenchVelocity);
    });
  }

  execute(delta, time) {
    this.trenchQuery.forEach((entity, trench, transform) => {
      // Make trench segments loop back up to the top so we get an endless channel.
      if (transform.position[2] > -trenchOffset) {
        transform.position[2] += trenchOffset * 2;
      }
    });
  }
}
world.registerSystem(TrenchSystem);

// Load the ship models
const shipMeshes = {};
gltfLoader.fromUrl('./media/models/ships.glb').then(scene => {
  for (const mesh of scene.meshes) {
    shipMeshes[mesh.name] = mesh;
  }

  // Add the mesh to the player
  player.add(shipMeshes.Player);

  world.registerRenderSystem(EnemySpawnerSystem, shipMeshes);
});

function onFrame(t) {
  requestAnimationFrame(onFrame);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);