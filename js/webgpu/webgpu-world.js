import { RenderWorld } from '../core/render-world.js';
import { WebGPUBufferManager } from './webgpu-buffer.js';
import { WebGPUBindGroupLayouts } from './webgpu-bind-group-layouts.js'
import { WebGPUTextureLoader } from 'webgpu-texture-loader';

import { WebGPUCameraSystem } from './webgpu-camera.js';
import { WebGPUClusteredLights } from './webgpu-clustered-light.js';
import { WebGPURenderPass } from './webgpu-render-pass.js';
import { WebGPUMeshSystem } from './webgpu-mesh.js';
import { WebGPURenderBatch } from './webgpu-render-batch.js';

const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPUWorld extends RenderWorld {
  adapter = null;
  device = null;
  format = 'bgra8unorm';
  depthFormat = 'depth24plus';
  sampleCount = 4;

  context = null;
  size = {width: 0, height: 0};

  bindGroupLayouts = {};
  bufferManager = null;
  #textureLoader = null;

  constructor(canvas) {
    super(canvas);

    this.context = this.canvas.getContext('webgpu');

    // Unfortunately the order of these systems is kind of delicate.
    this.registerRenderSystem(WebGPUCameraSystem);
    this.registerRenderSystem(WebGPUClusteredLights);
    this.registerRenderSystem(WebGPUMeshSystem);
    this.registerRenderSystem(WebGPURenderPass);
  }

  async intializeRenderer() {
    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });

    // Determine which of the desired features can be enabled for this device.
    const requiredFeatures = desiredFeatures.filter(feature => this.adapter.features.has(feature));
    this.device = await this.adapter.requestDevice({requiredFeatures});

    // This function isn't available in Firefox, though it is in the spec.
    if (this.context.getPreferredFormat) {
      this.format = this.context.getPreferredFormat(this.adapter);
    }

    this.bindGroupLayouts = new WebGPUBindGroupLayouts(this.device);
    this.bufferManager = new WebGPUBufferManager(this.device);
    this.#textureLoader = new WebGPUTextureLoader(this.device);

    this.blackTextureView = this.#textureLoader.fromColor(0, 0, 0, 0).texture.createView();
    this.whiteTextureView = this.#textureLoader.fromColor(1.0, 1.0, 1.0, 1.0).texture.createView();
    this.defaultNormalTextureView = this.#textureLoader.fromColor(0.5, 0.5, 1.0, 0).texture.createView();
    this.defaultSampler = this.device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    this.singleton.add(new WebGPURenderBatch(this.device));

    return this;
  }

  // RenderWorld overloads
  get textureLoader() {
    return this.#textureLoader;
  }

  createStaticBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    return this.bufferManager.createStaticBuffer(sizeOrArrayBuffer, usage);
  }

  createDynamicBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    return this.bufferManager.createDynamicBuffer(sizeOrArrayBuffer, usage);
  }
}