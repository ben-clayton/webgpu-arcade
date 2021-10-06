import { Tag, System } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';
import { Camera } from 'engine/core/camera.js';
import { AmbientLight, DirectionalLight } from 'engine/core/light.js';
import { BoxGeometry } from 'engine/geometry/box.js';
import { SphereGeometry } from 'engine/geometry/sphere.js';
import { PBRMaterial } from 'engine/core/materials.js';
import { Mesh } from 'engine/core/mesh.js';
import { GltfLoader } from 'engine/loaders/gltf.js';
import { WebGPUWorld } from 'engine/webgpu/webgpu-world.js';
import { PointLight } from 'engine/core/light.js';

/*import { Velocity, VelocitySystem } from './common/velocity.js';
import { Collider, CollisionSystem } from './common/collision.js';
import { ImpactDamage, ImpactDamageSystem } from './common/impact-damage.js';
import { ScoreSystem } from './common/score.js';*/

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
  /*.registerSystem(VelocitySystem)
  .registerSystem(CollisionSystem)
  .registerSystem(ScoreSystem)*/
  ;

// Debug visualizations
/*gui.add(appSettings, 'showCollisionVolumes').onChange(() => {
  let colliderSystem = world.getSystem(ColliderVisualizerSystem);
  if (appSettings.showCollisionVolumes) {
    world.registerRenderSystem(ColliderVisualizerSystem);
  } else {
    world.removeSystem(ColliderVisualizerSystem);
  }
});*/

const renderer = await world.renderer();

const gltfLoader = new GltfLoader(renderer);

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const cameraOrientation = quat.create();
quat.rotateX(cameraOrientation, cameraOrientation, Math.PI * 0.04);

const camera = world.create(
  new Transform({ position: [0, -7, 35], orientation: cameraOrientation }),
  projection
);

// Add some lights
world.create(
  // A nice bright sunlight
  new DirectionalLight({
    direction: [0.0, 0.7, -0.5],
    color: [1.0, 1.0, 0.8],
    intensity: 1
  }),
  new AmbientLight(0.05, 0.05, 0.05)
);

// construct an arena
// There's more efficient ways to do this, since each of these boxes will be
// it's own draw call, but it's not going to hurt us for the time being.
const top = new BoxGeometry(renderer, {
  width: 60,
  height: 2,
  depth: 4,
  y: -25,
});

const bottom = new BoxGeometry(renderer, {
  width: 60,
  height: 2,
  depth: 4,
  y: 25,
});

const leftTop = new BoxGeometry(renderer, {
  width: 2,
  height: 5,
  depth: 4,
  x: -31,
  y: -23.5,
});

const leftBottom = new BoxGeometry(renderer, {
  width: 2,
  height: 5,
  depth: 4,
  x: -31,
  y: 23.5,
});

const rightTop = new BoxGeometry(renderer, {
  width: 2,
  height: 5,
  depth: 4,
  x: 31,
  y: -23.5,
});

const rightBottom = new BoxGeometry(renderer, {
  width: 2,
  height: 5,
  depth: 4,
  x: 31,
  y: 23.5,
});

const centerLine = new BoxGeometry(renderer, {
  width: 0.5,
  height: 48,
  depth: 0.5,
  z: -2
});

const floor = new BoxGeometry(renderer, {
  width: 64,
  height: 50,
  depth: 2,
  z: -3
});

const arenaMaterial = new PBRMaterial();

const floorMaterial = new PBRMaterial();
floorMaterial.baseColorFactor.set([0.6, 0.6, 0.8, 1.0]);

const arenaMesh = new Mesh(
  { geometry: top, material: arenaMaterial },
  { geometry: bottom, material: arenaMaterial },
  { geometry: leftTop, material: arenaMaterial },
  { geometry: leftBottom, material: arenaMaterial },
  { geometry: rightTop, material: arenaMaterial },
  { geometry: rightBottom, material: arenaMaterial },
  { geometry: centerLine, material: arenaMaterial },
  { geometry: floor, material: floorMaterial }
);
const arena = world.create(
  arenaMesh
);

// Paddles

const paddleGeometry = new BoxGeometry(renderer, {
  width: 1,
  height: 10,
  depth: 2
});

const leftPaddleMaterial = new PBRMaterial();
leftPaddleMaterial.baseColorFactor.set([1.0, 0.2, 0.2, 1.0]);
leftPaddleMaterial.emissiveFactor.set([0.2, 0.0, 0.0]);

const rightPaddleMaterial = new PBRMaterial();
rightPaddleMaterial.baseColorFactor.set([0.2, 0.2, 1.0, 1.0]);
rightPaddleMaterial.emissiveFactor.set([0.0, 0.0, 0.2]);

const leftPaddle = world.create(
  new Mesh({ geometry: paddleGeometry, material: leftPaddleMaterial }),
  new Transform({ position: [-30, 0, 0] })
);

const rightPaddle = world.create(
  new Mesh({ geometry: paddleGeometry, material: rightPaddleMaterial }),
  new Transform({ position: [30, 0, 0] })
);

// Ball

const ballGeometry = new SphereGeometry(renderer, 1);
const ballMaterial = new PBRMaterial();
ballMaterial.baseColorFactor.set([0.0, 0.0, 0.0, 1.0]);
ballMaterial.emissiveFactor.set([0.9, 0.9, 0.5]);

const ball = world.create(
  new Mesh({ geometry: ballGeometry, material: ballMaterial }),
  new Transform({ position: [0, 0, 0] }),
  new PointLight({ color: [1, 1, 0.8], intensity: 10, range: 10 })
);

function onFrame(t) {
  requestAnimationFrame(onFrame);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);