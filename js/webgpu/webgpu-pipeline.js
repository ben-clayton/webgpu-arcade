import { System } from 'ecs';
import { Geometry, AttributeLocation } from '../core/geometry.js';

export const RenderOrder = {
  First: 0,
  Default: 1,
  Skybox: 2,
  Transparent: 3,
  Last: 4
};

export class WebGPURenderPipeline {
  pipelineId = 0;
  pipeline = null;
  renderOrder = RenderOrder.Default;
  instanceSlot = -1;
}

export class WebGPURenderMaterial {
  constructor(...bindGroups) {
    this.bindGroups = bindGroups;
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

export class WebGPUPipelineSystem extends System {
  #nextPipelineId = 1;
  #pipelineCache = new Map();
  #materialCache = new Map();
  renderOrder = RenderOrder.Default;

  async init(gpu, materialComponent) {
    let queryArgs = [Geometry];
    if (materialComponent) {
      queryArgs.push(materialComponent);
    }
    this.needsMaterialQuery = this.query(...queryArgs).not(WebGPURenderPipeline);
  }

  createMaterialBindGroup(gpu, entity, material) {
    return null; // Some materials may not require a given bind group.
  }

  pipelineKey(entity, gpuGeometry, material) {
    return `${gpuGeometry.layoutId};${material?.transparent};${material?.doubleSided}`;
  }

  createVertexModule(gpu, entity, geometryLayout, material) {
    throw new Error('Must override createVertexModule() for each system that extends WebGPUPipelineSystem.');
  }

  createFragmentModule(gpu, entity, geometryLayout, material) {
    throw new Error('Must override createFragmentModule() for each system that extends WebGPUPipelineSystem.');
  }

  // Creates a pipeline with defaults settings and the overridden shaders.
  // Can be customize if needed.
  createPipeline(gpu, entity, layout, vertex, fragment, material) {
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
        cullMode: material?.doubleSided ? 'none' : 'back',
      },
      depthStencil: {
        format: gpu.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
      multisample: { count: gpu.sampleCount, },
    });
  }

  execute(delta, time) {
    const gpu = this.world;

    this.needsMaterialQuery.forEach((entity, geometry, material) => {
      const pipelineKey = this.pipelineKey(entity, geometry, material);

      let gpuPipeline = this.#pipelineCache.get(pipelineKey);
      if (!gpuPipeline) {
        const layout = geometry.layout;
        const vertex = this.createVertexModule(gpu, entity, layout, material);
        const fragment = this.createFragmentModule(gpu, entity, layout, material);

        vertex.buffers = new Array(...layout.buffers);

        // Add a vertexSlot for the instance array
        vertex.buffers.push(INSTANCE_BUFFER_LAYOUT);

        const pipeline = this.createPipeline(gpu, entity, layout, vertex, fragment, material);
        if (!pipeline) { return; }

        gpuPipeline = new WebGPURenderPipeline();
        gpuPipeline.renderOrder = material?.transparent ? RenderOrder.Transparent : this.renderOrder;
        gpuPipeline.pipeline = pipeline;
        gpuPipeline.pipelineId = this.#nextPipelineId++;
        gpuPipeline.instanceSlot = layout.buffers.length;
        this.#pipelineCache.set(pipelineKey, gpuPipeline);
      }

      let gpuMaterial = this.#materialCache.get(material);
      if (!gpuMaterial) {
        const mbg = this.createMaterialBindGroup(gpu, entity, material);
        gpuMaterial = new WebGPURenderMaterial(mbg);
        this.#materialCache.set(material, gpuMaterial);
      }

      entity.add(gpuPipeline, gpuMaterial);
    });
  }
}
