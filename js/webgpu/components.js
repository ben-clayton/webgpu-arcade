export class WebGPU {
  device = null;
  format = 'bgra8unorm';
  depthFormat = 'depth24plus';
  sampleCount = 1;

  get adapter() {
    return this.device?.adapter;
  }
}

export class WebGPUSwapChain {
  constructor(context, swapChain) {
    this.context = context;
    this.swapChain = swapChain;
  }

  get canvas() {
    return this.context.canvas;
  }
}
