import { System } from 'ecs';

import { Gltf2Loader } from '../gltf2-loader.js';
import { Transform } from './transform.js';
import { EntityGroup } from './entity-group.js';
import { Geometry, InterleavedAttributes } from './geometry.js';
import { UnlitMaterial, PBRMaterial } from './materials.js';

// Used for comparing values from glTF files, which uses WebGL enums natively.
const GL = WebGLRenderingContext;

const AttribMap = {
  POSITION: 'position',
  NORMAL: 'normal',
  TANGENT: 'tangent',
  TEXCOORD_0: 'texcoord',
  TEXCOORD_1: 'texcoord2',
  COLOR_0: 'color',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
};

export class GltfScene {
  src = '';

  constructor(src) {
    this.src = src;
  }
}

export class GltfRenderScene {
  scene = null;
}

class GltfClient {
  constructor(gpu) {
    this.gpu = gpu;
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

    return this.gpu.device.createSampler(descriptor);
  }

  async createImage(image) {
    const result = await this.gpu.textureLoader.fromBlob(image.blob, {colorSpace: image.colorSpace});
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

  createMaterial(material) {
    let out;
    if (material.extensions?.KHR_materials_unlit) {
      out = new UnlitMaterial();
    } else {
      out = new PBRMaterial();
      out.metallicRoughnessTexture = material.pbrMetallicRoughness.metallicRoughnessTexture?.texture.image;
      out.metallicRoughnessSampler = material.pbrMetallicRoughness.metallicRoughnessTexture?.texture.sampler;
      out.metallicFactor = material.pbrMetallicRoughness.metallicFactor;
      out.roughnessFactor = material.pbrMetallicRoughness.roughnessFactor;
      out.normalTexture = material.normalTexture?.texture.image;
      out.normalSampler = material.normalTexture?.texture.sampler;
      out.occlusionTexture = material.occlusionTexture?.texture.image;
      out.occlusionSampler = material.occlusionTexture?.texture.sampler;
      out.occlusionStrength = material.occlusionTexture?.strength || 1.0;
      out.emissiveTexture = material.emissiveTexture?.texture.image;
      out.emissiveSampler = material.emissiveTexture?.texture.sampler;
      out.emissiveFactor = material.emissiveFactor;
    }

    // Common fields between unlit and PBR materials
    out.baseColorFactor = material.pbrMetallicRoughness.baseColorFactor;
    out.baseColorTexture = material.pbrMetallicRoughness.baseColorTexture?.texture.image;
    out.baseColorSampler = material.pbrMetallicRoughness.baseColorTexture?.texture.sampler;
    out.doubleSided = material.doubleSided;
    switch (material.alphaMode) {
      case 'BLEND':
        out.transparent = true;
        out.alphaCutoff = 0.05;
        break;
      case 'MASK':
        out.alphaCutoff = material.alphaCutoff;
        break;
    }

    return out;
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

      attribBuffer.addAttribute(AttribMap[name], accessor.byteOffset, accessor.gpuFormat);
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
      geometry.indexOffset = primitive.indices.byteOffset;
      switch (primitive.indices.componentType) {
        case GL.UNSIGNED_SHORT:
          geometry.indexFormat = 'uint16'; break;
        case GL.UNSIGNED_INT:
          geometry.indexFormat = 'uint32'; break;
      }
    }

    const entity = this.gpu.create(geometry, primitive.material);
    // Don't enable the entities till loading is complete. Prevents popping artifacts.
    entity.enabled = false;
    return entity;
  }
}

export class GltfSystem extends System {
  init(gpu) {
    this.loader = new Gltf2Loader(new GltfClient(gpu));
  }

  processNode(gpu, node, group) {
    const transform = new Transform(node.translation, node.rotation, node.scale);
    if (node.matrix) {
      transform.matrix = node.matrix;
    }

    if (node.mesh) {
      for (const primitiveEntity of node.mesh.primitives) {
        primitiveEntity.add(transform);
        primitiveEntity.enabled = true;
      }
      group.entities.push(...node.mesh.primitives);
    }

    for (const child of node.children) {
      transform.addChild(this.processNode(gpu, child, group));
    }

    return transform;
  }

  execute(delta, time) {
    const gpu = this.world;

    this.query(GltfScene).not(GltfRenderScene).forEach((entity, gltf) => {
      let transform = entity.get(Transform);
      if (!transform) {
        transform = new Transform();
        entity.add(transform);
      }

      const gpuGltf = new GltfRenderScene();
      const group = new EntityGroup();
      this.loader.loadFromUrl(gltf.src).then(scene => {
        gpuGltf.scene = scene;

        for (const node of scene.nodes) {
          transform.addChild(this.processNode(gpu, node, group));
        }
      });
      entity.add(gpuGltf, group);
    });
  }
}