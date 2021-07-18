import { StaticBuffer } from '../core/geometry.js';

class WebGPUStaticBuffer extends StaticBuffer {
  #arrayBuffer;

  constructor(gpuBuffer, size, usage) {
    super(size, usage);

    this.gpuBuffer = gpuBuffer;
    // Static buffers are expected to be created with mappedAtCreation.
    this.#arrayBuffer = gpuBuffer.getMappedRange();
  }

  get arrayBuffer() {
    return this.#arrayBuffer;
  }

  // For static buffers, once you call finish() the data cannot be updated again.
  finish() {
    this.gpuBuffer.unmap();
    this.#arrayBuffer = null;
  }
}

function toGPUBufferUsage(usage) {
  switch (usage) {
    case 'vertex':
      return GPUBufferUsage.VERTEX;
    case 'index':
      return GPUBufferUsage.INDEX;
    default:
      throw new Error(`Unknown Buffer usage '${usage}'`);
  }
}

export class WebGPUBufferManager {
  constructor(device) {
    this.device = device;
  }

  createStaticBuffer(sizeOrArrayBuffer, usage) {
    let size;
    let arrayBufferView = null;
    if (typeof sizeOrArrayBuffer === 'number') {
      size = sizeOrArrayBuffer;
    } else {
      size = sizeOrArrayBuffer.byteLength;
      arrayBufferView = sizeOrArrayBuffer;
      if (!ArrayBuffer.isView(arrayBufferView)) {
        arrayBufferView = new Uint8Array(arrayBufferView);
      }
    }

    // Align the size to the next multiple of 4
    size =  Math.ceil(size / 4) * 4;

    const gpuBuffer = this.device.createBuffer({
      size,
      usage: toGPUBufferUsage(usage),
      mappedAtCreation: true,
    });
    const buffer = new WebGPUStaticBuffer(gpuBuffer, size, usage);

    // If an ArrayBuffer or TypedArray was passed in, initialize the GPUBuffer
    // with it's data. Otherwise we'll leave it mapped for the used to populate.
    if (arrayBufferView) {
      const typedArray = new arrayBufferView.constructor(buffer.arrayBuffer);
      typedArray.set(arrayBufferView);
      buffer.finish();
    }

    return buffer;
  }
}