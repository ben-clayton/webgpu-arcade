import { System } from '../ecs/system.js';
import { WebGPU, WebGPUSwapConfig, WebGPULayouts,
         WebGPURenderGeometry, WebGPUPipeline } from './webgpu-components.js';
import { mat4 } from '../third-party/gl-matrix/dist/esm/index.js';

const MATRIX_SIZE_IN_BYTES = Float32Array.BYTES_PER_ELEMENT * 16;

export class WebGPURenderer extends System {
  static queries = {
    swapConfig: { components: [WebGPUSwapConfig], listen: { changed: true } },
    renderable: { components: [WebGPURenderGeometry, WebGPUPipeline] }
  };

  async init() {
    const gpu = this.modifySingleton(WebGPU);
    const swapConfig = this.modifySingleton(WebGPUSwapConfig);

    if (!gpu.canvas) {
      // Create a canvas if one is not available.
      gpu.canvas = document.createElement('canvas');
    }
    gpu.context = gpu.canvas.getContext('gpupresent');

    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      gpu.device = await adapter.requestDevice();
    }

    if (!swapConfig.format) {
      // Get the preferred swap chain format if one wasn't specified.
      swapConfig.format = gpu.context.getSwapChainPreferredFormat(gpu.device.adapter);
    }

    gpu.swapChain = gpu.context.configureSwapChain({
      device: gpu.device,
      format: swapConfig.format
    });

    swapConfig.width = gpu.canvas.offsetWidth * devicePixelRatio;
    swapConfig.height = gpu.canvas.offsetHeight * devicePixelRatio;

    this.colorAttachment = {
      attachment: undefined,
      resolveTarget: undefined,
      loadValue: {r: 1.0, g: 0.0, b: 1.0, a: 1.0},
    };
    this.depthAttachment = {
      attachment: undefined,
      depthLoadValue: 1.0,
      depthStoreOp: 'store',
      stencilLoadValue: 0,
      stencilStoreOp: 'store',
    };
    this.renderPassDescriptor = {
      colorAttachments: [this.colorAttachment],
      depthStencilAttachment: this.depthAttachment
    }

    const layouts = this.modifySingleton(WebGPULayouts);

    // Bind group layouts
    layouts.bindGroup = {
      frame: gpu.device.createBindGroupLayout({
        entries: [{
          // ProjectionUniforms
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {}
        }, {
          // ViewUniforms
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {}
        }],
      }),

      model: gpu.device.createBindGroupLayout({
        entries: [{
          // ModelUniforms
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {}
        }],
      })
    };

    this.projectionBuffer = gpu.device.createBuffer({
      size: MATRIX_SIZE_IN_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.viewBuffer = gpu.device.createBuffer({
      size: MATRIX_SIZE_IN_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.defaultModelBuffer = gpu.device.createBuffer({
      size: MATRIX_SIZE_IN_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    // Set an identity matrix for the view matrix
    const identityMatrix = mat4.create();
    gpu.device.queue.writeBuffer(this.viewBuffer, 0, identityMatrix);
    gpu.device.queue.writeBuffer(this.defaultModelBuffer, 0, identityMatrix);

    this.frameBindGroup = gpu.device.createBindGroup({
      layout: layouts.bindGroup.frame,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.projectionBuffer,
        },
      }, {
        binding: 1,
        resource: {
          buffer: this.viewBuffer,
        },
      }],
    });

    this.defaultModelBindGroup = gpu.device.createBindGroup({
      layout: layouts.bindGroup.model,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.defaultModelBuffer,
        },
      }],
    });

    this.updateRenderTargets();
  }

  checkResize(canvas) {
    // TODO: Monitor this better with events
    const canvasWidth = Math.floor(canvas.offsetWidth * devicePixelRatio);
    const canvasHeight = Math.floor(canvas.offsetWidth * devicePixelRatio);
    if (canvas.width != canvasWidth ||
        canvas.height != canvasHeight) {
      const swapConfig = this.modifySingleton(WebGPUSwapConfig);
      swapConfig.width = canvasWidth;
      swapConfig.height = canvasHeight;
      return true;
    }
    return false;
  }

  updateRenderTargets() {
    const gpu = this.readSingleton(WebGPU);
    const swapConfig = this.readSingleton(WebGPUSwapConfig);

    gpu.canvas.width = swapConfig.width;
    gpu.canvas.height = swapConfig.height;

    if (swapConfig.sampleCount > 1) {
      const msaaColorTexture = gpu.device.createTexture({
        size: { width: swapConfig.width, height: swapConfig.height },
        sampleCount: swapConfig.sampleCount,
        format: swapConfig.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.colorAttachment.attachment = msaaColorTexture.createView();
    } else {
      this.colorAttachment.resolveTarget = undefined;
    }

    const depthTexture = gpu.device.createTexture({
      size: { width: swapConfig.width, height: swapConfig.height },
      sampleCount: swapConfig.sampleCount,
      format: swapConfig.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.depthAttachment.attachment = depthTexture.createView();

    // Compute the projection matrix
    const aspect = gpu.canvas.width / gpu.canvas.height;
    // Using mat4.perspectiveZO instead of mat4.perpective because WebGPU's
    // normalized device coordinates Z range is [0, 1], instead of WebGL's [-1, 1]
    const projectionMatrix = mat4.create();
    mat4.perspectiveZO(projectionMatrix, Math.PI * 0.5, aspect, 0.01, 1024);

    // Update the projection matrix to ensure that it matches the canvas dimensions
    gpu.device.queue.writeBuffer(this.projectionBuffer, 0, projectionMatrix);
  }

  execute(delta, time) {
    const gpu = this.readSingleton(WebGPU);
    const swapConfig = this.readSingleton(WebGPUSwapConfig);
    if (!gpu.device) { return; }

    if (this.checkResize(gpu.canvas) || this.queries.swapConfig.changed.length) {
      this.updateRenderTargets();
    }

    if (swapConfig.sampleCount > 1) {
      this.colorAttachment.resolveTarget = gpu.swapChain.getCurrentTexture().createView();
    } else {
      this.colorAttachment.attachment = gpu.swapChain.getCurrentTexture().createView();
    }

    const commandEncoder = gpu.device.createCommandEncoder({});
    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    passEncoder.setBindGroup(0, this.frameBindGroup);

    this.queries.renderable.results.forEach((entity) => {
      const geometry = entity.read(WebGPURenderGeometry);
      const pipeline = entity.read(WebGPUPipeline);

      // Bind the pipeline
      passEncoder.setPipeline(pipeline.pipeline);

      // TODO: Bind materials

      passEncoder.setBindGroup(1, this.defaultModelBindGroup);

      // Bind the geometry
      for (const vb of geometry.vertexBuffers) {
        passEncoder.setVertexBuffer(vb.slot, vb.buffer, vb.offset, vb.size);
      }
      if (geometry.indexBuffer) {
        const ib = geometry.indexBuffer;
        passEncoder.setIndexBuffer(ib.buffer, ib.format, ib.offset, ib.size);
        passEncoder.drawIndexed(geometry.drawCount);
      } else {
        passEncoder.draw(geometry.drawCount);
      }
    });

    passEncoder.endPass();
    gpu.device.queue.submit([commandEncoder.finish()]);
  }
}
