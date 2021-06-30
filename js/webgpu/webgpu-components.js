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

export const RenderOrder = {
  First: 0,
  Default: 1,
  Skybox: 2,
  Transparent: 3,
  Last: 4
};

export class WebGPURenderGeometry {
  layoutId = 0;
  layout = null;
  drawCount = 0;
  indexBuffer = null;
  vertexBuffers = [];
}

export class WebGPURenderable {
  pipeline = null;
  renderOrder = RenderOrder.Default;
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