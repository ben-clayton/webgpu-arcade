import { vec2, vec3, vec4, mat4 } from 'gl-matrix';

// Used for comparing values from glTF files, which uses WebGL enums natively.
const GL = WebGLRenderingContext;

const GLB_MAGIC = 0x46546C67;
const CHUNK_TYPE = {
  JSON: 0x4E4F534A,
  BIN: 0x004E4942,
};
const DEFAULT_TRANSLATION = vec3.fromValues(0, 0, 0);
const DEFAULT_ROTATION = vec4.fromValues(0, 0, 0, 1);
const DEFAULT_SCALE = vec3.fromValues(1, 1, 1);
const DEFAULT_BASE_COLOR_FACTOR = vec4.fromValues(1, 1, 1, 1);
const DEFAULT_EMISSIVE_FACTOR = vec3.fromValues(0, 0, 0);

const absUriRegEx = new RegExp(`^${window.location.protocol}`, 'i');
const dataUriRegEx = /^data:/;
function resolveUri(uri, baseUrl) {
  if (!!uri.match(absUriRegEx) || !!uri.match(dataUriRegEx)) {
      return uri;
  }
  return baseUrl + uri;
}

function getComponentCount(type) {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    default: return 0;
  }
}

function getComponentTypeSize(componentType) {
  switch (componentType) {
    case GL.BYTE: return 1;
    case GL.UNSIGNED_BYTE: return 1;
    case GL.SHORT: return 2;
    case GL.UNSIGNED_SHORT: return 2;
    case GL.UNSIGNED_INT: return 4;
    case GL.FLOAT: return 4;
    default: return 0;
  }
}

// The client is an object that will receive callbacks as each element of
// the glTF file is loaded. It can extend this class if that's convenient, but
// doesn't have to. It just needs to provide the same methods. Could even be a
// dictionary of functions, if you'd like!
export class Gltf2Client {
  createSampler(sampler) {
    return sampler;
  }

  async createImage(image, blob, colorSpace) {
    return { image, blob, colorSpace };
  }

  async createTexture(texture, clientImage, clientSampler) {
    return { texture, clientImage, clientSampler }
  }

  async createMaterial(material) {
    return material;
  }

  async createVertexBuffer(bufferView) {
    return bufferView;
  }

  async createIndexBuffer(bufferView) {
    return bufferView;
  }

  async createPrimitive(primitive) {

  }

  createLight(type, color, intensity, range) {
    return { type, color, intensity, range };
  }
}

const DEFAULT_SAMPLER = {
  wrapS: GL.REPEAT,
  wrapT: GL.REPEAT
};

const DEFAULT_METALLIC_ROUGHNESS = {
  baseColorFactor: [1,1,1,1],
  metallicFactor: 1.0,
  roughnessFactor: 1.0,
};

const DEFAULT_MATERIAL = {
  pbrMetallicRoughness: DEFAULT_METALLIC_ROUGHNESS,
  emissiveFactor:	[0,0,0],
  alphaMode: "OPAQUE",
  alphaCutoff: 0.5,
  doubleSided: false,
};

/**
 * Gltf2Loader
 * Loads glTF 2.0 scenes into a more gpu-ready structure.
 */

export class Gltf2Loader {
  #client;
  constructor(client) {
    this.#client = client;
  }

  async loadFromUrl(url) {
    const i = url.lastIndexOf('/');
    const baseUrl = (i !== 0) ? url.substring(0, i + 1) : '';
    const response = await fetch(url);

    if (url.endsWith('.gltf')) {
      return this.loadFromJson(await response.json(), baseUrl);
    } else if (url.endsWith('.glb')) {
      return this.loadFromBinary(await response.arrayBuffer(), baseUrl);
    } else {
      throw new Error('Unrecognized file extension');
    }
  }

