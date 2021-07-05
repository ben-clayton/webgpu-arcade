export class WebGPU {
  device = null;
  format = 'bgra8unorm';
  depthFormat = 'depth24plus';
  sampleCount = 4;

  canvas = null;
  context = null;
  size = {width: 0, height: 0};

  bindGroupLayouts = {};

  get adapter() {
    return this.device?.adapter;
  }
}
