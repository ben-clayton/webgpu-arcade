import { System, Not } from 'ecs';
import { WebGPU, WebGPUSwapChain } from './components.js';
import { Camera, OutputCanvas } from '../camera.js';
import { Transform } from '../transform.js';

import { RenderCube } from './cube.js';

// These are features that we want to enable on the GPUDevice if they are available
const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPURenderer extends System {
  static queries = {
    needsSwapChain: { components: [OutputCanvas, Not(WebGPUSwapChain)] },
    removeSwapChain: { components: [WebGPUSwapChain, Not(OutputCanvas)] },
    renderCameras: { components: [Camera, WebGPUSwapChain] }
  };

  async init() {
    const gpu = this.modifySingleton(WebGPU);

    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });

      // Determine which of the desired features can be enabled for this device.
      const nonGuaranteedFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
      gpu.device = await adapter.requestDevice({nonGuaranteedFeatures});
    }

    // Frame uniforms
    const frameUniformBufferSize = 4 * 36; // 2 mat4 + 1 vec3
    this.frameUniformBuffer = gpu.device.createBuffer({
      size: frameUniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.frameBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {}
      }],
    });

    this.frameBindGroup = gpu.device.createBindGroup({
      layout: this.frameBindGroupLayout,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.frameUniformBuffer,
        },
      }],
    });

    this.renderCube = new RenderCube(gpu, this.frameBindGroupLayout);
  }

  execute(delta, time) {
    const gpu = this.readSingleton(WebGPU);

    this.queries.needsSwapChain.results.forEach(entity => {
      const output = entity.read(OutputCanvas);

      const context = output.canvas.getContext('gpupresent');

      if (!context) {
        console.error('Unable to acquire "gpupresent" context from the given canvas.');
        return;
      }

      const swapChain = context.configureSwapChain({
        device: gpu.device,
        format: gpu.format
      });

      entity.add(WebGPUSwapChain, {
        context,
        swapChain,
      });
    });

    this.queries.removeSwapChain.results.forEach(entity => {
      entity.remove(WebGPUSwapChain);
    });

    this.queries.renderCameras.results.forEach(entity => {
      const camera = entity.read(Camera);
      const swapChain = entity.read(WebGPUSwapChain);
      const transform = entity.read(Transform);

      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 0, camera.projectionMatrix);
      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 4 * 16, camera.viewMatrix);
      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 4 * 32, transform.position);

      const commandEncoder = gpu.device.createCommandEncoder({});

      const renderPassDescriptor = {
        colorAttachments: [{
          view: swapChain.swapChain.getCurrentTexture().createView(),
          loadValue: { r: 0.0, g: 0.0, b: 0.3, a: 1.0 },
          storeOp: 'store',
        }]
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

      passEncoder.setBindGroup(0, this.frameBindGroup);

      this.renderCube.draw(passEncoder);

      passEncoder.endPass();

      gpu.device.queue.submit([commandEncoder.finish()]);
    });
  }
}