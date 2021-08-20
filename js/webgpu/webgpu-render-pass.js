import { System } from 'ecs';
import { Geometry } from '../core/geometry.js';
import { WebGPURenderTargets } from './webgpu-render-targets.js';
import { WebGPURenderBatch } from './webgpu-geometry.js';
import { WebGPURenderMaterial, WebGPURenderPipeline } from './webgpu-pipeline.js';
import { WebGPUCamera } from './webgpu-camera.js';

class RenderPassGlobals {
  commandEncoder;
  outputTexture;
}

export class WebGPUBeginRenderPasses extends System {
  init(gpu) {
    this.singleton.add(new RenderPassGlobals());
    this.singleton.add(new WebGPURenderTargets(gpu));
  }

  execute() {
    const gpu = this.world;
    const passGlobals = this.singleton.get(RenderPassGlobals);
    passGlobals.outputTexture = gpu.context.getCurrentTexture();
    passGlobals.commandEncoder = gpu.device.createCommandEncoder({});
  }
}

export class WebGPUSubmitRenderPasses extends System {
  execute() {
    const gpu = this.world;
    const passGlobals = this.singleton.get(RenderPassGlobals);
    gpu.device.queue.submit([passGlobals.commandEncoder.finish()]);
  }
}

export class WebGPURenderPass extends System {
  async init(gpu) {
    this.cameras = this.query(WebGPUCamera);
    this.renderBatch = this.query(WebGPURenderBatch);

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

  renderPass(gpu, camera, commandEncoder, outputTexture) {
    // Override for each render pass.
  }

  execute(delta, time) {
    const gpu = this.world;
    const passGlobals = this.singleton.get(RenderPassGlobals);

    this.cameras.forEach((entity, camera) => {
      this.renderPass(gpu, camera, passGlobals.commandEncoder, passGlobals.outputTexture);
      return false; // Don't try to process more than one camera.
    });
  }
}

export class WebGPUDefaultRenderPass extends WebGPURenderPass {
  renderPass(gpu, camera, commandEncoder, outputTexture) {
    if (gpu.sampleCount > 1) {
      this.colorAttachment.resolveTarget = outputTexture.createView();
    } else {
      this.colorAttachment.view = outputTexture.createView();
    }

    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    passEncoder.setBindGroup(0, camera.bindGroup);

    // Loop through all the renderable entities and store them by pipeline.
    this.renderBatch.forEach((entity, renderBatch) => {
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
              passEncoder.setVertexBuffer(pipeline.instanceSlot, renderBatch.instanceBuffer, instances.bufferOffset);
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
    });

    passEncoder.endPass();
  }
}
