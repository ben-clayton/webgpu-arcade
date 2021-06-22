import { System } from 'ecs';
import { OutputCanvas } from '../output-canvas.js';
import { Camera } from '../camera.js';
import { Transform } from '../transform.js';
import { StaticGeometry } from '../geometry.js';

import { WebGPURenderGeometry, WebGPURenderable } from './webgpu-renderable.js';
import { CubeRenderableFactory } from './cube.js';
import { GeometryLayoutCache } from './resource-cache.js';

import { mat4, vec3 } from 'gl-matrix';

export class WebGPU {
  device = null;
  format = 'bgra8unorm';
  depthFormat = 'depth24plus';
  sampleCount = 4;

  canvas = null;
  context = null;
  size = {width: 0, height: 0};

  get adapter() {
    return this.device?.adapter;
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
  async init(canvas) {
    const gpu = new WebGPU();

    if (!gpu.device) {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });

      // Determine which of the desired features can be enabled for this device.
      const requiredFeatures = desiredFeatures.filter(feature => adapter.features.has(feature));
      gpu.device = await adapter.requestDevice({requiredFeatures});
    }

    gpu.canvas = canvas || document.createElement('canvas');
    gpu.context = gpu.canvas.getContext('gpupresent');
    gpu.format = gpu.context.getPreferredFormat(gpu.adapter);

    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target != gpu.canvas) { continue; }

        if (entry.devicePixelContentBoxSize) {
          // Should give exact pixel dimensions, but only works on Chrome.
          const devicePixelSize = entry.devicePixelContentBoxSize[0];
          this.onCanvasResized(gpu, devicePixelSize.inlineSize, devicePixelSize.blockSize);
        } else if (entry.contentBoxSize) {
          // Firefox implements `contentBoxSize` as a single content rect, rather than an array
          const contentBoxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
          this.onCanvasResized(gpu, contentBoxSize.inlineSize, contentBoxSize.blockSize);
        } else {
          this.onCanvasResized(gpu, entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    this.resizeObserver.observe(gpu.canvas);

    this.colorAttachment = {
      // attachment is acquired and set in onResize.
      attachment: undefined,
      // attachment is acquired and set in onFrame.
      resolveTarget: undefined,
      loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      storeOp: gpu.sampleCount > 1 ? 'clear' : 'store',
    };

    this.depthAttachment = {
      // attachment is acquired and set in onResize.
      attachment: undefined,
      depthLoadValue: 1.0,
      depthStoreOp: 'store',
      stencilLoadValue: 0,
      stencilStoreOp: 'store',
    };

    this.renderPassDescriptor = {
      colorAttachments: [this.colorAttachment],
      depthStencilAttachment: this.depthAttachment
    };

    this.geometryLayoutCache = new GeometryLayoutCache();

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

  onCanvasResized(gpu, pixelWidth, pixelHeight) {
    gpu.size.width = pixelWidth;
    gpu.size.height = pixelHeight;
    gpu.context.configure(gpu);

    if (gpu.sampleCount > 1) {
      const msaaColorTexture = gpu.device.createTexture({
        size: gpu.size,
        sampleCount: gpu.sampleCount,
        format: gpu.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.colorAttachment.view = msaaColorTexture.createView();
    }

    if (gpu.depthFormat) {
      const depthTexture = gpu.device.createTexture({
        size: gpu.size,
        sampleCount: gpu.sampleCount,
        format: gpu.depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      this.depthAttachment.view = depthTexture.createView();
    }
  }

  updateGeometry(gpu) {
    // For any entities with StaticGeometry but no WebGPURenderable, create the WebGPU buffers for
    // the geometry, fill it from the StaticGeometry attributes, then clear the StaticGeometry's
    // attributes so the memory can be GCed if needed.
    this.query(StaticGeometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const renderGeometry = new WebGPURenderGeometry();
      //renderable.pipeline = this.pipeline;
      renderGeometry.drawCount = drawCount.drawCount;

      const [id, layout] = this.geometryLayoutCache.getFor(geometry);
      renderGeometry.layoutId = id;
      renderGeometry.layout = layout;

      let i = 0;
      for (const buffer of geometry.buffers) {
        const vertexBuffer = gpu.device.createBuffer({
          size: attrib.values.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        gpu.device.queue.writeBuffer(vertexBuffer, 0, attrib.values);
        renderGeometry.vertexBuffers.push({
          slot: i++,
          buffer: vertexBuffer,
          offset: buffer.minOffset,
        });
      }

      if (geometry.indexArray) {
        const indexBuffer = gpu.device.createBuffer({
          size: geometry.indexArray.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });
        gpu.device.queue.writeBuffer(indexBuffer, 0, geometry.indexArray);
        renderGeometry.indexBuffer = {
          buffer: indexBuffer,
          format: geometry.indexFormat
        };
      }

      // TODO: Allow StaticGeometry to GC?

      entity.add(renderGeometry);
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
      
      const aspect = gpu.size.width / gpu.size.height;
      mat4.perspectiveZO(gpuCamera.projectionMatrix, camera.fieldOfView, aspect,
        camera.zNear, camera.zFar);
    });
  }

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);
    if (!gpu) { return; }

    this.updateGeometry(gpu);
    this.updateCameras(gpu);

    // TODO: This is a little silly. How do we handle multiple cameras?
    this.query(WebGPUCamera).forEach((entity, camera) => {
      gpu.device.queue.writeBuffer(this.frameUniformBuffer, 0, camera.array);

      const commandEncoder = gpu.device.createCommandEncoder({});

      const outputTexture = gpu.context.getCurrentTexture().createView();
      if (gpu.sampleCount > 1) {
        this.colorAttachment.resolveTarget = outputTexture;
      } else {
        this.colorAttachment.view = outputTexture;
      }

      const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

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