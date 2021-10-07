import { RenderWorld } from '../core/render-world.js';

import { WebGPUSystem } from './webgpu-system.js';
import { WebGPUCamera } from './webgpu-camera.js';
import { WebGPUCameraSystem } from './webgpu-camera.js';
import { WebGPUClusteredLights } from './webgpu-clustered-light.js';
import { WebGPUMeshSystem } from './webgpu-mesh.js';
import { WebGPURenderer } from './webgpu-renderer.js';
import { WebGPUParticleSystem } from './webgpu-particles.js';

class WebGPURenderPass extends WebGPUSystem {
  async init(gpu) {
    this.cameras = this.query(WebGPUCamera);
  }

  execute(delta, time, gpu) {
    this.cameras.forEach((entity, camera) => {
      gpu.render(camera);
      return false; // Don't try to process more than one camera.
    });
  }
}

export class WebGPUWorld extends RenderWorld {
  async intializeRenderer() {
    const renderer = new WebGPURenderer();
    await renderer.init(this.canvas);

    // Unfortunately the order of these systems is kind of delicate.
    this.registerRenderSystem(WebGPUCameraSystem);
    this.registerRenderSystem(WebGPUClusteredLights);
    this.registerRenderSystem(WebGPUMeshSystem);
    this.registerRenderSystem(WebGPURenderPass);
    this.registerRenderSystem(WebGPUParticleSystem);

    return renderer;
  }
}