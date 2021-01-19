import {System} from '../third-party/ecsy/src/System.js';
import {WebGPU, WebGPUSwapConfig} from '../components/webgpu.js';

export class WebGPURenderer extends System {
  static queries = {
    swapConfig: { components: [WebGPUSwapConfig], listen: { changed: true } },
    renderable: { components: [WebGPURenderGeometry] }
  };

  async init() {
    const gpu = this.getMutableSingletonComponent(WebGPU);
    const swapConfig = this.getMutableSingletonComponent(WebGPUSwapConfig);

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
      const swapConfig = this.getMutableSingletonComponent(WebGPUSwapConfig);
      swapConfig.width = canvasWidth;
      swapConfig.height = canvasHeight;
      return true;
    }
    return false;
  }

  updateRenderTargets() {
    const gpu = this.getSingletonComponent(WebGPU);
    const swapConfig = this.getSingletonComponent(WebGPUSwapConfig);

    gpu.canvas.width = swapConfig.width;
    gpu.canvas.height = swapConfig.height;

    if (swapConfig.sampleCount > 1) {
      const msaaColorTexture = gpu.device.createTexture({
        size: { width: swapConfig.width, height: swapConfig.height, depth: 1 },
        sampleCount: swapConfig.sampleCount,
        format: swapConfig.format,
        usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
      });
      this.colorAttachment.attachment = msaaColorTexture.createView();
    } else {
      this.colorAttachment.resolveTarget = undefined;
    }

    const depthTexture = gpu.device.createTexture({
      size: { width: swapConfig.width, height: swapConfig.height, depth: 1 },
      sampleCount: swapConfig.sampleCount,
      format: swapConfig.depthFormat,
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT
    });
    this.depthAttachment.attachment = depthTexture.createView();
  }

  execute(delta, time) {
    const gpu = this.getSingletonComponent(WebGPU);
    const swapConfig = this.getSingletonComponent(WebGPUSwapConfig);
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

    passEncoder.endPass();
    gpu.device.defaultQueue.submit([commandEncoder.finish()]);
  }
}
