import { System, Not } from '../third-party/ecsy/src/System.js';
import { WebGPU, WebGPURenderGeometry, WebGPUPipeline } from '../components/webgpu.js';

export class WebGPUGeometrySystem extends System {
  static queries = {
    pendingPipeline: { components: [WebGPURenderGeometry, Not(WebGPUPipeline)] }, // TODO: Include Material
    removePipeline: { components: [Not(WebGPURenderGeometry), WebGPUPipeline] }
  };

  init() {
    this.pipelineCache = new Map();
  }

  execute() {
    const gpu = this.getSingletonComponent(WebGPU);
    if (!gpu.device) { return; }

    const swapConfig = this.getSingletonComponent(WebGPUSwapConfig);

    this.queries.pendingPipeline.results.forEach((entity) => {
      const geometry = entity.getComponent(WebGPURenderGeometry);

      // TODO: Optimize
      const pipelineKey = JSON.stringify(geometry.vertexState);

      let gpuPipeline = this.pipelineCache.get(pipelineKey);
      if (!gpuPipeline) {

        gpuPipeline = gpu.device.createPipeline({
          vertexStage: { module: null, entryPoint: 'vertexMain'},
          fragementStage: { module: null, entryPoint: 'fragmentMain'},

          primitiveTopology: geometry.topology,
          vertexState: geometry.vertexState,

          colorStates: [{
            format: swapConfig.format,
          }],
          depthStencilState: {
            format: swapConfig.depthFormat,
            depthWriteEnabled: true,
            depthCompare: 'less',
          },
          sampleCount: swapConfig.sampleCount,
        });
      }

      entity.addComponent(WebGPUPipeline, { pipeline: gpuPipeline });
    });

    this.queries.removePipeline.results.forEach((entity) => {
      entity.removeComponent(WebGPUPipeline);
    });
  }
}