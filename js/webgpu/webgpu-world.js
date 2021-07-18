import { World } from 'ecs';

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

  constructor(canvas) {
    super();

    canvas = canvas || document.createElement('canvas');
    this.context = canvas.getContext('webgpu');

    this.#gpuInitialized = this.init(canvas);
  }

  async init(canvas) {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance"
    });

    // Determine which of the desired features can be enabled for this device.
    const requiredFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
    this.device = await adapter.requestDevice({requiredFeatures});

    this.format = this.context.getPreferredFormat(adapter);

    this.bindGroupLayouts.frame = this.device.createBindGroupLayout({
      label: `Frame BindGroupLayout`,
      entries: [{
        binding: 0, // Camera uniforms
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: {},
      }, {
        binding: 1, // Light uniforms
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
      }, {
        binding: 2, // Cluster Lights storage
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
      }]
    });

    this.bindGroupLayouts.model = this.device.createBindGroupLayout({
      label: `Model BindGroupLayout`,
      entries: [{
        binding: 0, // Model uniforms
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      }]
    });

    return this;
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
}