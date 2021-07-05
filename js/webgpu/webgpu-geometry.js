import { System } from 'ecs';
import { mat4 } from 'gl-matrix';
import { GeometryLayoutCache } from './resource-cache.js';

import { MODEL_BUFFER_SIZE } from './wgsl/common.js';
import { StaticGeometry } from '../core/geometry.js';
import { Transform } from '../core/transform.js';
import { WebGPU } from './webgpu-components.js';

const IDENTITY_MATRIX = mat4.create();

export class WebGPURenderGeometry {
  layoutId = 0;
  layout = null;
  drawCount = 0;
  instanceCount = 1;
  indexBuffer = null;
  vertexBuffers = [];

  constructor(gpu) {
    this.modelBuffer = gpu.device.createBuffer({
      size: MODEL_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bindGroup = gpu.device.createBindGroup({
      layout: gpu.bindGroupLayouts.model,
      entries: [{
        binding: 0,
        resource: { buffer: this.modelBuffer },
      }]
    });
  }
}

export class WebGPUGeometrySystem extends System {
  geometryLayoutCache = new GeometryLayoutCache();

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);

    // For any entities with StaticGeometry but no WebGPURenderGeometry, create the WebGPU buffers
    // for the geometry, fill it from the StaticGeometry attributes, then clear the StaticGeometry's
    // attributes so the memory can be GCed if needed.
    this.query(StaticGeometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const gpuGeometry = new WebGPURenderGeometry(gpu);
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

    // Update the geometry's bind group.
    this.query(WebGPURenderGeometry).forEach((entity, geometry) => {
      const transform = entity.get(Transform);
      let modelMatrix = transform ? transform.matrix : IDENTITY_MATRIX;
      gpu.device.queue.writeBuffer(geometry.modelBuffer, 0, modelMatrix);
    });
  }
}