import { System } from 'ecs';

import { WebGPURenderGeometry } from './webgpu-geometry.js';
import { WebGPURenderPipeline } from './webgpu-pipeline.js';
import { WebGPUCamera } from './webgpu-camera.js';

export class WebGPURenderer extends System {
  async init(gpu) {
    this.colorAttachment = {
      // attachment is acquired and set in onResize.
      attachment: undefined,
      // attachment is acquired and set in onFrame.
      resolveTarget: undefined,
      loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      storeOp: gpu.sampleCount > 1 ? 'discard' : 'store',
    };

    this.depthAttachment = {
      // attachment is acquired and set in onResize.
      attachment: undefined,
      depthLoadValue: 1.0,
      depthStoreOp: 'discard',
      stencilLoadValue: 0,
      stencilStoreOp: 'discard',
    };

    this.renderPassDescriptor = {
      colorAttachments: [this.colorAttachment],
      depthStencilAttachment: this.depthAttachment
    };

    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target != gpu.canvas) { continue; }

        if (entry.devicePixelContentBoxSize) {
          // Should give exact pixel dimensions, but only works on Chrome.
          const devicePixelSize = entry.devicePixelContentBoxSize[0];
          this.onCanvasResized(gpu, devicePixelSize.inlineSize, devicePixelSize.blockSize);
        } else if (entry.contentBoxSize) {
          // Firefox implements `contentBoxSize` as a single content rect, rather than an array
          const contentBoxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
          this.onCanvasResized(gpu, contentBoxSize.inlineSize, contentBoxSize.blockSize);
        } else {
          this.onCanvasResized(gpu, entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    this.resizeObserver.observe(gpu.canvas);
    this.onCanvasResized(gpu, gpu.canvas.width, gpu.canvas.height);
  }

  onCanvasResized(gpu, pixelWidth, pixelHeight) {
    gpu.size.width = pixelWidth;
    gpu.size.height = pixelHeight;
    gpu.context.configure(gpu);

    if (gpu.sampleCount > 1) {
      const msaaColorTexture = gpu.device.createTexture({
        size: gpu.size,
        sampleCount: gpu.sampleCount,
        format: gpu.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.colorAttachment.view = msaaColorTexture.createView();
    }

    if (gpu.depthFormat) {
      const depthTexture = gpu.device.createTexture({
        size: gpu.size,
        sampleCount: gpu.sampleCount,
        format: gpu.depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      this.depthAttachment.view = depthTexture.createView();
    }
  }

  execute(delta, time) {
    const gpu = this.world;

    this.query(WebGPUCamera).forEach((entity, camera) => {
      const commandEncoder = gpu.device.createCommandEncoder({});

      const outputTexture = gpu.context.getCurrentTexture().createView();
      if (gpu.sampleCount > 1) {
        this.colorAttachment.resolveTarget = outputTexture;
      } else {
        this.colorAttachment.view = outputTexture;
      }

      const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

      passEncoder.setBindGroup(0, camera.bindGroup);

      this.query(WebGPURenderGeometry, WebGPURenderPipeline).forEach((entity, geometry, pipeline) => {
        passEncoder.setPipeline(pipeline.pipeline); // TODO: Dedup these calls
        passEncoder.setBindGroup(1, geometry.bindGroup);

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
      });

      passEncoder.endPass();

      gpu.device.queue.submit([commandEncoder.finish()]);
    });
  }
}