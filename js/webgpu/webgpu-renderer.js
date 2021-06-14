import { System } from 'ecs';
import { OutputCanvas } from '../output-canvas.js';
import { Camera } from '../camera.js';
import { Transform } from '../transform.js';

import { WebGPURenderable } from './webgpu-renderable.js';
import { CubeRenderableFactory } from './cube.js';

import { mat4, vec3 } from 'gl-matrix';

export class WebGPU {
  device = null;
  format = 'bgra8unorm';
  depthFormat = 'depth24plus';
  sampleCount = 1;

  get adapter() {
    return this.device?.adapter;
  }
}

export class WebGPUSwapChain {
  constructor(context) {
    this.context = context;
    this.size = {width: 0, height: 0};
  }

  get canvas() {
    return this.context.canvas;
  }
}

export class WebGPUCamera {
  constructor() {
    this.array = new Float32Array(16 + 16 + 3);
    this.projectionMatrix = new Float32Array(this.array.buffer, 0, 16);
    this.viewMatrix = new Float32Array(this.array.buffer, 16 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.position = new Float32Array(this.array.buffer, 32 * Float32Array.BYTES_PER_ELEMENT, 3);
  }
}

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

    const cubeFactory = new CubeRenderableFactory(gpu, this.frameBindGroupLayout);

    this.world.create(
      new Transform(),
      cubeFactory.createRenderable()
    );

    this.singleton.add(gpu);
  }

  onSwapChainResized(gpu, swapChain) {
    swapChain.context.configure({
      device: gpu.device,
      format: gpu.format,
      size: swapChain.size,
    });
  }

  updateSwapChains(gpu) {
    this.query(OutputCanvas).not(WebGPUSwapChain).forEach((entity, output) => {
      const context = output.canvas.getContext('gpupresent');

      if (!context) {
        console.error('Unable to acquire "gpupresent" context from the given canvas.');
        return;
      }

      entity.add(new WebGPUSwapChain(context));
    });

    this.query(OutputCanvas, WebGPUSwapChain).forEach((entity, output, swapChain) => {
      if (output.width != swapChain.size.width ||
          output.height != swapChain.size.height) {
        swapChain.size.width = output.width;
        swapChain.size.height = output.height;
        this.onSwapChainResized(gpu, swapChain);
      }
    });

    this.query(WebGPUSwapChain).not(OutputCanvas).forEach(entity => {
      entity.remove(WebGPUSwapChain);
    });
  }

  updateCameras(gpu) {
    this.query(Camera).not(WebGPUCamera).forEach((entity) => {
      entity.add(new WebGPUCamera);
    });

    this.query(WebGPUCamera).not(Camera).forEach((entity) => {
      entity.remove(WebGPUCamera);
    });

    // Update the camera matrix
    this.query(Camera, WebGPUCamera).forEach((entity, camera, gpuCamera) => {
      const transform = entity.get(Transform);
      if (transform) {
        mat4.invert(gpuCamera.viewMatrix, transform.matrix);
        vec3.copy(gpuCamera.position, transform.position);
      } else {
        // If the camera doesn't have a transform position it at the origin.
        mat4.identity(gpuCamera.viewMatrix);
        vec3.set(gpuCamera.position, 0, 0, 0);
      }
      
      let aspect = 1.0;
      const output = entity.get(OutputCanvas);
      if (output) {
        aspect = output.width / output.height;
      }
      mat4.perspectiveZO(gpuCamera.projectionMatrix, camera.fieldOfView, aspect,
        camera.zNear, camera.zFar);
    });
  }

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);
    if (!gpu) { return; }

    this.updateSwapChains(gpu);
    this.updateCameras();

    this.query(WebGPUCamera, WebGPUSwapChain).forEach((entity, camera, swapChain) => {
      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 0, camera.array);

      const commandEncoder = gpu.device.createCommandEncoder({});

      const renderPassDescriptor = {
        colorAttachments: [{
          view: swapChain.context.getCurrentTexture().createView(),
          loadValue: { r: 0.0, g: 0.0, b: 0.3, a: 1.0 },
          storeOp: 'store',
        }]
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

      passEncoder.setBindGroup(0, this.frameBindGroup);

      this.query(WebGPURenderable).forEach((entity, renderable) => {
        const transform = entity.get(Transform);
        if (transform) {
          // Apply model transform
        }

        passEncoder.setPipeline(renderable.pipeline);

        for (const vb of renderable.vertexBuffers) {
          passEncoder.setVertexBuffer(vb.slot, vb.buffer, vb.offset, vb.size);
        }
        const ib = renderable.indexBuffer;
        if (ib) {
          passEncoder.setIndexBuffer(ib.buffer, ib.format, ib.offset, ib.size);
          passEncoder.drawIndexed(renderable.drawCount);
        } else {
          passEncoder.draw(renderable.drawCount);
        }
      });

      passEncoder.endPass();

      gpu.device.queue.submit([commandEncoder.finish()]);
    });
  }
}