import { System } from 'ecs';
import { mat4 } from 'gl-matrix';

import { Geometry } from '../core/geometry.js';
import { Transform } from '../core/transform.js';
import { WebGPURenderMaterial, WebGPURenderPipeline } from './webgpu-pipeline.js';

import { INSTANCE_BUFFER_SIZE } from './wgsl/common.js';

const MAX_INSTANCE_COUNT = 128;
const IDENTITY_MATRIX = mat4.create();

export class WebGPUManualInstances {
  instanceCount = 1;
}

export class WebGPURenderBatch {
  pipelineGeometries = new Map();
  sortedPipelines;
  instanceBindGroup;
}

export class WebGPUGeometrySystem extends System {
  init(gpu) {
    // TODO: Make these dynamically sized
    this.instanceArray = new Float32Array(16 * MAX_INSTANCE_COUNT);
    this.instanceBuffer = gpu.device.createBuffer({
      size: INSTANCE_BUFFER_SIZE * MAX_INSTANCE_COUNT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bindGroup = gpu.device.createBindGroup({
      layout: gpu.bindGroupLayouts.instance,
      entries: [{
        binding: 0,
        resource: { buffer: this.instanceBuffer, size: 256 },
      }]
    });

    this.renderables = this.query(Geometry, WebGPURenderPipeline);

    this.renderBatchEntity = gpu.create();
  }

  execute(delta, time) {
    const gpu = this.world;

    const renderBatch = new WebGPURenderBatch();

    // TODO: This would be the perfect place for some frustum culling, etc.
    let totalInstanceCount = 0;
    this.renderables.forEach((entity, geometry, pipeline) => {
      let geometryMaterials = renderBatch.pipelineGeometries.get(pipeline);
      if (!geometryMaterials) {
        geometryMaterials = new Map();
        renderBatch.pipelineGeometries.set(pipeline, geometryMaterials);
      }
      let materialInstances = geometryMaterials.get(geometry);
      if (!materialInstances) {
        materialInstances = new Map();
        geometryMaterials.set(geometry, materialInstances);
      }
      let material = entity.get(WebGPURenderMaterial);
      let instances = materialInstances.get(material);
      if (!instances) {
        instances = {instanceCount: 0, transforms: [], bindGroupOffset: 0};
        materialInstances.set(material, instances);
      }
      const transform = entity.get(Transform);
      const manualInstances = entity.get(WebGPUManualInstances);
      totalInstanceCount++;
      instances.instanceCount += manualInstances?.instanceCount || 1;
      instances.transforms.push(transform?.worldMatrix || IDENTITY_MATRIX);
    });

    // Loop through all of the instances we're going to render and place their transforms in the
    // instances buffer.
    let arrayOffset = 0;
    for (const geometryMaterials of renderBatch.pipelineGeometries.values()) {
      for (const materialInstances of geometryMaterials.values()) {
        for (const instances of materialInstances.values()) {
          instances.bindGroupOffset = arrayOffset * Float32Array.BYTES_PER_ELEMENT;
          for (const transform of instances.transforms) {
            this.instanceArray.set(transform, arrayOffset);
            arrayOffset += 16;
          }
          // Make sure our binding offsets fall on 256 byte boundaries.
          arrayOffset = Math.ceil(arrayOffset / 64) * 64;
        }
      }
    }
    gpu.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceArray, 0, arrayOffset * Float32Array.BYTES_PER_ELEMENT);

    // Sort the pipelines by render order (e.g. so transparent objects are rendered last).
    renderBatch.sortedPipelines = Array.from(renderBatch.pipelineGeometries.keys())
    renderBatch.sortedPipelines.sort((a, b) => a.renderOrder - b.renderOrder);

    renderBatch.instanceBindGroup = this.bindGroup;
    this.renderBatchEntity.add(renderBatch);
  }
}