  loadFromBinary(arrayBuffer, baseUrl) {
    const headerView = new DataView(arrayBuffer, 0, 12);
    const magic = headerView.getUint32(0, true);
    const version = headerView.getUint32(4, true);
    const length = headerView.getUint32(8, true);

    if (magic != GLB_MAGIC) {
      throw new Error('Invalid magic string in binary header.');
    }

    if (version != 2) {
      throw new Error('Incompatible version in binary header.');
    }

    let chunks = {};
    let chunkOffset = 12;
    while (chunkOffset < length) {
      const chunkHeaderView = new DataView(arrayBuffer, chunkOffset, 8);
      const chunkLength = chunkHeaderView.getUint32(0, true);
      const chunkType = chunkHeaderView.getUint32(4, true);
      chunks[chunkType] = arrayBuffer.slice(chunkOffset + 8, chunkOffset + 8 + chunkLength);
      chunkOffset += chunkLength + 8;
    }

    if (!chunks[CHUNK_TYPE.JSON]) {
      throw new Error('File contained no json chunk.');
    }

    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(chunks[CHUNK_TYPE.JSON]);
    const json = JSON.parse(jsonString);
    return this.loadFromJson(json, baseUrl, chunks[CHUNK_TYPE.BIN]);
  }

  async loadFromJson(json, baseUrl, binaryChunk) {
    if (!json.asset) {
      throw new Error('Missing asset description.');
    }

    if (json.asset.minVersion != '2.0' && json.asset.version != '2.0') {
      throw new Error('Incompatible asset version.');
    }

    // TODO: Check extensions against supported set.

    const gltf = new Gltf2();
    const client = this.#client;
    const resourcePromises = [];

    // Buffers
    const clientBuffers = [];
    if (binaryChunk) {
      clientBuffers.push(Promise.resolve(binaryChunk));
    }
    async function resolveBuffer(index) {
      let clientBuffer = clientBuffers[index];
      if (!clientBuffer) {
        const buffer = json.buffers[index];
        const uri = resolveUri(buffer.uri, baseUrl);
        clientBuffer = fetch(uri).then(response => response.arrayBuffer());
        clientBuffers[index] = clientBuffer;
      }
      return clientBuffer;
    }

    // Buffer Views
    const clientBufferViews = [];
    async function resolveBufferView(index) {
      let clientBufferView = clientBufferViews[index];
      if (!clientBufferView) {
        const bufferView = json.bufferViews[index];
        clientBufferView = resolveBuffer(bufferView.buffer).then(buffer => {
          const result = Object.assign({}, bufferView);
          result.buffer = buffer;
          result.view = new Uint8Array(buffer, bufferView.byteOffset, bufferView.byteLength);
        });
        clientBufferViews[index] = clientBufferView;
      }
      return bufferView;
    }

    // Images
    const clientImages = [];
    async function resolveImage(index, colorSpace) {
      let clientImage = clientImages[index];
      if (!clientImage) {
        const image = json.images[index];
        if (image.uri) {
          clientImage = fetch(resolveUri(image.uri, baseUrl)).then(async (response) => {
            return client.createImage(image, await response.blob(), colorSpace);
          });
        } else {
          clientImage = resolveBufferView(image.bufferView).then(bufferView => {
            return client.createImage(image, new Blob([bufferView.view], {type: image.mimeType}), colorSpace);
          });
        }
        clientImage[index] = clientImage;
      }
      return clientImage;
    }

    // Samplers
    let defaultSampler = null;
    const clientSamplers = [];
    function resolveSampler(index) {
      if (index === undefined) {
        if (!defaultSampler) {
          defaultSampler = client.createSampler(DEFAULT_SAMPLER);
        }
        return defaultSampler;
      }

      let clientSampler = clientSamplers[index];
      if (!clientSampler) {
        // Resolve any sampler defaults 
        const sampler = Object.assign({}, DEFAULT_SAMPLER, json.samplers[index]);
        clientSampler = client.createSampler(sampler);
        clientSamplers[index] = clientSampler;
      }
      return clientSampler;
    }

    // Textures
    const clientTextures = [];
    async function resolveTexture(index, colorSpace = 'linear') {
      let clientTexture = clientTextures[index];
      if (!clientTexture) {
        const texture = json.textures[index];
        const clientSampler = resolveSampler(texture.sampler);
        let source = texture.source;
        if (texture.extensions && texture.extensions.KHR_texture_basisu) {
          source = texture.extensions.KHR_texture_basisu.source;
        }
        clientTexture = resolveImage(source, colorSpace).then((clientImage) => {
          return client.createTexture(texture, clientImage, clientSampler);
        });
        clientTextures[index] = clientTexture;
      }
      return clientTexture;
    }

    // Materials
    let defaultMaterial = null;
    const clientMaterials = [];
    async function resolveMaterial(index) {
      if (index === undefined) {
        if (!defaultMaterial) {
          defaultMaterial = client.createMaterial(DEFAULT_MATERIAL);
        }
        return defaultMaterial;
      }

      let clientMaterial = clientMaterials[index];
      if (!clientMaterial) {
        const material = Object.assign({}, DEFAULT_MATERIAL, json.materials[index]);
        Object.assign(material.pbrMetallicRoughness, DEFAULT_METALLIC_ROUGHNESS, json.materials[index].pbrMetallicRoughness);

        const texturePromises = [];
        const pbr = material.pbrMetallicRoughness;
        if (pbr.baseColorTexture) {
          texturePromises.push(
            resolveTexture(pbr.baseColorTexture.index, 'sRGB').then(texture => {
              pbr.baseColorTexture.texture = texture;
            }));
        }
        if (pbr.metallicRoughnessTexture) {
          texturePromises.push(
            resolveTexture(pbr.metallicRoughnessTexture.index).then(texture => {
              pbr.metallicRoughnessTexture.texture = texture;
            }));
        }
        if (material.normalTexture) {
          texturePromises.push(
            resolveTexture(material.normalTexture.index).then(texture => {
              material.normalTexture.texture = texture;
            }));
        }
        if (material.occlusionTexture) {
          texturePromises.push(
            resolveTexture(material.occlusionTexture.index).then(texture => {
              material.occlusionTexture.texture = texture;
            }));
        }
        if (material.emissiveTexture) {
          texturePromises.push(
            resolveTexture(material.emissiveTexture.index, 'sRGB').then(texture => {
              material.emissiveTexture.texture = texture;
            }));
        }

        clientMaterial = Promise.all(texturePromises).then(() => {
          return client.createMaterial(material);
        });
        clientMaterials[index] = clientMaterial;
      }
      return clientMaterial;
    }

    const accessors = json.accessors;

    const clientVertexBuffers = [];
    async function resolveVertexBuffer(index) {
      let clientVertexBuffer = clientVertexBuffers[index];
      if (!clientVertexBuffer) {
        clientVertexBuffer = resolveBufferView(index).then(bufferView => {
          return client.createVertexBuffer(bufferView);
        });
        clientVertexBuffers[index] = clientVertexBuffer;
      }
      return clientVertexBuffer;
    }

    const clientIndexBuffers = [];
    async function resolveIndexBuffer(index) {
      let clientIndexBuffer = clientIndexBuffers[index];
      if (!clientIndexBuffer) {
        clientIndexBuffer = resolveBufferView(index).then(bufferView => {
          return client.createIndexBuffer(bufferView);
        });
        clientIndexBuffers[index] = clientIndexBuffer;
      }
      return clientVertexBuffer;
    }

    // Meshes
    const meshes = [];
    for (let mesh of json.meshes) {
      let primitives = []; // A mesh in glTF is just an array of primitives
      meshes.push(primitives);

      for (const primitive of mesh.primitives) {
        const material = resolveMaterial(primitive.material);
        
        let elementCount = 0;

        const attributeBuffers = new Map();
        for (const name in primitive.attributes) {
          const accessor = accessors[primitive.attributes[name]];
          elementCount = accessor.count;

          // TODO: Handle accessors with no bufferView (initialized to 0);
          const vertexBuffer = resolveVertexBuffer(accessor.bufferView);

          const bufferView = gltf.bufferViews[accessor.bufferView];
          bufferView.usage.add('vertex');

          let bufferAttributes = attributeBuffers.get(bufferView);
          if (!bufferAttributes) {
            bufferAttributes = new PrimitiveBufferAttributes(bufferView);
            attributeBuffers.set(bufferView, bufferAttributes);
          }

          bufferAttributes.addAttribute(name, new PrimitiveAttribute(
            getComponentCount(accessor.type),
            accessor.componentType,
            accessor.byteOffset,
            accessor.normalized
          ));
        }

        let indices;
        if ('indices' in primitive) {
          const accessor = accessors[primitive.indices];
          elementCount = accessor.count;

          // TODO: Don't create multiple identical buffers
          const indexBuffer = resolveIndexBuffer(accessor.bufferView);

          indices = new PrimitiveIndices(
            indexBuffer,
            accessor.byteOffset,
            accessor.componentType
          );
        }

        primitives.push(new Primitive(
          attributeBuffers,
          indices,
          elementCount,
          primitive.mode,
          material
        ));
      }

      gltf.primitives.push(...primitives);
    }

    // Extensions

    // Lights
    const KHR_lights_punctual = json.extensions?.KHR_lights_punctual;
    if (KHR_lights_punctual) {
      for (const light of KHR_lights_punctual.lights) {
        // Blender export has issues. Still not sure how to fix it:
        // https://github.com/KhronosGroup/glTF-Blender-IO/issues/564
        gltf.lights.push(this.#client.createLight(
          light.type,
          light.color,
          light.intensity, //(light.intensity) / (4 * Math.PI),
          light.range
        ));
      }
    }

