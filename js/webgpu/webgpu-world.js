import { World } from 'ecs';
import { WebGPUBufferManager } from './webgpu-buffer.js';
import { WebGPUBindGroupLayouts } from './webgpu-bind-group-layouts.js'
import { WebGPUTextureLoader } from 'webgpu-texture-loader';

const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPUWorld extends World {
  #gpuInitialized;

  device = null;
  format = 'bgra8unorm';
  depthFormat = 'depth24plus';
  sampleCount = 4;

  context = null;
  size = {width: 0, height: 0};

  bindGroupLayouts = {};
  bufferManager = null;
  textureLoader = null;

  constructor(canvas) {
    super();

    canvas = canvas || document.createElement('canvas');
    this.context = canvas.getContext('webgpu');
    if (!this.context) {
      // TODO: Remove once 'webgpu' is supported in Firefox
      this.context = canvas.getContext('gpupresent');
    }

    this.#gpuInitialized = this.#initWebGPU();
  }

  async #initWebGPU() {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });

    // Determine which of the desired features can be enabled for this device.
    const requiredFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
    this.device = await adapter.requestDevice({requiredFeatures});
    
    // This function isn't available in Firefox, though it is in the spec.
    if (this.context.getPreferredFormat) {
      this.format = this.context.getPreferredFormat(adapter);
    }

    this.bindGroupLayouts = new WebGPUBindGroupLayouts(this.device);
    this.bufferManager = new WebGPUBufferManager(this.device);
    this.textureLoader = new WebGPUTextureLoader(this.device);

    return this;
  }

  async intialize() {
    return await this.#gpuInitialized;
  }

  registerGPUSystem(systemType, ...initArgs) {
    this.#gpuInitialized.then((gpu) => {
      this.registerSystem(systemType, gpu, ...initArgs);
    });
    return this;
  }

  get adapter() {
    return this.device?.adapter;
  }

  get canvas() {
    return this.context.canvas;
  }

  createStaticBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    return this.bufferManager.createStaticBuffer(sizeOrArrayBuffer, usage);
  }
}