import { System } from 'ecs';
import { mat4 } from 'gl-matrix';
import { WebGPUTextureLoader } from 'webgpu-texture-loader';

import { Gltf2Loader } from '../gltf2-loader.js';
import { Transform } from '../core/transform.js';
import { WebGPURenderGeometry } from './webgpu-geometry.js';

import { Geometry, Attribute, InterleavedAttributes } from '../core/geometry.js';
import { WebGPUStaticBuffer  } from './webgpu-buffer.js';


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

  createVertexBuffer(bufferView) {
    const typedArray = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
    return this.gpu.createStaticBuffer(typedArray, 'vertex');
  }

  createIndexBuffer(bufferView) {
    const typedArray = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
    return this.gpu.createStaticBuffer(typedArray, 'index');
  }

  createPrimitive(primitive) {
    let drawCount = 0;
    const attribBuffers = new Map();
    for (const name in primitive.attributes) {
      const accessor = primitive.attributes[name];
      let attribBuffer = attribBuffers.get(accessor.bufferViewIndex);
      if (!attribBuffer) {
        attribBuffer = new InterleavedAttributes(accessor.clientVertexBuffer, accessor.bufferView.byteStride);
        attribBuffers.set(accessor.bufferViewIndex, attribBuffer);
        drawCount = accessor.count;
      }

      // TODO: Better handle attib name, format
      if (accessor.byteOffset % 4 != 0) { throw new Error('Bork!'); }
      attribBuffer.addAttribute(name.toLowerCase(), accessor.byteOffset);
    }

    const geometry = new Geometry(primitive.indices?.count || drawCount, ...attribBuffers.values());

    switch (primitive.mode) {
      case GL.TRIANGLES:
        geometry.topology = 'triangle-list'; break;
      case GL.TRIANGLE_STRIP:
        geometry.topology = 'triangle-strip'; break;
      case GL.LINES:
        geometry.topology = 'line-list'; break;
      case GL.LINE_STRIP:
        geometry.topology = 'line-strip'; break;
      case GL.POINTS:
        geometry.topology = 'point-list'; break;
    }

    if (primitive.indices) {
      geometry.indices = primitive.indices.clientIndexBuffer;
      switch (primitive.indices.componentType) {
        case GL.UNSIGNED_SHORT:
          geometry.indexFormat = 'uint16'; break;
        case GL.UNSIGNED_INT:
          geometry.indexFormat = 'uint32'; break;
      }
    }

    return geometry;
  }
}

export class WebGPUGltfSystem extends System {
  init(gpu) {
    this.loader = new Gltf2Loader(new WebGPUGltf2Client(gpu));
  }

  processNode(gpu, node) {
    if (node.mesh) {
      for (const primitive of node.mesh.primitives) {
        const transform = new Transform();
        transform.matrix = node.worldMatrix;
        const nodeEntity = this.world.create(primitive, transform);
      }
    }

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