    function processNode(node, worldMatrix) {
      const glNode = new Node();
      glNode.name = node.name;

      if ('mesh' in node) {
        glNode.primitives.push(...meshes[node.mesh]);
      }

      if (glNode.matrix) {
        glNode.localMatrix = mat4.clone(node.matrix);
      } else if (node.translation || node.rotation || node.scale) {
        glNode.localMatrix = mat4.create();
        mat4.fromRotationTranslationScale(
          glNode.localMatrix,
          node.rotation || DEFAULT_ROTATION,
          node.translation || DEFAULT_TRANSLATION,
          node.scale || DEFAULT_SCALE);
      }

      if (glNode.localMatrix) {
        mat4.mul(glNode.worldMatrix, worldMatrix, glNode.localMatrix);
      } else {
        mat4.copy(glNode.worldMatrix, worldMatrix);
      }

      if (node.extensions?.KHR_lights_punctual) {
        node.light = gltf.lights[node.extensions.KHR_lights_punctual.light];
        //vec3.transformMat4(node.light.position, node.light.position, glNode.worldMatrix);
      }

      if (node.children) {
        for (const nodeId of node.children) {
          glNode.children.push(processNode(json.nodes[nodeId], glNode.worldMatrix));
        }
      }

      return glNode;
    }

    const scene = json.scenes[json.scene];
    for (const nodeId of scene.nodes) {
      gltf.scene.children.push(processNode(json.nodes[nodeId], gltf.scene.worldMatrix));
    }

