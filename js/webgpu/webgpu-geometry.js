import { System } from 'ecs';
import { mat4 } from 'gl-matrix';

import { Geometry } from '../core/geometry.js';
import { Transform } from '../core/transform.js';

import { MODEL_BUFFER_SIZE } from './wgsl/common.js';

const IDENTITY_MATRIX = mat4.create();

export class WebGPURenderGeometry {
  instanceCount = 1;

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
  execute(delta, time) {
    const gpu = this.world;

    // For any entities with StaticGeometry but no WebGPURenderGeometry, create the WebGPU buffers
    // for the geometry, fill it from the StaticGeometry attributes, then clear the StaticGeometry's
    // attributes so the memory can be GCed if needed.
    this.query(Geometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const gpuGeometry = new WebGPURenderGeometry(gpu);
      entity.add(gpuGeometry);
    });

    // Update the geometry's bind group.
    this.query(WebGPURenderGeometry).forEach((entity, geometry) => {
      const transform = entity.get(Transform);
      let modelMatrix = transform ? transform.worldMatrix : IDENTITY_MATRIX;
      gpu.device.queue.writeBuffer(geometry.modelBuffer, 0, modelMatrix);
    });
  }
}
