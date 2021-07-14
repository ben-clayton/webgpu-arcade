import { vec3, vec4, mat4 } from 'gl-matrix';

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

const DEFAULT_ACCESSOR = {
  byteOffset: 0,
  normalized: false,
};

const DEFAULT_LIGHT = {
  color: [1.0, 1.0, 1.0, 1.0],
  intensity: 1.0,
};

async function IDENTITY_FUNC(value) { return value; }
const CLIENT_PROXY_HANDLER = {
  get: function(target, key) {
    return key in target ? target[key] : IDENTITY_FUNC;
  }
};

/**
 * Gltf2Node
 * Represents a node in a glTF2 scene, and resolves the nodes world matrix.
 */

class Gltf2Node {
  index;
  name;
  children;
  parent;
  mesh;
  camera;
  light;

  #dirtyWorldMatrix = true;
  #worldMatrix;

  #dirtyLocalMatrix = true;
  #localMatrix;

  constructor(index, jsonNode, children) {
    Object.assign(this, jsonNode, { index, children });
    for (const child of children) {
      child.parent = this;
    }
  }

  get worldMatrix() {
    if (this.#dirtyWorldMatrix) {
      this.#dirtyWorldMatrix = false;
      if (!this.parent) {
        return this.#localMatrix;
      }
      if (!this.#localMatrix) {
        return this.parent.worldMatrix;
      }
      if (!this.#worldMatrix) {
        this.#worldMatrix = mat4.create();
      }
      mat4.mul(this.#worldMatrix, this.parent.worldMatrix, this.localMatrix);
    }
    return this.#worldMatrix;
  }

  get localMatrix() {
    if (this.matrix) {
      this.#dirtyLocalMatrix = false;
      return this.matrix;
    }

    if (this.#dirtyLocalMatrix && (this.translation || this.rotation || this.scale)) {
      if (!this.#localMatrix) {
        this.#localMatrix = mat4.create();
      }
      mat4.fromRotationTranslationScale(
        this.#localMatrix,
        this.rotation || DEFAULT_ROTATION,
        this.translation || DEFAULT_TRANSLATION,
        this.scale || DEFAULT_SCALE);
    }
    this.#dirtyLocalMatrix = false;

    return this.#localMatrix;
  }

  dirtyMatrix() {
    this.#dirtyLocalMatrix = true;
    if (!this.#dirtyWorldMatrix) {
      this.#dirtyWorldMatrix = true;
      for (const child of this.children) {
        child.dirtyMatrix();
      }
    }
  }
}

/**
 * Gltf2Loader
 * Loads glTF 2.0 scenes into a more gpu-ready structure.
 */

export class Gltf2Loader {
  #client;
  constructor(client) {
    // Doing this allows clients to omit methods that they don't care about.
    this.#client = new Proxy(client, CLIENT_PROXY_HANDLER);
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

  async loadFromBinary(arrayBuffer, baseUrl) {
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
    return this.loadFromJson(JSON.parse(jsonString), baseUrl, chunks[CHUNK_TYPE.BIN]);
  }

  async loadFromJson(json, baseUrl, binaryChunk) {
    const client = this.#client;

    // Give the client an opportunity to inspect and modify the json if they choose.
    json = await client.preprocessJson(json);

    if (!json.asset) {
      throw new Error('Missing asset description.');
    }

    if (json.asset.minVersion != '2.0' && json.asset.version != '2.0') {
      throw new Error('Incompatible asset version.');
    }

    // TODO: Check extensions against supported set.

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
        // Set defaults.
        bufferView.byteOffset = bufferView.byteOffset || 0;
        clientBufferView = resolveBuffer(bufferView.buffer).then(buffer => {
          bufferView.buffer = buffer;
          return bufferView;
        });
        clientBufferViews[index] = clientBufferView;
      }
      return clientBufferView;
    }

