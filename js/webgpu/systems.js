import { System } from 'ecs';
import { WebGPU } from './components.js';
import { Camera } from '../camera.js';
import { Transform } from '../transform.js';

import { RenderCube } from './cube.js';

// These are features that we want to enable on the GPUDevice if they are available
const desiredFeatures = [
  'texture-compression-bc'
];

export class WebGPURenderer extends System {
  static queries = {
    cameras: { components: [Camera] }
  };

  async init() {
    const gpu = this.modifySingleton(WebGPU);

    if (!gpu.canvas) {
      gpu.canvas = document.createElement('canvas');
    }

    if (!gpu.context) {
      gpu.context = gpu.canvas.getContext('gpupresent');
    }

    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });

      // Determine which of the desired features can be enabled for this device.
      const nonGuaranteedFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
      gpu.device = await adapter.requestDevice({nonGuaranteedFeatures});
    }

    if (!gpu.format) {
      gpu.format = gpu.context.getSwapChainPreferredFormat(gpu.adapter);
    }

    gpu.swapChain = gpu.context.configureSwapChain({
      device: gpu.device,
      format: gpu.format
    });

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

    this.queries.cameras.results.forEach(entity => {
      const camera = entity.read(Camera);
      const transform = entity.read(Transform);

      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 0, camera.projectionMatrix);
      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 4 * 16, camera.viewMatrix);
      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 4 * 32, transform.position);

      const commandEncoder = gpu.device.createCommandEncoder({});

      const renderPassDescriptor = {
        colorAttachments: [{
          view: gpu.swapChain.getCurrentTexture().createView(),
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
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