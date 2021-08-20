import { System } from 'ecs';

import { Gltf2Loader } from '../gltf2-loader.js';
import { Transform, TransformPool } from './transform.js';
import { EntityGroup } from './entity-group.js';
import { Geometry, InterleavedAttributes, AABB } from './geometry.js';
import { UnlitMaterial, PBRMaterial } from './materials.js';
import { vec3 } from 'gl-matrix';

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
  #loadedPromise;
  #resolver;

  constructor(src) {
    this.src = src;
    this.#loadedPromise = new Promise((resolve) => {
      this.#resolver = resolve;
    });
  }

  setLoadedPromise(promise) {
    this.#resolver(promise);
  }

  get loaded() {
    return this.#loadedPromise;
  }
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
    const aabb = new AABB();
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

      if (name == "POSITION") {
        vec3.copy(aabb.min, accessor.min);
        vec3.copy(aabb.max, accessor.max);
      }
    }

    const geometryDescriptor = {
      drawCount: primitive.indices?.count || drawCount,
      attributes: attribBuffers.values(),
    };

    switch (primitive.mode) {
      case GL.TRIANGLES:
        geometryDescriptor.topology = 'triangle-list'; break;
      case GL.TRIANGLE_STRIP:
        geometryDescriptor.topology = 'triangle-strip'; break;
      case GL.LINES:
        geometryDescriptor.topology = 'line-list'; break;
      case GL.LINE_STRIP:
        geometryDescriptor.topology = 'line-strip'; break;
      case GL.POINTS:
        geometryDescriptor.topology = 'point-list'; break;
    }

    if (primitive.indices) {
      geometryDescriptor.indices = {
        buffer: primitive.indices.clientIndexBuffer,
        offset: primitive.indices.byteOffset,
      };
      switch (primitive.indices.componentType) {
        case GL.UNSIGNED_SHORT:
          geometryDescriptor.indices.format = 'uint16'; break;
        case GL.UNSIGNED_INT:
          geometryDescriptor.indices.format = 'uint32'; break;
      }
    }

    /*return {
      geometry: new Geometry(geometryDescriptor),
      material: primitive.material,
      aabb
    };*/

    const entity = this.gpu.create(geometry, primitive.material, aabb);
    // Don't enable the entities till loading is complete. Prevents popping artifacts.
    entity.enabled = false;
    return entity;
  }

  createSkin(skin) {
    // Make sure that the transforms for each joint use sequential storage for their world matrices.
    skin.jointPool = new TransformPool(skin.joints.length);
    for (let i = 0; i < skin.joints.length; ++i) {
      const joint = skin.joints[i];
      skin.jointPool.setTransformAtIndex(i, joint.transform);
    }

    // TODO: What else needs to happen here?
    // InverseBindMatrix extraction at least.

    return skin;
  }

  createNode(node) {
    if (node.matrix) {
      node.transform = new Transform({ matrix: node.matrix });
    } else {
      node.transform = new Transform({
        position: node.translation,
        orientation: node.rotation,
        scale: node.scale
      });
    }

    if (node.mesh) {
      for (const primitiveEntity of node.mesh.primitives) {
        primitiveEntity.add(node.transform);
      }
    }

    for (const child of node.children) {
      node.transform.addChild(child.transform);
    }

    return node;
  }
}

export class GltfSystem extends System {
  init(gpu) {
    this.loader = new Gltf2Loader(new GltfClient(gpu));
  }

  addNodeToGroup(node, group) {
    if (node.mesh) {
      for (const primitiveEntity of node.mesh.primitives) {
        group.entities.push(primitiveEntity);
        primitiveEntity.enabled = true;
      }
    }

    for (const child of node.children) {
      this.addNodeToGroup(child, group);
    }
  }

  execute(delta, time) {
    const gpu = this.world;

    this.query(GltfScene).not(EntityGroup).forEach((entity, gltf) => {
      let transform = entity.get(Transform);
      if (!transform) {
        transform = new Transform();
        entity.add(transform);
      }

      const group = new EntityGroup();
      entity.add(group);
      gltf.setLoadedPromise(this.loader.loadFromUrl(gltf.src).then(scene => {
        for (const node of scene.nodes) {
          transform.addChild(node.transform);
          this.addNodeToGroup(node, group);
        }

        // Get an AABB that encompasses the entire scene.
        const aabb = new AABB();
        let aabbInitialized = false;
        for (const entity of group.entities) {
          const entityAABB = entity.get(AABB);
          if (!entityAABB) { continue; }

          // TODO: Take into account geometry transforms.
          if (aabbInitialized) {
            vec3.min(aabb.min, aabb.min, entityAABB.min);
            vec3.max(aabb.max, aabb.max, entityAABB.max);
          } else {
            vec3.copy(aabb.min, entityAABB.min);
            vec3.copy(aabb.max, entityAABB.max);
            aabbInitialized = true;
          }
        }
        entity.add(aabb);
      }));
    });
  }
}