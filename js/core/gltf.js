import { System } from 'ecs';

import { Gltf2Loader } from '../lib/gltf2-loader.js';
import { Transform, TransformPool } from './transform.js';
import { EntityGroup } from './entity-group.js';
import { Mesh, Geometry, InterleavedAttributes, AABB } from './geometry.js';
import { UnlitMaterial, PBRMaterial } from './materials.js';
import { mat4, vec3 } from 'gl-matrix';
import { Skin } from './skin.js';
import {
  LinearAnimationSampler,
  SphericalLinearAnimationSampler,
  StepAnimationSampler,
  AnimationChannel,
  Animation
} from './animation.js';

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

class GltfClient {
  constructor(gpu) {
    this.gpu = gpu;
  }

  preprocessJson(json) {
    // Allocate storage for all the node transforms ahead of time.
    json.transformPool = new TransformPool(json.nodes.length);
    for (let i = 0; i < json.nodes.length; ++i) {
      json.nodes[i].transform = json.transformPool.getTransform(i);
    }
    return json;
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

  createInverseBindMatrixBuffer(bufferView) {
    const typedArray = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
    return this.gpu.createStaticBuffer(typedArray, 'joint');
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
      } else if (Math.abs(accessor.byteOffset - attribBuffer.minOffset) > 2048) {
        // In some cases the buffer used will be the same but the data won't actually be interleaved.
        // (ie: The attributes are placed in sequential blocks in the same buffer.) In case that
        // happens, defined it as if it were a separate buffer to avoid WebGPU limits on maximum
        // attribute offsets.
        attribBuffer = new InterleavedAttributes(accessor.clientVertexBuffer, accessor.bufferView.byteStride);
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

    return {
      geometry: new Geometry(geometryDescriptor),
      material: primitive.material,
      aabb
    };
  }

  createMesh(mesh) {
    return new Mesh(...mesh.primitives);
  }

  createAnimationChannel(channel) {
    let path;
    switch(channel.target.path) {
      case 'translation': path = 'position'; break;
      case 'rotation': path = 'orientation'; break;
      case 'scale': path = 'scale'; break;
      default: return null; // morph targets aren't supported.
    }

    let samplerType;
    switch(channel.sampler.interpolation) {
      case 'STEP': samplerType = StepAnimationSampler; break;
      case 'CUBICSPLINE ': // TODO
      case 'LINEAR': {
        if (channel.target.path == 'rotation') {
          samplerType = SphericalLinearAnimationSampler; break;
        } else {
          samplerType = LinearAnimationSampler; break;
        }
      }
      default: return null;
    }
    const sampler = new samplerType(
      channel.sampler.input.typedArray,
      channel.sampler.output.typedArray,
      channel.sampler.output.componentCount
    );

    return new AnimationChannel(channel.target.node, path, sampler);
  }

  createAnimation(animation) {
    return new Animation(animation.name, animation.channels);
  }

  createNode(node, index) {
    node.index = index;

    if (node.matrix) {
      node.transform.matrix = node.matrix;
    } else {
      if (node.translation) { node.transform.position = node.translation; }
      if (node.rotation) { node.transform.orientation = node.rotation; }
      if (node.scale) { node.transform.scale = node.scale; }
    }

    if (node.mesh) {
      node.aabb = new AABB();
      let aabbInitialized = false;

      for (const primitive of node.mesh.primitives) {
        if (aabbInitialized) {
          vec3.min(node.aabb.min, node.aabb.min, primitive.aabb.min);
          vec3.max(node.aabb.max, node.aabb.max, primitive.aabb.max);
        } else {
          vec3.copy(node.aabb.min, primitive.aabb.min);
          vec3.copy(node.aabb.max, primitive.aabb.max);
          aabbInitialized = true;
        }
      }
    }

    return node;
  }

  preprocessResult(result, json) {
    result.transformPool = json.transformPool;
    return result;
  }
}

export class GltfScene {
  scene;
  nodes;
  nodeTransforms;
  animations;
  aabb;

  #createNodeInstance(nodeIndex, world, transforms, group) {
    const node = this.nodes[nodeIndex];
    const transform = transforms.getTransform(nodeIndex);
    
    if (node.mesh) {
      const nodeEntity = world.create(transform, node.mesh, node.aabb);
      nodeEntity.name = node.name;
      group.entities.push(nodeEntity);

      if (node.skin) {
        const joints = [];
        for (const jointIndex of node.skin.joints) {
          joints.push(transforms.getTransform(jointIndex));
        }
        nodeEntity.add(new Skin({
          joints,
          inverseBindMatrixBuffer: node.skin.inverseBindMatrices.clientInverseBindMatrixBuffer,
          inverseBindMatrixOffset: node.skin.inverseBindMatrices.byteOffset
        }));
      }
    }

    if (node.children) {
      for (const child of node.children) {
        transform.addChild(transforms.getTransform(child))
        this.#createNodeInstance(child, world, transforms, group);
      }
    }
  }

  createInstance(world) {
    const group = new EntityGroup();
    const instanceTransforms = this.nodeTransforms.clone();
    const sceneTransform = new Transform();
    for (const nodeIndex of this.scene.nodes) {
      this.#createNodeInstance(nodeIndex, world, instanceTransforms, group);
      sceneTransform.addChild(instanceTransforms.getTransform(nodeIndex));
    }

    const entity = world.create(sceneTransform, instanceTransforms, this.aabb, group);
    if (this.animations.length) {
      entity.add(this.animations[39]);
    }

    return entity;
  }
}

export class GltfLoader {
  #loader;

  constructor(gpu) {
    this.#loader = new Gltf2Loader(new GltfClient(gpu));
  }

  fromUrl(url) {
    return this.#loader.loadFromUrl(url).then(result => {
      const gltfScene = new GltfScene();
      gltfScene.scene = result.scene;
      gltfScene.nodes = result.nodes;
      gltfScene.nodeTransforms = result.transformPool;
      gltfScene.animations = result.animations;

      // Generate a bounding box for the entire scene.
      gltfScene.aabb = new AABB();
      let aabbInitialized = false;

      for (const node of result.nodes) {
        if (!node.aabb) { continue; }

        // TODO: Take into account geometry transforms.
        if (aabbInitialized) {
          vec3.min(gltfScene.aabb.min, gltfScene.aabb.min, node.aabb.min);
          vec3.max(gltfScene.aabb.max, gltfScene.aabb.max, node.aabb.max);
        } else {
          vec3.copy(gltfScene.aabb.min, node.aabb.min);
          vec3.copy(gltfScene.aabb.max, node.aabb.max);
          aabbInitialized = true;
        }
      }

      return gltfScene;
    });
  }

  async instanceFromUrl(world, url) {
    const scene = await this.fromUrl(url);
    return scene.createInstance(world);
  }
}