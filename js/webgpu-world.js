import { World } from './ecs/world.js';
import { Geometry, GeometryError, RenderGeometry } from './core/components/geometry.js';
import { WebGPU, WebGPUSwapConfig, WebGPURenderGeometry, WebGPUPipeline } from './webgpu/webgpu-components.js';
import { WebGPURenderer } from './webgpu/webgpu-renderer.js';
import { WebGPUGeometrySystem } from './webgpu/webgpu-geometry.js';
import { WebGPUPipelineSystem } from './webgpu/webgpu-pipeline.js';

export class WebGPUWorld extends World {
  constructor(options = {}) {
    super();

    this.registerSingletonComponent(WebGPU, { canvas: options.canvas });
    this.registerSingletonComponent(WebGPUSwapConfig, {
      format: options.format,
      depthFormat: options.depthFormat || WebGPUSwapConfig.schema.depthFormat.default,
      sampleCount: options.sampleCount || WebGPUSwapConfig.schema.sampleCount.default,
    });

    this.registerComponent(Geometry);
    this.registerComponent(GeometryError);
    this.registerComponent(RenderGeometry);
    this.registerComponent(WebGPURenderGeometry);
    this.registerComponent(WebGPUPipeline);

    this.registerSystem(WebGPURenderer);
    this.registerSystem(WebGPUGeometrySystem);
    this.registerSystem(WebGPUPipelineSystem);
  }
}