    await Promise.all(resourcePromises);

    return gltf;
  }
}

class Gltf2 {
  constructor() {
    this.buffers = [];
    this.bufferViews = [];
    this.images = [];
    this.samplers = [];
    this.textures = [];
    this.materials = [];
    this.primitives = [];
    this.lights = [];
    this.scene = new Node();
  }
}

class Node {
  constructor() {
    this.name = null;
    this.children = [];
    this.primitives = [];
    this.worldMatrix = mat4.create();
    // null is treated as an identity matrix
    this.localMatrix = null;
    this.light = null;
  }
}

class PrimitiveBufferAttributes {
  constructor(bufferView) {
    this.bufferView = bufferView;
    this.minAttributeByteOffset = 0;
    this.attributeCount = 0;
    this.attributes = {};
  }

  addAttribute(name, primitiveAttribute) {
    if (this.attributeCount == 0) {
      this.minAttributeByteOffset = primitiveAttribute.byteOffset;
    } else {
      this.minAttributeByteOffset = Math.min(this.minAttributeByteOffset, primitiveAttribute.byteOffset);
    }

    this.attributeCount++;
    this.attributes[name] = primitiveAttribute;
  }
}

class PrimitiveAttribute {
  constructor(componentCount, componentType, byteOffset, normalized) {
    this.componentCount = componentCount || 3;
    this.componentType = componentType || GL.FLOAT;
    this.byteOffset = byteOffset || 0;
    this.normalized = normalized || false;
  }

  get packedByteStride() {
    return getComponentTypeSize(this.componentType) * this.componentCount;
  }

