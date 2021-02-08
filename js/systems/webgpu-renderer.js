import {System} from '../ecs/System.js';
import {WebGPU, WebGPUSwapConfig, WebGPURenderGeometry, WebGPUPipeline} from '../components/webgpu.js';

export class WebGPURenderer extends System {
  static queries = {
    swapConfig: { components: [WebGPUSwapConfig], listen: { changed: true } },
    renderable: { components: [WebGPURenderGeometry, WebGPUPipeline] }
  };

  async init() {
    const gpu = this.modifySingleton(WebGPU);
    const swapConfig = this.modifySingleton(WebGPUSwapConfig);

    if (!gpu.canvas) {
      // Create a canvas if one is not available.
      gpu.canvas = document.createElement('canvas');
    }
    gpu.context = gpu.canvas.getContext('gpupresent');

    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      gpu.device = await adapter.requestDevice();
    }

    if (!swapConfig.format) {
      // Get the preferred swap chain format if one wasn't specified.
      swapConfig.format = gpu.context.getSwapChainPreferredFormat(gpu.device.adapter);
    }

    gpu.swapChain = gpu.context.configureSwapChain({
      device: gpu.device,
      format: swapConfig.format
    });

    swapConfig.width = gpu.canvas.offsetWidth * devicePixelRatio;
    swapConfig.height = gpu.canvas.offsetHeight * devicePixelRatio;

    this.colorAttachment = {
      attachment: undefined,
      resolveTarget: undefined,
      loadValue: {r: 1.0, g: 0.0, b: 1.0, a: 1.0},
    };
    this.depthAttachment = {
      attachment: undefined,
      depthLoadValue: 1.0,
      depthStoreOp: 'store',
      stencilLoadValue: 0,
      stencilStoreOp: 'store',
    };
    this.renderPassDescriptor = {
      colorAttachments: [this.colorAttachment],
      depthStencilAttachment: this.depthAttachment
    }

    this.updateRenderTargets();
  }

  checkResize(canvas) {
    // TODO: Monitor this better with events
    const canvasWidth = Math.floor(canvas.offsetWidth * devicePixelRatio);
    const canvasHeight = Math.floor(canvas.offsetWidth * devicePixelRatio);
    if (canvas.width != canvasWidth ||
        canvas.height != canvasHeight) {
      const swapConfig = this.modifySingleton(WebGPUSwapConfig);
      swapConfig.width = canvasWidth;
      swapConfig.height = canvasHeight;
      return true;
    }
    return false;
  }

  updateRenderTargets() {
    const gpu = this.readSingleton(WebGPU);
    const swapConfig = this.readSingleton(WebGPUSwapConfig);

    gpu.canvas.width = swapConfig.width;
    gpu.canvas.height = swapConfig.height;

    if (swapConfig.sampleCount > 1) {
      const msaaColorTexture = gpu.device.createTexture({
        size: { width: swapConfig.width, height: swapConfig.height, depth: 1 },
        sampleCount: swapConfig.sampleCount,
        format: swapConfig.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.colorAttachment.attachment = msaaColorTexture.createView();
    } else {
      this.colorAttachment.resolveTarget = undefined;
    }

    const depthTexture = gpu.device.createTexture({
      size: { width: swapConfig.width, height: swapConfig.height, depth: 1 },
      sampleCount: swapConfig.sampleCount,
      format: swapConfig.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.depthAttachment.attachment = depthTexture.createView();
  }

  execute(delta, time) {
    const gpu = this.readSingleton(WebGPU);
    const swapConfig = this.readSingleton(WebGPUSwapConfig);
    if (!gpu.device) { return; }

    if (this.checkResize(gpu.canvas) || this.queries.swapConfig.changed.length) {
      this.updateRenderTargets();
    }

    if (swapConfig.sampleCount > 1) {
      this.colorAttachment.resolveTarget = gpu.swapChain.getCurrentTexture().createView();
    } else {
      this.colorAttachment.attachment = gpu.swapChain.getCurrentTexture().createView();
    }

    const commandEncoder = gpu.device.createCommandEncoder({});
    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    this.queries.renderable.results.forEach((entity) => {
      const geometry = entity.read(WebGPURenderGeometry);
      const pipeline = entity.read(WebGPUPipeline);

      // Bind the pipeline
      passEncoder.setPipeline(pipeline.pipeline);

      // TODO: Bind materials

      // Bind the geometry
      for (const vb of geometry.vertexBuffers) {
        passEncoder.setVertexBuffer(vb.slot, vb.buffer, vb.offset, vb.size);
      }
      if (geometry.indexBuffer) {
        const ib = geometry.indexBuffer;
        passEncoder.setIndexBuffer(ib.buffer, ib.format, ib.offset, ib.size);
        passEncoder.drawIndexed(geometry.drawCount);
      } else {
        passEncoder.draw(geometry.drawCount);
      }
    });

    passEncoder.endPass();
    gpu.device.queue.submit([commandEncoder.finish()]);
  }
}
