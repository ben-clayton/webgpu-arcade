import { System } from 'ecs';
import { WebGPU, WebGPUSwapChain } from './components.js';
import { OutputCanvas } from '../output-canvas.js';
import { Camera } from '../camera.js';
import { Transform } from '../transform.js';

import { RenderCube } from './cube.js';

// These are features that we want to enable on the GPUDevice if they are available
const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPURenderer extends System {
  async init() {
    const gpu = new WebGPU();

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

    this.singleton.add(gpu);
  }

  onCanvasResize(entity, pixelWidth, pixelHeight) {

  }

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);
    if (!gpu) { return; }

    this.query(OutputCanvas).not(WebGPUSwapChain).forEach((entity, output) => {
      const context = output.canvas.getContext('gpupresent');

      if (!context) {
        console.error('Unable to acquire "gpupresent" context from the given canvas.');
        return;
      }

      const swapChain = context.configureSwapChain({
        device: gpu.device,
        format: gpu.format
      });

      entity.add(new WebGPUSwapChain(context, swapChain));
    });

    this.query(WebGPUSwapChain).not(OutputCanvas).forEach(entity => {
      entity.remove(WebGPUSwapChain);
    });

    this.query(Camera, WebGPUSwapChain).forEach((entity, camera, swapChain) => {
      // TODO: Camera may not have a transform
      const transform = entity.get(Transform);
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