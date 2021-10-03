import { WebGPUSystem } from './webgpu-system.js';
import { WebGPURenderTargets } from './webgpu-render-targets.js';
import { WebGPURenderBatch } from './webgpu-render-batch.js';
import { WebGPUCamera } from './webgpu-camera.js';

export class WebGPURenderPass extends WebGPUSystem {
  async init(gpu) {
    this.singleton.add(new WebGPURenderTargets(gpu));

    this.cameras = this.query(WebGPUCamera);

    this.colorAttachment = {
      // view is acquired and set in onResize.
      view: undefined,
      // view is acquired and set in onFrame.
      resolveTarget: undefined,
      loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      storeOp: gpu.sampleCount > 1 ? 'discard' : 'store',
    };

    this.depthAttachment = {
      // view is acquired and set in onResize.
      view: undefined,
      depthLoadValue: 1.0,
      depthStoreOp: 'discard',
      stencilLoadValue: 0,
      stencilStoreOp: 'discard',
    };

    this.renderPassDescriptor = {
      colorAttachments: [this.colorAttachment],
      depthStencilAttachment: this.depthAttachment
    };

    const renderTargets = this.singleton.get(WebGPURenderTargets);
    renderTargets.addEventListener('reconfigured', () => {
      this.onRenderTargetsReconfigured(gpu, renderTargets);
    });
    this.onRenderTargetsReconfigured(gpu, renderTargets);
  }

  onRenderTargetsReconfigured(gpu, renderTargets) {
    // Override to configure with the appropriate render targets for this pass.
    // The defautls are simply to set the depth and MSAA texture;
    if (gpu.sampleCount > 1) {
      this.colorAttachment.view = renderTargets.msaaColorTexture.createView();
    }

    if (gpu.depthFormat) {
      this.depthAttachment.view = renderTargets.depthTexture.createView();
    }
  }

  execute(delta, time, gpu) {
    const renderBatch = this.singleton.get(WebGPURenderBatch);
    const instanceBuffer = renderBatch.instanceBuffer;

    const outputTexture = gpu.context.getCurrentTexture();
    const commandEncoder = gpu.device.createCommandEncoder({});

    if (gpu.sampleCount > 1) {
      this.colorAttachment.resolveTarget = outputTexture.createView();
    } else {
      this.colorAttachment.view = outputTexture.createView();
    }

    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    this.cameras.forEach((entity, camera) => {
      passEncoder.setBindGroup(0, camera.bindGroup);
  
      // Loop through all the renderable entities and store them by pipeline.
      for (const pipeline of renderBatch.sortedPipelines) {
        passEncoder.setPipeline(pipeline.pipeline);
  
        const geometryList = renderBatch.pipelineGeometries.get(pipeline);
        for (const [geometry, materialList] of geometryList) {
  
          for (const vb of geometry.vertexBuffers) {
            passEncoder.setVertexBuffer(vb.slot, vb.buffer.gpuBuffer, vb.offset);
          }
          const ib = geometry.indexBuffer;
          if (ib) {
            passEncoder.setIndexBuffer(ib.buffer.gpuBuffer, ib.format, ib.offset);
          }
  
          for (const [material, instances] of materialList) {
            if (pipeline.instanceSlot >= 0) {
              passEncoder.setVertexBuffer(pipeline.instanceSlot, instanceBuffer, instances.bufferOffset);
            }

            if (material) {
              let i = 1;
              for (const bindGroup of material.bindGroups) {
                passEncoder.setBindGroup(i++, bindGroup);
              }
            }

            if (ib) {
              passEncoder.drawIndexed(geometry.drawCount, instances.instanceCount);
            } else {
              passEncoder.draw(geometry.drawCount, instances.instanceCount);
            }
          }
        }
      }

      return false; // Don't try to process more than one camera.
    });

    passEncoder.endPass();

    gpu.device.queue.submit([commandEncoder.finish()]);

    // Clear the render batch. It'll be built up again next frame.
    renderBatch.clear();
  }
}
