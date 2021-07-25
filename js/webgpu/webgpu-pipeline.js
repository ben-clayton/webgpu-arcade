import { System } from 'ecs';
import { WebGPURenderGeometry } from './webgpu-geometry.js';
import { DefaultVertexSource, DefaultFragmentSource } from './wgsl/default-material.js';

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

export class WebGPUPipelineSystem extends System {
  #nextPipelineId = 1;
  #pipelineCache = new Map();
  renderOrder = RenderOrder.Default;

  async init(gpu, materialComponent) {
    let queryArgs = [WebGPURenderGeometry];
    if (materialComponent) {
      queryArgs.push(materialComponent);
    }
    this.needsMaterialQuery = this.query(...queryArgs).not(WebGPURenderPipeline);
  }

  createMaterialBindGroup(gpu, entity, material) {
    return null; // Some materials may not require a given bind group.
  }

  createPipeline(gpu, entity, gpuGeometry, material) {
    throw new Error('Must override createPipeline() for each system that extends WebGPUPipelineSystem.');
  }

  pipelineKey(entity, gpuGeometry, material) {
    return gpuGeometry.layoutId;
  }

  execute(delta, time) {
    const gpu = this.world;

    this.needsMaterialQuery.forEach((entity, gpuGeometry, material) => {
      const gpuPipeline = new WebGPURenderPipeline();
      gpuPipeline.renderOrder = this.renderOrder;

      const pipelineKey = this.pipelineKey(entity, gpuGeometry, material);

      let cachedPipeline = this.#pipelineCache.get(pipelineKey);
      //cachedPipeline = undefined; // TODO: NOT THIS.
      if (!cachedPipeline) {
        const pipeline = this.createPipeline(gpu, entity, gpuGeometry, material);
        if (!pipeline) { return; }
        
        cachedPipeline = {
          pipeline,
          pipelineId: this.#nextPipelineId++,
        };
        this.#pipelineCache.set(pipelineKey, cachedPipeline);
      }

      gpuPipeline.pipeline = cachedPipeline.pipeline;
      gpuPipeline.pipelineId = cachedPipeline.pipelineId;
      gpuGeometry.materialBindGroup = this.createMaterialBindGroup(gpu, entity, material);

      entity.add(gpuPipeline);
    });
  }
}

export class WebGPUDefaultPipelineSystem extends WebGPUPipelineSystem {
  createPipeline(gpu, entity, gpuGeometry) {
    const layout = gpuGeometry.layout;

    return gpu.device.createRenderPipeline({
      label: `Default Pipeline (LayoutID: ${gpuGeometry.layoutId})`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.model
        ]
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: DefaultVertexSource(layout) }),
        entryPoint: 'vertexMain',
        buffers: layout.buffers,
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: DefaultFragmentSource(layout) }),
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format,
        }],
      },

      primitive: {
        topology: layout.primitive.topology,
        stripIndexFormat: layout.primitive.stripIndexFormat,
        cullMode: 'back',
      },
      depthStencil: {
        format: gpu.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
      multisample: { count: gpu.sampleCount, },
    });
  }
}

