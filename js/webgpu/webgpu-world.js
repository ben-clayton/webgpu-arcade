import { CoreWorld } from '../core/core-world.js';
import { WebGPU, WebGPUSwapConfig, WebGPULayouts, WebGPURenderGeometry, WebGPUPipeline } from './webgpu-components.js';
import { WebGPURenderer } from './webgpu-renderer.js';
import { WebGPUGeometrySystem } from './webgpu-geometry.js';
import { WebGPUPipelineSystem } from './webgpu-pipeline.js';

export class WebGPUWorld extends CoreWorld {
  constructor(options = {}) {
    super();

    this.registerSingletonComponent(WebGPU, { canvas: options.canvas });
    this.registerSingletonComponent(WebGPUSwapConfig, {
      format: options.format,
      depthFormat: options.depthFormat || WebGPUSwapConfig.schema.depthFormat.default,
      sampleCount: options.sampleCount || WebGPUSwapConfig.schema.sampleCount.default,
    });
    this.registerSingletonComponent(WebGPULayouts);

    this.registerComponent(WebGPURenderGeometry);
    this.registerComponent(WebGPUPipeline);

    this.registerSystem(WebGPURenderer);
    this.registerSystem(WebGPUGeometrySystem);
    this.registerSystem(WebGPUPipelineSystem);
  }
}