    // Images
    const clientImages = [];
    function resolveImage(index, colorSpace) {
      let clientImage = clientImages[index];
      if (!clientImage) {
        const image = Object.assign({ colorSpace }, json.images[index]);
        if (image.uri) {
          clientImage = fetch(resolveUri(image.uri, baseUrl)).then(async (response) => {
            image.blob = await response.blob();
            return client.createImage(image, index);
          });
        } else {
          clientImage = resolveBufferView(image.bufferView).then(bufferView => {
            image.bufferView = bufferView;
            image.blob = new Blob(
                [new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength)],
                {type: image.mimeType});
            return client.createImage(image, index);
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
          defaultSampler = client.createSampler(DEFAULT_SAMPLER, index);
        }
        return defaultSampler;
      }

      let clientSampler = clientSamplers[index];
      if (!clientSampler) {
        // Resolve any sampler defaults 
        const sampler = Object.assign({}, DEFAULT_SAMPLER, json.samplers[index]);
        clientSampler = client.createSampler(sampler, index);
        clientSamplers[index] = clientSampler;
      }
      return clientSampler;
    }

    // Textures
    const clientTextures = [];
    function resolveTexture(index, colorSpace = 'linear') {
      let clientTexture = clientTextures[index];
      if (!clientTexture) {
        const texture = json.textures[index];
        let source = texture.source;
        if (texture.extensions && texture.extensions.KHR_texture_basisu) {
          source = texture.extensions.KHR_texture_basisu.source;
        }
        clientTexture = resolveImage(source, colorSpace).then(async (clientImage) => {
          texture.image = clientImage;
          texture.sampler = await resolveSampler(texture.sampler);
          return client.createTexture(texture, index);
        });
        clientTextures[index] = clientTexture;
      }
      return clientTexture;
    }

    // Materials
    let defaultMaterial = null;
    const clientMaterials = [];
    function resolveMaterial(index) {
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
          return client.createMaterial(material, index);
        });
        clientMaterials[index] = clientMaterial;
      }
      return clientMaterial;
    }

    const clientVertexBuffers = [];
    function resolveVertexBuffer(index) {
      let clientVertexBuffer = clientVertexBuffers[index];
      if (!clientVertexBuffer) {
        clientVertexBuffer = resolveBufferView(index).then(bufferView => {
          return client.createVertexBuffer(bufferView, index);
        });
        clientVertexBuffers[index] = clientVertexBuffer;
      }
      return clientVertexBuffer;
    }

    const clientIndexBuffers = [];
    function resolveIndexBuffer(index) {
      let clientIndexBuffer = clientIndexBuffers[index];
      if (!clientIndexBuffer) {
        clientIndexBuffer = resolveBufferView(index).then(bufferView => {
          return client.createIndexBuffer(bufferView, index);
        });
        clientIndexBuffers[index] = clientIndexBuffer;
      }
      return clientIndexBuffer;
    }

    // Primitives
    function resolvePrimitive(mesh, index) {
      const primitive = mesh.primitives[index];
      const primitivePromises = [];
        
      primitivePromises.push(resolveMaterial(primitive.material).then(material => {
        primitive.material = material;
      }));
      
      const attributeBuffers = new Map();
      for (const name in primitive.attributes) {
        const accessor = Object.assign({}, DEFAULT_ACCESSOR, json.accessors[primitive.attributes[name]]);

        // TODO: Handle accessors with no bufferView (initialized to 0);
        primitivePromises.push(resolveVertexBuffer(accessor.bufferView).then(vertexBuffer => {
          accessor.vertexBuffer = vertexBuffer;
        }));

        primitive.attributes[name] = accessor;
      }

      if ('indices' in primitive) {
        const accessor = Object.assign({}, DEFAULT_ACCESSOR, json.accessors[primitive.indices]);

        primitivePromises.push(resolveIndexBuffer(accessor.bufferView).then(indexBuffer => {
          accessor.indexBuffer = indexBuffer;
        }));

        primitive.indices = accessor;
      }

      return Promise.all(primitivePromises).then(() => {
        return client.createPrimitive(primitive);
      });
    }

    // Meshes
    const clientMeshes = [];
    function resolveMesh(index) {
      let clientMesh = clientMeshes[index];
      if (!clientMesh) {
        const clientPrimitives = [];
        const mesh = json.meshes[index];
        for (const primitiveIndex in mesh.primitives) {
          clientPrimitives[primitiveIndex] = resolvePrimitive(mesh, primitiveIndex);
        }
        clientMesh = Promise.all(clientPrimitives).then(primitives => {
          mesh.primitives = primitives;
          return client.createMesh(mesh, index);
        });
        clientMeshes[index] = clientMesh;
      }
      return clientMesh;
    }

    // Camera
    const clientCameras = [];
    function resolveCamera(index) {
      let clientCamera = clientCameras[index];
      if (!clientCamera) {
        const camera = json.cameras[index];
        clientCamera = client.createCamera(camera, index);
        clientCameras[index] = clientCamera;
      }
      return clientCamera;
    }

    // Extensions

    // Lights
    const KHR_lights_punctual = json.extensions?.KHR_lights_punctual;
    const clientLights = [];
    function resolveLight(index) {
      let clientLight = clientLights[index];
      if (!clientLight) {
        const light = Object.assign({}, DEFAULT_LIGHT, KHR_lights_punctual[index]);
        clientLight = client.createLight(light, index);
        clientLights[index] = clientLight;
      }
      return clientLight;
    }


    const clientNodes = [];
    function resolveNode(index) {
      let clientNode = clientNodes[index];
      if (!clientNode) {
        let node = json.nodes[index];
        const nodePromises = [];

        if ('mesh' in node) {
          nodePromises.push(resolveMesh(node.mesh).then(mesh => {
            node.mesh = mesh;
          }));
        }

        if ('camera' in node) {
          nodePromises.push(resolveCamera(node.camera).then(camera => {
            node.camera = camera;
          }));
        }
        
        if (node.extensions?.KHR_lights_punctual) {
          nodePromises.push(resolveLight(node.extensions.KHR_lights_punctual.light).then(light => {
            node.light = light;
          }));
        }

        // Resolve any children of the node as well.
        const clientChildren = [];
        if ('children' in node) {
          for (const childIndex of node.children) {
            clientChildren.push(resolveNode(childIndex));
          }
        }

        clientNode = Promise.all(nodePromises).then(async () => {
          return new Gltf2Node(index, node, await Promise.all(clientChildren));
        });

        clientNodes[index] = clientNode;
      }
      return clientNode;
    }

    // TODO: Load more than the default scene?
    const scene = json.scenes[json.scene];
    const sceneNodes = [];
    for (const nodeIndex of scene.nodes) {
      sceneNodes.push(resolveNode(nodeIndex));
    }
    scene.nodes = await Promise.all(sceneNodes);

    return scene;
  }
}
