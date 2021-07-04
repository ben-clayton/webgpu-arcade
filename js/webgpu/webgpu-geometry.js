import { System } from 'ecs';
import { GeometryLayoutCache } from './resource-cache.js';

import { StaticGeometry } from '../core/geometry.js';
import { WebGPU } from './webgpu-components.js';

export class WebGPURenderGeometry {
  layoutId = 0;
  layout = null;
  drawCount = 0;
  instanceCount = 1;
  indexBuffer = null;
  vertexBuffers = [];
}

export class WebGPUGeometrySystem extends System {
  geometryLayoutCache = new GeometryLayoutCache();

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);

    // For any entities with StaticGeometry but no WebGPURenderGeometry, create the WebGPU buffers
    // for the geometry, fill it from the StaticGeometry attributes, then clear the StaticGeometry's
    // attributes so the memory can be GCed if needed.
    this.query(StaticGeometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const gpuGeometry = new WebGPURenderGeometry();
      //renderable.pipeline = this.pipeline;
      gpuGeometry.drawCount = geometry.drawCount;

      const [id, layout] = this.geometryLayoutCache.getFor(geometry);
      gpuGeometry.layoutId = id;
      gpuGeometry.layout = layout;

      let i = 0;
      for (const buffer of geometry.buffers) {
        const vertexBuffer = gpu.device.createBuffer({
          size: buffer.array.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        gpu.device.queue.writeBuffer(vertexBuffer, 0, buffer.array);
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
  }
}