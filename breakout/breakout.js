import { Tag, System } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';
import { Camera } from 'engine/core/camera.js';
import { AmbientLight, DirectionalLight } from 'engine/core/light.js';
import { GltfLoader } from 'engine/loaders/gltf.js';
import { WebGPUWorld } from 'engine/webgpu/webgpu-world.js';

import { BallSystem } from './ball.js';
import { PlayerSystem } from './player.js';
import { Physics2DBody, Physics2DSystem } from '../common/physics-2d.js';
import { Physics2DVisualizerSystem } from '../common/physics-2d-visualizer.js';

import { vec3, quat } from 'gl-matrix';

import dat from 'dat.gui';
import Stats from 'stats.js';

const appSettings = {
  showPhysicsBodies: false,
};

let gui = new dat.GUI();
document.body.appendChild(gui.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

const canvas = document.querySelector('canvas');

const world = new WebGPUWorld(canvas)
  .registerSystem(Physics2DSystem)
  .registerRenderSystem(PlayerSystem)
  .registerRenderSystem(BallSystem)
  ;

gui.add(appSettings, 'showPhysicsBodies').onChange(() => {
  if (appSettings.showPhysicsBodies) {
    world.registerRenderSystem(Physics2DVisualizerSystem);
  } else {
    world.removeSystem(Physics2DVisualizerSystem);
  }
});

const renderer = await world.renderer();

const gltfLoader = new GltfLoader(renderer);

const projection = new Camera();
projection.zNear = 1;
projection.zFar = 1024;

const cameraOrientation = quat.create();
quat.rotateX(cameraOrientation, cameraOrientation, Math.PI * 0.08);

const camera = world.create(
  new Transform({ position: [0, -11, 32], orientation: cameraOrientation }),
  projection
);

// Add some lights
world.create(
  // Spooky moonlight
  new DirectionalLight({
    direction: [0.1, -0.4, 0.5],
    color: [0.7, 0.85, 1.0],
    intensity: 1.5
  }),
  new AmbientLight(0.05, 0.02, 0.02)
);

// Load a scene
gltfLoader.instanceFromUrl(world, './media/models/graveyard-compressed.glb');

// construct an arena
world.create(new Physics2DBody('rectangle', 0, 25, 42, 2, { isStatic: true, friction: 0, restitution: 1 }));
world.create(new Physics2DBody('rectangle', -22, 0, 2, 50, { isStatic: true, friction: 0, restitution: 1 }));
world.create(new Physics2DBody('rectangle', 22, 0, 2, 50, { isStatic: true, friction: 0, restitution: 1 }));

function onFrame(t) {
  requestAnimationFrame(onFrame);

  stats.begin();
  world.execute();
  stats.end();
}
requestAnimationFrame(onFrame);