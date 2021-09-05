import { WebGPUSystem } from './webgpu-system.js';

import { Transform } from '../core/transform.js';
import { WebGPUMesh } from './webgpu-mesh.js';
import { WebGPURenderBatch } from './webgpu-render-batch.js';

import { INSTANCE_BUFFER_SIZE } from './wgsl/common.js';

const MAX_INSTANCE_COUNT = 512;

export class WebGPUInstancingSystem extends WebGPUSystem {
  init(gpu) {
    // TODO: Make these dynamically sized
    this.instanceArray = new Float32Array(16 * MAX_INSTANCE_COUNT);
    this.instanceBuffer = gpu.device.createBuffer({
      size: INSTANCE_BUFFER_SIZE * MAX_INSTANCE_COUNT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.renderableMeshes = this.query(WebGPUMesh);

    this.singleton.add(new WebGPURenderBatch());
  }

  ensureBuffer

  execute(delta, time) {
    const gpu = this.world;

    const renderBatch = this.singleton.get(WebGPURenderBatch);

    this.renderableMeshes.forEach((entity, gpuMesh) => {
      renderBatch.addMesh(gpuMesh, entity.get(Transform), 1);
    });

    // Loop through all of the instances we're going to render and place their transforms in the
    // instances buffer.
    let arrayOffset = 0;
    for (const geometryMaterials of renderBatch.pipelineGeometries.values()) {
      for (const materialInstances of geometryMaterials.values()) {
        for (const instances of materialInstances.values()) {
          instances.bufferOffset = arrayOffset * Float32Array.BYTES_PER_ELEMENT;
          for (const transform of instances.transforms) {
            // TODO: Could just copy over the 4x3 portion of the matrix needed to represent a full
            // TRS transform. Copies would be slower, though.
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
  }
}
