import { System } from 'engine/core/ecs.js';
import { Stage } from 'engine/core/stage.js';
import { Mesh, Geometry, Attribute } from 'engine/core/mesh.js';
import { UnlitMaterial } from 'engine/core/materials.js';
import { StaticTransform } from 'engine/core/transform.js';
import { Physics2DBody } from './physics-2d.js';
import { vec3, quat } from 'gl-matrix';

const tmpQuat = quat.create();

function createRectangleMesh(gpu) {
  const boundsVerts = new Float32Array([
     0.5,  0.5, 0.0,
    -0.5,  0.5, 0.0,
    -0.5, -0.5, 0.0,
     0.5, -0.5, 0.0,
     0.5,  0.5, 0.0,
  ]);

  const vertexBuffer = gpu.createStaticBuffer(boundsVerts, 'vertex');

  const geometry = new Geometry({
    drawCount: 5,
    attributes: [ new Attribute('position', vertexBuffer) ],
    topology: 'line-strip'
  });

  const material = new UnlitMaterial();
  material.baseColorFactor[0] = 1.0;
  material.baseColorFactor[1] = 1.0;
  material.baseColorFactor[2] = 0.0;
  material.depthCompare = 'always';

  const mesh = new Mesh({ geometry, material });
  mesh.name = 'Physics 2D Rectangle Visualization Mesh';

  return mesh;
}

function createCircleMesh(gpu) {
  const ringSegments = 16;
  const colliderVerts = [];

  let idx = 0;
  for (let i = 0; i < ringSegments+1; ++i) {
    const u = (i / ringSegments) * Math.PI * 2;
    colliderVerts.push(Math.cos(u), Math.sin(u), 0);
  }

  const vertexBuffer = gpu.createStaticBuffer(new Float32Array(colliderVerts), 'vertex');

  const geometry = new Geometry({
    drawCount: ringSegments+1,
    attributes: [ new Attribute('position', vertexBuffer) ],
    topology: 'line-strip'
  });

  const material = new UnlitMaterial();
  material.baseColorFactor[0] = 0.0;
  material.baseColorFactor[1] = 1.0;
  material.baseColorFactor[2] = 0.0;
  material.depthCompare = 'always';

  const mesh = new Mesh({ geometry, material });
  mesh.name = 'Physics 2D Circle Visualization Mesh';

  return mesh;
}

export class Physics2DVisualizerSystem extends System {
  stage = Stage.PostFrameLogic;

  init(gpu) {
    this.rectMesh = createRectangleMesh(gpu);
    this.circleMesh = createCircleMesh(gpu);

    this.bodyQuery = this.query(Physics2DBody);
  }

  execute(delta, time, gpu) {
    const scale = vec3.create();

    this.bodyQuery.forEach((entity, body) => {
      const position = [body.body.position.x, body.body.position.y, 0];
      quat.identity(tmpQuat);
      quat.rotateZ(tmpQuat, tmpQuat, body.body.angle);

      switch(body.type) {
        case 'rectangle':
          gpu.addFrameMeshInstance(this.rectMesh, new StaticTransform({
            position,
            scale: [body.width, body.height, 1],
            orientation: tmpQuat
          }));
          break;
        
        case 'circle':
          gpu.addFrameMeshInstance(this.circleMesh, new StaticTransform({
            position,
            scale: [body.radius, body.radius, 1],
            orientation: tmpQuat
          }));
          break;
      }
    });
  }
}