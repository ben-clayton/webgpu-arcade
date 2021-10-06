import { System } from 'engine/core/ecs.js';
import { Stage } from 'engine/core/stage.js';
import { Mesh, Geometry, Attribute } from 'engine/core/mesh.js';
import { UnlitMaterial } from 'engine/core/materials.js';
import { Transform, StaticTransform } from 'engine/core/transform.js';
import { vec3 } from 'gl-matrix';

import { Collider } from '../common/collision.js';

const RING_SEGMENTS = 16;

export class ColliderVisualizerSystem extends System {
  stage = Stage.PostFrameLogic;

  init(gpu) {
    const colliderVerts = [];
    const colliderIndices = [];

    let idx = 0;
    for (let i = 0; i < RING_SEGMENTS+1; ++i) {
      const u = (i / RING_SEGMENTS) * Math.PI * 2;
      colliderVerts.push(Math.cos(u), 0, Math.sin(u));
      if (i > 0) { colliderIndices.push(idx, ++idx); }
    }

    idx++
    for (let i = 0; i < RING_SEGMENTS+1; ++i) {
      const u = (i / RING_SEGMENTS) * Math.PI * 2;
      colliderVerts.push(Math.cos(u), Math.sin(u), 0);
      if (i > 0) { colliderIndices.push(idx, ++idx); }
    }

    idx++
    for (let i = 0; i < RING_SEGMENTS+1; ++i) {
      const u = (i / RING_SEGMENTS) * Math.PI * 2;
      colliderVerts.push(0, Math.cos(u), Math.sin(u));
      if (i > 0) { colliderIndices.push(idx, ++idx); }
    }

    const vertexBuffer = gpu.createStaticBuffer(new Float32Array(colliderVerts), 'vertex');
    const indexBuffer = gpu.createStaticBuffer(new Uint16Array(colliderIndices), 'index');

    const geometry = new Geometry({
      drawCount: colliderIndices.length,
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
    this.mesh.name = 'Collider Visualization Mesh';
  }

  execute() {
    const gpu = this.world;

    const scale = vec3.create();

    this.query(Collider).forEach((entity, collider) => {
      const transform = entity.get(Transform);

      gpu.addFrameMeshInstance(this.mesh, new StaticTransform({
        scale: [collider.radius, collider.radius, collider.radius]
      }, transform?.worldMatrix));
    });
  }
}
