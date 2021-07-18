import { System } from 'ecs';
import { mat4 } from 'gl-matrix';

import { StaticGeometry } from '../core/geometry.js';
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
    this.query(StaticGeometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const gpuGeometry = new WebGPURenderGeometry(gpu);
      //renderable.pipeline = this.pipeline;
      gpuGeometry.drawCount = geometry.drawCount;

      gpuGeometry.layoutId = this.geometryLayoutCache.getId(geometry);
      gpuGeometry.layout = this.geometryLayoutCache.getLayout(gpuGeometry.layoutId);

      let i = 0;
      for (const buffer of geometry.buffers) {
        const alignedLength = Math.ceil(buffer.array.byteLength / 4) * 4;
        const vertexBuffer = gpu.device.createBuffer({
          size: alignedLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true
        });
        const mappedArray = new buffer.array.constructor(vertexBuffer.getMappedRange());
        mappedArray.set(buffer.array);
        vertexBuffer.unmap();
        gpuGeometry.vertexBuffers.push({
          slot: i++,
          buffer: vertexBuffer,
          offset: buffer.minOffset,
        });
      }

      if (geometry.indexArray) {
        const indexBuffer = gpu.device.createBuffer({
          size: geometry.indexArray.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });
        gpu.device.queue.writeBuffer(indexBuffer, 0, geometry.indexArray);
        gpuGeometry.indexBuffer = {
          buffer: indexBuffer,
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