export class WebGPUBindGroupLayouts {
  frame = null;
}

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

export class WebGPURenderable {
  pipeline = null;
  renderOrder = 0;
  drawCount = 0;
  instanceCount = 1;

  #indexBuffer = null;
  get indexBuffer() { return this.#indexBuffer; }
  setIndexBuffer(buffer, format='uint32', offset=0, size=0) {
    this.#indexBuffer = {buffer, format, offset, size};
  }

  #vertexBuffers = new Map();
  get vertexBuffers() { return this.#vertexBuffers.values(); }
  setVertexBuffer(slot, buffer, offset=0, size=0) {
    this.#vertexBuffers.set(slot, {slot, buffer, offset, size});
  }
}