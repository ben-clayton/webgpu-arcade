import {System} from '../third-party/ecsy/src/System.js';
import {WebGPU} from '../components/webgpu.js';

export class WebGPURenderer extends System {
  static queries = {
    //renderable: { components: [] }
  };

  async init() {
    const gpu = this.getMutableSingletonComponent(WebGPU);

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

    if (!gpu.swapChainFormat) {
      // Get the preferred swap chain format if one wasn't specified.
      gpu.swapChainFormat = gpu.context.getSwapChainPreferredFormat(gpu.device.adapter);
    }

    gpu.swapChain = gpu.context.configureSwapChain({
      device: gpu.device,
      format: gpu.swapChainFormat
    });

    gpu.canvas.width = gpu.canvas.offsetWidth * devicePixelRatio;
    gpu.canvas.height = gpu.canvas.offsetHeight * devicePixelRatio;

    this.activeSwapChainFormat = gpu.swapChainFormat;
    this.activeSampleCount = gpu.sampleCount;
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

  updateRenderTargets() {
    const gpu = this.getSingletonComponent(WebGPU);

    gpu.canvas.width = gpu.canvas.offsetWidth * devicePixelRatio;
    gpu.canvas.height = gpu.canvas.offsetWidth * devicePixelRatio

    if (gpu.sampleCount > 1) {
      const msaaColorTexture = gpu.device.createTexture({
        size: { width: gpu.canvas.width, height: gpu.canvas.height, depth: 1 },
        sampleCount: gpu.sampleCount,
        format: gpu.swapChainFormat,
        usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
      });
      this.colorAttachment.attachment = msaaColorTexture.createView();
    } else {
      this.colorAttachment.resolveTarget = undefined;
    }

    const depthTexture = gpu.device.createTexture({
      size: { width: gpu.canvas.width, height: gpu.canvas.height, depth: 1 },
      sampleCount: gpu.sampleCount,
      format: gpu.depthFormat,
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT
    });
    this.depthAttachment.attachment = depthTexture.createView();

    this.activeSampleCount = gpu.sampleCount;
    this.activeSwapChainFormat = gpu.swapChainFormat;
  }

  execute(delta, time) {
    const gpu = this.getSingletonComponent(WebGPU);
    if (!gpu.device) { return; }

    // TODO: Monitor this better with events
    const canvasWidth = Math.floor(gpu.canvas.offsetWidth * devicePixelRatio);
    const canvasHeight = Math.floor(gpu.canvas.offsetWidth * devicePixelRatio);
    if (gpu.canvas.width != canvasWidth ||
        gpu.canvas.height != canvasHeight ||
        gpu.sampleCount != this.activeSampleCount ||
        gpu.swapChainFormat != this.activeSwapChainFormat) {
      // If the size or format of the render targets has changed rebuild them.
      this.updateRenderTargets();
    }

    if (gpu.sampleCount > 1) {
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
