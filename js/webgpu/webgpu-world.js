import { World } from 'ecs';

import { WebGPU } from './webgpu-components.js';

// These are features that we want to enable on the GPUDevice if they are available
const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPUWorld extends World {
  #gpuInitialized;

  constructor(canvas) {
    super();

    this.#gpuInitialized = this.init(canvas).then((gpu) => {
      this.singleton.add(gpu);
    });
  }

  async init(canvas) {
    const gpu = new WebGPU();
    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });

      // Determine which of the desired features can be enabled for this device.
      const requiredFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
      gpu.device = await adapter.requestDevice({requiredFeatures});
    }

    gpu.canvas = canvas || document.createElement('canvas');
    gpu.context = gpu.canvas.getContext('gpupresent');
    gpu.format = gpu.context.getPreferredFormat(gpu.adapter);
    return gpu;
  }

  registerGPUSystem(systemType, ...initArgs) {
    this.#gpuInitialized.then(() => {
      this.registerSystem(systemType, ...initArgs);
    });
    return this;
  }
}