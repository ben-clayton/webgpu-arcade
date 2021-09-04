import { WebGPURenderPass } from './webgpu-render-pass.js';

export class WebGPUNormalRenderPass extends WebGPURenderPass {
  #pipelineCache = new Map();

  renderPass(gpu, camera, commandEncoder, outputTexture) {
    this.renderables.forEach((entity, geometry, pipeline) => {
      let pipeline = this.#pipelineCache(geometry.layoutId);
      geometryList.push(geometry);
    });
  }
}
