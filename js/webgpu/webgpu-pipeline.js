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

  createPipeline(gpu, entity, gpuGeometry, material) {
    throw new Error('Must override createPipeline() for each system that extends WebGPUPipelineSystem.');
  }

  pipelineKey(entity, gpuGeometry, material) {
    return gpuGeometry.layout.layoutId;
  }

  execute(delta, time) {
    const gpu = this.world;

    this.needsMaterialQuery.forEach((entity, gpuGeometry, material) => {
      const gpuPipeline = new WebGPURenderPipeline();
      gpuPipeline.renderOrder = this.renderOrder;

      const pipelineKey = this.pipelineKey(entity, gpuGeometry, material);

      let cachedPipeline = this.#pipelineCache.get(pipelineKey);
      if (cachedPipeline) {
        gpuPipeline.pipeline = cachedPipeline.pipeline;
        gpuPipeline.pipelineId = cachedPipeline.pipelineId++;
      } else {
        gpuPipeline.pipeline = this.createPipeline(gpu, entity, gpuGeometry, material);
        gpuPipeline.pipelineId = this.#nextPipelineId++;
        this.#pipelineCache.set(pipelineKey, {
          pipeline: gpuPipeline.pipeline,
          pipelineId: gpuPipeline.pipelineId
        });
      }

      entity.add(gpuPipeline);
    });
  }
}

export class WebGPUDefaultPipelineSystem extends WebGPUPipelineSystem {
  createPipeline(gpu, entity, gpuGeometry) {
    const layout = gpuGeometry.layout;

    return gpu.device.createRenderPipeline({
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

