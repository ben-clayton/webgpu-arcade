import { System } from 'ecs';
import { mat4 } from 'gl-matrix';

import { Geometry } from '../core/geometry.js';
import { Transform } from '../core/transform.js';
import { GeometryLayoutCache, WebGPURenderGeometry } from './webgpu-geometry.js';

const IDENTITY_MATRIX = mat4.create();

export class WebGPUGeometrySystem extends System {
  geometryLayoutCache = new GeometryLayoutCache();

  execute(delta, time) {
    const gpu = this.world;

    // For any entities with StaticGeometry but no WebGPURenderGeometry, create the WebGPU buffers
    // for the geometry, fill it from the StaticGeometry attributes, then clear the StaticGeometry's
    // attributes so the memory can be GCed if needed.
    this.query(Geometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const gpuGeometry = new WebGPURenderGeometry(gpu);
      //renderable.pipeline = this.pipeline;
      gpuGeometry.drawCount = geometry.drawCount;

      gpuGeometry.layoutId = this.geometryLayoutCache.getId(geometry);
      gpuGeometry.layout = this.geometryLayoutCache.getLayout(gpuGeometry.layoutId);

      let i = 0;
      for (const geoBuffer of geometry.buffers) {
        gpuGeometry.vertexBuffers.push({
          slot: i++,
          buffer: geoBuffer.buffer.gpuBuffer,
          offset: geoBuffer.minOffset,
        });
      }

      if (geometry.indices) {
        gpuGeometry.indexBuffer = {
          buffer: geometry.indices,
          format: geometry.indexFormat
        };
      }

      // TODO: Allow StaticGeometry to GC?

      entity.add(gpuGeometry);
    });

    // Update the geometry's bind group.
    this.query(WebGPURenderGeometry).forEach((entity, geometry) => {
      const transform = entity.get(Transform);
      let modelMatrix = transform ? transform.matrix : IDENTITY_MATRIX;
      gpu.device.queue.writeBuffer(geometry.modelBuffer, 0, modelMatrix);
    });
  }
}