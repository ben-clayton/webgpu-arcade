import { Renderer } from '../core/render-world.js';
import { WebGPURenderTargets } from './webgpu-render-targets.js';
import { WebGPURenderBatch } from './webgpu-render-batch.js';
import { WebGPUBufferManager } from './webgpu-buffer.js';
import { WebGPUBindGroupLayouts } from './webgpu-bind-group-layouts.js'
import { WebGPUTextureLoader } from 'webgpu-texture-loader';

const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPURenderer extends Renderer {
  adapter = null;
  device = null;

  renderTargets = null;

  bindGroupLayouts = {};
  bufferManager = null;
  #textureLoader = null;

  async init(canvas) {
    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });

    // Determine which of the desired features can be enabled for this device.
    const requiredFeatures = desiredFeatures.filter(feature => this.adapter.features.has(feature));
    this.device = await this.adapter.requestDevice({requiredFeatures});

    this.renderTargets = new WebGPURenderTargets(this.adapter, this.device, canvas);

    this.renderBatch = new WebGPURenderBatch(this.device);

    this.bindGroupLayouts = new WebGPUBindGroupLayouts(this.device);
    this.bufferManager = new WebGPUBufferManager(this.device);
    this.#textureLoader = new WebGPUTextureLoader(this.device);

    this.blackTextureView = this.#textureLoader.fromColor(0, 0, 0, 0).texture.createView();
    this.whiteTextureView = this.#textureLoader.fromColor(1.0, 1.0, 1.0, 1.0).texture.createView();
    this.defaultNormalTextureView = this.#textureLoader.fromColor(0.5, 0.5, 1.0, 0).texture.createView();
    this.defaultSampler = this.device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    // Render pass descriptor
    this.colorAttachment = {
      // view is acquired and set in onResize.
      view: undefined,
      // view is acquired and set in onFrame.
      resolveTarget: undefined,
      loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      storeOp: this.renderTargets.sampleCount > 1 ? 'discard' : 'store',
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

    this.renderTargets.addEventListener('reconfigured', () => {
      this.onRenderTargetsReconfigured();
    });
    this.onRenderTargetsReconfigured();
  }

  get canvas() {
    return this.renderTargets?.context.canvas;
  }

  // RenderWorld overloads
  get textureLoader() {
    return this.#textureLoader;
  }

  createStaticBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    return this.bufferManager.createStaticBuffer(sizeOrArrayBuffer, usage);
  }

  createDynamicBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    return this.bufferManager.createDynamicBuffer(sizeOrArrayBuffer, usage);
  }

  onRenderTargetsReconfigured() {
    // Override to configure with the appropriate render targets for this pass.
    // The defautls are simply to set the depth and MSAA texture;
    if (this.renderTargets.sampleCount > 1) {
      this.colorAttachment.view = this.renderTargets.msaaColorTexture.createView();
    }

    if (this.renderTargets.depthFormat) {
      this.depthAttachment.view = this.renderTargets.depthTexture.createView();
    }
  }

  render(camera) {
    const instanceBuffer = this.renderBatch.instanceBuffer;

    const outputTexture = this.renderTargets.context.getCurrentTexture();
    const commandEncoder = this.device.createCommandEncoder({});

    if (this.renderTargets.sampleCount > 1) {
      this.colorAttachment.resolveTarget = outputTexture.createView();
    } else {
      this.colorAttachment.view = outputTexture.createView();
    }

    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    passEncoder.setBindGroup(0, camera.bindGroup);

    // Loop through all the renderable entities and store them by pipeline.
    for (const pipeline of this.renderBatch.sortedPipelines) {
      passEncoder.setPipeline(pipeline.pipeline);

      const geometryList = this.renderBatch.pipelineGeometries.get(pipeline);
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

    passEncoder.endPass();

    this.device.queue.submit([commandEncoder.finish()]);

    // Clear the render batch. It'll be built up again next frame.
    this.renderBatch.clear();
  }
}