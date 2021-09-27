import { System } from '../core/ecs.js';
import { Stage } from '../core/stage.js';
import { Mesh, Geometry, Attribute, AABB } from '../core/mesh.js';
import { UnlitMaterial } from '../core/materials.js';
import { Transform, StaticTransform } from '../core/transform.js';
import { vec3 } from 'gl-matrix';

const BOUNDS_VERTS = new Float32Array([
  1.0,  1.0,  1.0, // 0
  0.0,  1.0,  1.0, // 1
  1.0,  0.0,  1.0, // 2
  0.0,  0.0,  1.0, // 3
  1.0,  1.0,  0.0, // 4
  0.0,  1.0,  0.0, // 5
  1.0,  0.0,  0.0, // 6
  0.0,  0.0,  0.0, // 7
]);

const BOUNDS_INDICES = new Uint16Array([
  0, 1,  2, 3,  0, 2,  1, 3, // Front
  4, 5,  6, 7,  4, 6,  5, 7, // Back
  0, 4,  1, 5,  2, 6,  3, 7, // Corners
]);

export class BoundsVisualizerSystem extends System {
  stage = Stage.PostFrameLogic;

  init(gpu) {
    const vertexBuffer = gpu.createStaticBuffer(BOUNDS_VERTS, 'vertex');
    const indexBuffer = gpu.createStaticBuffer(BOUNDS_INDICES, 'index');

    const geometry = new Geometry({
      drawCount: BOUNDS_INDICES.length,
      attributes: [ new Attribute('position', vertexBuffer) ],
      indices: { buffer: indexBuffer, format: 'uint16' },
      topology: 'line-list'
    });

    const material = new UnlitMaterial();
    material.baseColorFactor[0] = 1.0;
    material.baseColorFactor[1] = 1.0;
    material.baseColorFactor[2] = 0.0;
    material.depthCompare = 'always';

    this.mesh = new Mesh({ geometry, material });
  }

  execute() {
    const gpu = this.world;

    const scale = vec3.create();

    this.query(AABB).forEach((entity, aabb) => {
      const transform = entity.get(Transform);
      vec3.subtract(scale, aabb.max, aabb.min);

      gpu.addFrameMeshInstance(this.mesh, new StaticTransform({
        position: aabb.min,
        scale
      }, transform?.worldMatrix));
    });
  }
}
