import { System } from 'ecs';
import { Geometry } from '../core/geometry.js';
import { WebGPURenderTargets } from './webgpu-render-targets.js';
import { WebGPURenderGeometry } from './webgpu-geometry.js';
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
    this.renderables = this.query(Geometry, WebGPURenderGeometry, WebGPURenderPipeline);

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
    const pipelineGeometries = new Map();

    // Loop through all the renderable entities and store them by pipeline.
    this.renderables.forEach((entity, geometry, instance, pipeline) => {
      let geometryList = pipelineGeometries.get(pipeline);
      if (!geometryList) {
        geometryList = [];
        pipelineGeometries.set(pipeline, geometryList);
      }
      geometryList.push({geometry, instance, material: entity.get(WebGPURenderMaterial)});
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

      for (const { geometry, instance, material } of geometryList) {
        passEncoder.setBindGroup(1, instance.bindGroup);

        if (material) {
          let i = 2;
          for (const bindGroup of material.bindGroups) {
            passEncoder.setBindGroup(i, bindGroup);
          }
        }

        for (const vb of geometry.vertexBuffers) {
          passEncoder.setVertexBuffer(vb.slot, vb.buffer.gpuBuffer, vb.offset);
        }
        const ib = geometry.indexBuffer;
        if (ib) {
          passEncoder.setIndexBuffer(ib.buffer.gpuBuffer, ib.format, ib.offset);
          passEncoder.drawIndexed(geometry.drawCount, instance.instanceCount);
        } else {
          passEncoder.draw(geometry.drawCount, instance.instanceCount);
        }
      }
    }

    passEncoder.endPass();
  }
}
