import { System } from 'ecs';

import { WebGPURenderPass } from './webgpu-render-pass.js';

export class WebGPUNormalRenderPass extends WebGPURenderPass {
  #pipelineCache = new Map();

  renderPass(gpu, camera, commandEncoder, outputTexture) {
    this.renderables.forEach((entity, geometry, pipeline) => {
      let pipeline = this.#pipelineCache(geometry.layoutId);
      geometryList.push(geometry);
    });
  }
}

export class WebGPUDefaultRenderPass extends WebGPURenderPass {
  renderPass(gpu, camera, commandEncoder, outputTexture) {
    const pipelineGeometries = new Map();

    // Loop through all the renderable entities and store them by pipeline.
    this.renderables.forEach((entity, geometry, pipeline) => {
      let geometryList = pipelineGeometries.get(pipeline);
      if (!geometryList) {
        geometryList = [];
        pipelineGeometries.set(pipeline, geometryList);
      }
      geometryList.push(geometry);
    });

    // Sort the pipelines by render order (e.g. so transparent objects are rendered last).
    const sortedPipelines = Array.from(pipelineGeometries.keys())
    sortedPipelines.sort((a, b) => a.renderOrder - b.renderOrder);

    if (gpu.sampleCount > 1) {
      this.colorAttachment.resolveTarget = outputTexture.createView();
    } else {
      this.colorAttachment.view = outputTexture.createView();
    }

    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    passEncoder.setBindGroup(0, camera.bindGroup);

    for (const pipeline of sortedPipelines) {
      const geometryList = pipelineGeometries.get(pipeline);
      passEncoder.setPipeline(pipeline.pipeline);

      for (const geometry of geometryList) {
        passEncoder.setBindGroup(1, geometry.bindGroup);

        if (geometry.materialBindGroup) {
          passEncoder.setBindGroup(2, geometry.materialBindGroup);
        }

        for (const vb of geometry.vertexBuffers) {
          passEncoder.setVertexBuffer(vb.slot, vb.buffer, vb.offset);
        }
        const ib = geometry.indexBuffer;
        if (ib) {
          passEncoder.setIndexBuffer(ib.buffer, ib.format);
          passEncoder.drawIndexed(geometry.drawCount, geometry.instanceCount);
        } else {
          passEncoder.draw(geometry.drawCount, geometry.instanceCount);
        }
      }
    }

    passEncoder.endPass();
  }
}
