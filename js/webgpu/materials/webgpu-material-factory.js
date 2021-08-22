import { AttributeLocation } from '../../core/geometry.js';
import { DefaultVertexSource } from '../wgsl/default-vertex.js';

export const RenderOrder = {
  First: 0,
  Default: 1,
  Skybox: 2,
  Transparent: 3,
  Last: 4
};

let nextPipelineId = 1;

export class WebGPUMaterialPipeline {
  constructor(options) {
    this.pipelineId = nextPipelineId++;
    this.pipeline = options?.pipeline ?? null;
    this.renderOrder = options?.renderOrder ?? RenderOrder.Default
    this.instanceSlot = options?.instanceSlot ?? -1;
  }
}

export class WebGPUMaterialBindGroups {
  bindGroups = [];
  constructor(...bg) {
    this.bindGroups.push(...bg);
  }
}

const INSTANCE_BUFFER_LAYOUT = {
  arrayStride: 64,
  stepMode: 'instance',
  attributes: [{
    format: 'float32x4',
    offset: 0,
    shaderLocation: AttributeLocation.maxAttributeLocation,
  }, {
    format: 'float32x4',
    offset: 16,
    shaderLocation: AttributeLocation.maxAttributeLocation+1,
  }, {
    format: 'float32x4',
    offset: 32,
    shaderLocation: AttributeLocation.maxAttributeLocation+2,
  }, {
    format: 'float32x4',
    offset: 48,
    shaderLocation: AttributeLocation.maxAttributeLocation+3,
  }]
};



const materialFactories = new Map();

export class WebGPUMaterialFactory {
  renderOrder = RenderOrder.Default;
  #pipelineCache = new Map();
  #materialCache = new Map();

  static register(material, factory) {
    materialFactories.set(material, factory);
  }

  static getFactories() {
    return materialFactories;
  }

  init(gpu) {}

  getPipeline(gpu, geometryLayout, material) {
    const key = this.pipelineKey(geometryLayout, material);
    let gpuPipeline = this.#pipelineCache.get(key);
    if (!gpuPipeline) {
      const vertex = this.createVertexModule(gpu, geometryLayout, material);
      const fragment = this.createFragmentModule(gpu, geometryLayout, material);

      vertex.buffers = new Array(...geometryLayout.buffers);

      // Add a vertexSlot for the instance array
      vertex.buffers.push(INSTANCE_BUFFER_LAYOUT);

      const pipeline = this.createPipeline(gpu, geometryLayout, vertex, fragment, material);
      if (!pipeline) { return; }

      gpuPipeline = new WebGPUMaterialPipeline({
        pipeline,
        renderOrder: material.transparent ? RenderOrder.Transparent : this.renderOrder,
        instanceSlot: geometryLayout.buffers.length
      });
      this.#pipelineCache.set(key, gpuPipeline);
    }
    return gpuPipeline;
  }

  getBindGroup(gpu, material) {
    let bindGroup = this.#materialCache.get(material);
    if (!bindGroup) {
      bindGroup = new WebGPUMaterialBindGroups(this.createBindGroup(gpu, material));
      this.#materialCache.set(material, bindGroup);
    }
    return bindGroup;
  }

  pipelineKey(geometryLayout, material) {
    return `${geometryLayout.id};${material?.transparent};${material?.doubleSided}`;
  }

  // Creates a pipeline with defaults settings and the overridden shaders.
  // Can be customize if needed.
  createPipeline(gpu, layout, vertex, fragment, material) {
    let blend;
    if (material?.transparent) {
      blend = {
        color: {
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha',
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one",
        }
      };
    }

    fragment.targets = [{
      format: gpu.format,
      blend,
    }];

    return gpu.device.createRenderPipeline({
      label: `PBR Pipeline (LayoutID: ${layout.id})`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          this.bindGroupLayout,
        ]
      }),
      vertex,
      fragment,
      primitive: {
        topology: layout.primitive.topology,
        stripIndexFormat: layout.primitive.stripIndexFormat,
        cullMode: material.doubleSided ? 'none' : 'back',
      },
      depthStencil: {
        format: gpu.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
      multisample: { count: gpu.sampleCount, },
    });
  }

  createVertexModule(gpu, geometryLayout, material) {
    return {
      module: gpu.device.createShaderModule({ code: DefaultVertexSource(geometryLayout) }),
      entryPoint: 'vertexMain',
    };
  }

  createFragmentModule(gpu, geometryLayout, material) {
    throw new Error('Must override createFragmentModule() for each class that extends WebGPUMaterialShader.');
  }

  createBindGroup(gpu, material) {
    return null; // Some materials may not require a given bind group.
  }
}
