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
  }

  execute(delta, time) {
    const gpu = this.getSingletonComponent(WebGPU);
    if (!gpu.device) { return; }

    const commandEncoder = gpu.device.createCommandEncoder({});
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        attachment: gpu.swapChain.getCurrentTexture().createView(),
        loadValue: {r: 1.0, g: 0.0, b: 1.0, a: 1.0},
      }]
    });

    passEncoder.endPass();
    gpu.device.defaultQueue.submit([commandEncoder.finish()]);
  }
}
