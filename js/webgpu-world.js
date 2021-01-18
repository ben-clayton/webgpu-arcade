import { World } from './third-party/ecsy/src/World.js';
import { WebGPU, WebGPUSwapConfig, WebGPURenderGeometry } from './components/webgpu.js';
import { Geometry, GeometryError, RenderGeometry } from './components/geometry.js';
import { WebGPURenderer } from './systems/webgpu-renderer.js';
import { WebGPUGeometrySystem } from './systems/webgpu-geometry.js';

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

    this.registerSystem(WebGPURenderer);
    this.registerSystem(WebGPUGeometrySystem);
  }
}