  get gpuFormat() {
    const count = this.componentCount > 1 ? `x${this.componentCount}` : '';
    const intType = this.normalized ? 'norm' : 'int';
    switch(this.componentType) {
      case GL.BYTE:
        return `s${intType}8${count}`;
      case GL.UNSIGNED_BYTE:
        return `u${intType}8${count}`;
      case GL.SHORT:
        return `s${intType}16${count}`;
      case GL.UNSIGNED_SHORT:
        return `u${intType}16${count}`;
      case GL.UNSIGNED_INT:
        return `u${intType}32${count}`;
      case GL.FLOAT:
        return `float32${count}`;
    }
  }
}

class PrimitiveIndices {
  constructor(bufferView, byteOffset, type) {
    this.bufferView = bufferView;
    this.byteOffset = byteOffset || 0;
    this.type = type || GL.UNSIGNED_SHORT;
  }

  get gpuType() {
    return this.type == GL.UNSIGNED_SHORT ? 'uint16' : 'uint32';
  }
}

class Primitive {
  constructor(attributeBuffers, indices, elementCount, mode, material) {
    this.attributeBuffers = attributeBuffers; // Map<BufferView -> PrimitiveBufferAttributes>
    this.indices = indices || null;
    this.elementCount = elementCount || 0;
    this.mode = mode || GL.TRIANGLES;
    this.material = material;

    this.enabledAttributes = new Set();
    for (let bufferAttributes of attributeBuffers.values()) {
      for (let attribName in bufferAttributes.attributes) {
        this.enabledAttributes.add(attribName);
      }
    }

    // For renderer-specific data;
    this.renderData = {};
  }

  getPartialRenderPipelineDescriptor(attributeMap) {
    const primitive = {
      topology: this.gpuPrimitiveTopology,
      cullMode: this.material.cullFace ? 'back' : 'none',
    };

    if (this.mode == GL.TRIANGLE_STRIP || this.mode == GL.LINE_STRIP) {
      primitive.stripIndexFormat = this.indices.gpuType;
    }

    return {
      vertex: {
        buffers: this.getVertexBufferLayout(attributeMap)
      },
      primitive,
    };
  }

  // Returns a GPUVertexStateDescriptor that describes the layout of the buffers for this primitive.
  getVertexBufferLayout(attributeMap) {
    const vertexBuffers = [];

    for (const [bufferView, bufferAttributes] of this.attributeBuffers) {
      const arrayStride = bufferView.byteStride;

      const attributeLayouts = [];
      for (const attribName in bufferAttributes.attributes) {
        const attribute = bufferAttributes.attributes[attribName];
        // WebGPU doesn't allow attribute offsets greater than 2048.
        // This is apparently due to a Vulkan limitation.
        const offset = attribute.byteOffset - bufferAttributes.minAttributeByteOffset;
        const format = attribute.gpuFormat;

        if (!bufferView.byteStride) {
          arrayStride += attribute.packedByteStride;
        }

        const shaderLocation = attributeMap[attribName];

        if (shaderLocation === undefined) {
          console.warn(`Attribute name has no associated shader location: ${attribName}`);
          continue;
        }

        attributeLayouts.push({
          shaderLocation,
          format,
          offset,
        });
      }

      if (attributeLayouts.length) {
        vertexBuffers.push({
          arrayStride,
          attributes: attributeLayouts,
        });
      }
    }

    return vertexBuffers;
  }

  get gpuPrimitiveTopology() {
    switch (this.mode) {
      case GL.TRIANGLES:
        return 'triangle-list';
      case GL.TRIANGLE_STRIP:
        return 'triangle-strip';
      case GL.LINES:
        return 'line-list';
      case GL.LINE_STRIP:
        return 'line-strip';
      case GL.POINTS:
        return 'point-list';
      default:
        // LINE_LOOP and TRIANGLE_FAN are unsupported.
        throw new Error('Unsupported primitive topology.');
    }
  }
}

class BufferView {
  constructor(buffer, stride = 0, offset = 0, length = null) {
    this.buffer = buffer;
    this.byteStride = stride;
    this.byteOffset = offset;
    this.byteLength = length;
    this.dataView = buffer.then(value => new DataView(value, offset, length));

    this.usage = new Set();

    // For renderer-specific data;
    this.renderData = {};
  }
}

class Light {
  constructor(type, color = [1.0, 1.0, 1.0], intensity = 1.0, range = -1) {
    this.type = type;
    this.color = color;
    this.intensity = intensity;
    this.range = range;

    this.position = vec3.create();
  }
}
