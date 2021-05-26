import { System } from 'ecs';
import { WebGPU } from './components.js';

// These are features that we want to enable on the GPUDevice if they are available
const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPURenderer extends System {
  static queries = {
    //canvas: { components: [WebGPUCanvas], listen: { added: true } },
  };

  async init() {
    const gpu = this.modifySingleton(WebGPU);

    if (!gpu.canvas) {
      gpu.canvas = document.createElement('canvas');
    }

    if (!gpu.context) {
      gpu.context = gpu.canvas.getContext('gpupresent');
    }

    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });

      // Determine which of the desired features can be enabled for this device.
      const nonGuaranteedFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
      gpu.device = await adapter.requestDevice({nonGuaranteedFeatures});
    }

    if (!gpu.format) {
      gpu.format = gpu.context.getSwapChainPreferredFormat(gpu.adapter);
    }

    gpu.swapChain = gpu.context.configureSwapChain({
      device: gpu.device,
      format: gpu.format
    });
  }

  execute(delta, time) {
    const gpu = this.readSingleton(WebGPU);

    const renderPassDescriptor = {
      colorAttachments: [{
        view: gpu.swapChain.getCurrentTexture().createView(),
        loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
        storeOp: 'store',
      }]
    };

    const commandEncoder = gpu.device.createCommandEncoder({});
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);



    passEncoder.endPass();
    gpu.device.queue.submit([commandEncoder.finish()]);
  }
}