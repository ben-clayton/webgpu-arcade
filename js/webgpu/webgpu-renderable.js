export const RenderOrder = {
  Default: 1,
  Skybox: 2,
  Transparent: 3,
};

export class WebGPURenderable {
  pipeline = null;
  renderOrder = RenderOrder.Default;
  drawCount = 0;

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