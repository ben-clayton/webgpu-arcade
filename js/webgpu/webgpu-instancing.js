import { System } from 'ecs';
import { mat4 } from 'gl-matrix';

import { Transform } from '../core/transform.js';
import { WebGPUMesh } from './webgpu-mesh.js';

import { INSTANCE_BUFFER_SIZE } from './wgsl/common.js';

const MAX_INSTANCE_COUNT = 512;
const IDENTITY_MATRIX = mat4.create();

export class WebGPUManualInstances {
  instanceCount = 1;
}

export class WebGPURenderBatch {
  pipelineGeometries = new Map();
  sortedPipelines;
  instanceBuffer;
}

export class WebGPUInstancingSystem extends System {
  init(gpu) {
    // TODO: Make these dynamically sized
    this.instanceArray = new Float32Array(16 * MAX_INSTANCE_COUNT);
    this.instanceBuffer = gpu.device.createBuffer({
      size: INSTANCE_BUFFER_SIZE * MAX_INSTANCE_COUNT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.renderableMeshes = this.query(WebGPUMesh);

    this.renderBatchEntity = gpu.create();
  }

  execute(delta, time) {
    const gpu = this.world;

    const renderBatch = new WebGPURenderBatch();

    // TODO: This would be the perfect place for some frustum culling, etc.
    let totalInstanceCount = 0;

    this.renderableMeshes.forEach((entity, gpuMesh) => {
      for (const gpuPrimitive of gpuMesh.primitives) {
        const geometry = gpuPrimitive.geometry;
        const pipeline = gpuPrimitive.pipeline;
        const material = gpuPrimitive.bindGroups;

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
        let instances = materialInstances.get(material);
        if (!instances) {
          instances = {instanceCount: 0, transforms: [], bufferOffset: 0};
          materialInstances.set(material, instances);
        }
        const transform = entity.get(Transform);
        const manualInstances = entity.get(WebGPUManualInstances);
        totalInstanceCount++;
        instances.instanceCount += manualInstances?.instanceCount || 1;
        instances.transforms.push(transform?.worldMatrix || IDENTITY_MATRIX);
      }
    });

    // Loop through all of the instances we're going to render and place their transforms in the
    // instances buffer.
    let arrayOffset = 0;
    for (const geometryMaterials of renderBatch.pipelineGeometries.values()) {
      for (const materialInstances of geometryMaterials.values()) {
        for (const instances of materialInstances.values()) {
          instances.bufferOffset = arrayOffset * Float32Array.BYTES_PER_ELEMENT;
          for (const transform of instances.transforms) {
            this.instanceArray.set(transform, arrayOffset);
            arrayOffset += 16;
          }
        }
      }
    }
    gpu.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceArray, 0, arrayOffset);

    // Sort the pipelines by render order (e.g. so transparent objects are rendered last).
    renderBatch.sortedPipelines = Array.from(renderBatch.pipelineGeometries.keys())
    renderBatch.sortedPipelines.sort((a, b) => a.renderOrder - b.renderOrder);

    renderBatch.instanceBuffer = this.instanceBuffer;
    this.renderBatchEntity.add(renderBatch);
  }
}
