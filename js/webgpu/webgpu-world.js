import { World } from 'ecs';

import { WebGPU } from './webgpu.js';

export class WebGPUWorld extends World {
  #gpuInitialized;

  constructor(canvas) {
    super();
    this.#gpuInitialized = this.init(canvas);
  }

  async init(canvas) {
    const gpu = new WebGPU(canvas);
    await gpu.init();
    this.singleton.add(gpu);

    return gpu;
  }

  registerGPUSystem(systemType, ...initArgs) {
    this.#gpuInitialized.then((gpu) => {
      this.registerSystem(systemType, gpu, ...initArgs);
    });
    return this;
  }
}