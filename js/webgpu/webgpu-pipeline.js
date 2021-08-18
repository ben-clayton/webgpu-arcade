import { System } from 'ecs';
import { Geometry } from '../core/geometry.js';

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
}

export class WebGPURenderMaterial {
  constructor(...bindGroups) {
    this.bindGroups = bindGroups;
  }
}

export class WebGPUPipelineSystem extends System {
  #nextPipelineId = 1;
  #pipelineCache = new Map();
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

  createVertexModule(gpu, entity, gpuGeometry, material) {
    throw new Error('Must override createVertexModule() for each system that extends WebGPUPipelineSystem.');
  }

  createFragmentModule(gpu, entity, gpuGeometry, material) {
    throw new Error('Must override createFragmentModule() for each system that extends WebGPUPipelineSystem.');
  }

  // Creates a pipeline with defaults settings and the overridden shaders.
  // Can be customize if needed.
  createPipeline(gpu, entity, gpuGeometry, material) {
    const layout = gpuGeometry.layout;

    const vertex = this.createVertexModule(gpu, entity, gpuGeometry, material);
    const fragment = this.createFragmentModule(gpu, entity, gpuGeometry, material);

    vertex.buffers = layout.buffers;

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
      label: `PBR Pipeline (LayoutID: ${gpuGeometry.layoutId})`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.model,
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
      const gpuPipeline = new WebGPURenderPipeline();
      gpuPipeline.renderOrder = material?.transparent ? RenderOrder.Transparent : this.renderOrder;

      const pipelineKey = this.pipelineKey(entity, geometry, material);

      let cachedPipeline = this.#pipelineCache.get(pipelineKey);
      if (!cachedPipeline) {
        const pipeline = this.createPipeline(gpu, entity, geometry, material);
        if (!pipeline) { return; }

        cachedPipeline = {
          pipeline,
          pipelineId: this.#nextPipelineId++,
        };
        this.#pipelineCache.set(pipelineKey, cachedPipeline);
      }

      gpuPipeline.pipeline = cachedPipeline.pipeline;
      gpuPipeline.pipelineId = cachedPipeline.pipelineId;
      entity.add(gpuPipeline);

      const mbg = this.createMaterialBindGroup(gpu, entity, material);
      if (mbg) {
        entity.add(new WebGPURenderMaterial(mbg));
      }
    });
  }
}
