import { System } from 'ecs';
import { mat4 } from 'gl-matrix';
import { WebGPUTextureLoader } from 'webgpu-texture-loader';

import { Gltf2Loader } from '../gltf2-loader.js';
import { Transform } from '../core/transform.js';
import { WebGPURenderGeometry } from './webgpu-geometry.js';

// Used for comparing values from glTF files, which uses WebGL enums natively.
const GL = WebGLRenderingContext;

const IDENTITY_MATRIX = mat4.create();

export class GltfScene {
  src = '';

  constructor(src) {
    this.src = src;
  }
}

export class WebGPUGltfScene {
  scene = null;
}

export class WebGPUGltf2Client {
  constructor(gpu) {
    this.gpu = gpu;
    this.device = gpu.device;
    this.textureLoader = new WebGPUTextureLoader(gpu.device);
  }

  createSampler(sampler) {
    const descriptor = {};

    if (!sampler.magFilter || sampler.magFilter == GL.LINEAR) {
      descriptor.magFilter = 'linear';
    }

    switch (sampler.minFilter) {
      case undefined:
        descriptor.minFilter = 'linear';
        descriptor.mipmapFilter = 'linear';
        break;
      case GL.LINEAR:
      case GL.LINEAR_MIPMAP_NEAREST:
        descriptor.minFilter = 'linear';
        break;
      case GL.NEAREST_MIPMAP_LINEAR:
        descriptor.mipmapFilter = 'linear';
        break;
      case GL.LINEAR_MIPMAP_LINEAR:
        descriptor.minFilter = 'linear';
        descriptor.mipmapFilter = 'linear';
        break;
    }

    switch (sampler.wrapS) {
      case GL.REPEAT:
        descriptor.addressModeU = 'repeat';
        break;
      case GL.MIRRORED_REPEAT:
        descriptor.addressModeU = 'mirror-repeat';
        break;
    }

    switch (sampler.wrapT) {
      case GL.REPEAT:
        descriptor.addressModeV = 'repeat';
        break;
      case GL.MIRRORED_REPEAT:
        descriptor.addressModeV = 'mirror-repeat';
        break;
    }

    return this.device.createSampler(descriptor);
  }

  async createImage(image) {
    const result = await this.textureLoader.fromBlob(image.blob, {colorSpace: image.colorSpace});
    return result.texture.createView();
  }

  createBuffer(bufferView, usage) {
    const alignedLength = Math.ceil(bufferView.byteLength / 4) * 4;
    const gpuBuffer = this.device.createBuffer({
      size: alignedLength,
      usage: usage,
      mappedAtCreation: true
    });
    const mappedArray = new Uint8Array(gpuBuffer.getMappedRange());
    mappedArray.set(new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength));
    gpuBuffer.unmap();
    return gpuBuffer;
  }

  createVertexBuffer(bufferView) {
    return this.createBuffer(bufferView, GPUBufferUsage.VERTEX);
  }

  createIndexBuffer(bufferView) {
    return this.createBuffer(bufferView, GPUBufferUsage.INDEX);
  }

  createPrimitive(primitive) {
    const gpuGeometry = new WebGPURenderGeometry(this.gpu);
    gpuGeometry.drawCount
    
    let i = 0;
    for (const name in primitive.attributes) {
      const accessor = primitive.attributes[name];
      gpuGeometry.vertexBuffers.push({
        slot: i++,
        buffer: accessor.vertexBuffer,
        offset: 0,
      });

      primitive.attributes[name] = accessor;
    }

    return gpuGeometry;
  }
}

export class WebGPUGltfSystem extends System {
  init(gpu) {
    this.loader = new Gltf2Loader(new WebGPUGltf2Client(gpu));
  }

  processNode(gpu, node) {
    const transform = new Transform();
    transform.matrix = node.worldMatrix;

    //const gpuGeometry = new WebGPURenderGeometry(gpu);

    const nodeEntity = this.world.create(transform);

    for (const child of node.children) {
      this.processNode(gpu, child);
    }
  }

  execute(delta, time) {
    const gpu = this.world;

    this.query(GltfScene).not(WebGPUGltfScene).forEach((entity, gltf) => {
      const gpuGltf = new WebGPUGltfScene();
      this.loader.loadFromUrl(gltf.src).then(scene => {
        gpuGltf.scene = scene;

        for (const node of scene.nodes) {
          this.processNode(gpu, node);
        }
      });
      entity.add(gpuGltf);
    });
  }
}