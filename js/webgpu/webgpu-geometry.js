import { MODEL_BUFFER_SIZE } from './wgsl/common.js';

export class GeometryLayoutCache {
  #nextId = 1;
  #keyMap = new Map(); // Map of the given key to an ID
  #cache = new Map();  // Map of ID to cached resource

  getId(geometry) {
    let key = this.getKey(geometry);
    let id = this.#keyMap[key];
    if (id === undefined) {
      id = this.#nextId++;
      const resource = this.createLayout(geometry, id);
      this.#keyMap.set(key, id);
      this.#cache.set(id, resource);
    }
    return id;
  }

  getLayout(id) {
    return this.#cache.get(id);
  }

  getKey(geometry) {
    let key = `${geometry.buffers.length}[`;
    for (const buffer of geometry.buffers) {
      if (!buffer.attributes.length) { continue; }
      const attributes = [];
      for (const attrib of buffer.attributes) {
        const offset = attrib.offset - buffer.minOffset
        attributes.push(`${attrib.shaderLocation},${attrib.format},${offset}`);
      }

      // TODO: Necessary? Will help more layout keys match but probably won't make much different in
      // real-world use.
      attributes.sort();

      key += `${buffer.arrayStride},[${attributes.join(',')}]`;
    }

    key += `]${geometry.topology}`

    switch(geometry.topology) {
      case 'triangle-strip':
      case 'line-strip':
        key += `-${geometry.indexFormat}`;
    }

    return key;
  }

  createLayout(geometry, id) {
    const buffers = [];
    const locationsUsed = [];
    for (const buffer of geometry.buffers) {
      if (!buffer.attributes.length) { continue; }
      const attributes = [];
      for (const attrib of buffer.attributes) {
        // Exact offset will be handled when setting the buffer.
        const offset = attrib.offset - buffer.minOffset
        attributes.push({
          shaderLocation: attrib.shaderLocation,
          format: attrib.format,
          offset,
        });
        locationsUsed.push(attrib.shaderLocation);
      }

      buffers.push({
        arrayStride: buffer.arrayStride,
        attributes
      });
    }

    const primitive = { topology: geometry.topology };
    switch(geometry.topology) {
      case 'triangle-strip':
      case 'line-strip':
        primitive.stripIndexFormat = geometry.indexFormat;
    }

    const layout = {
      id,
      buffers,
      primitive,
      locationsUsed,
    };

    return layout;
  }
}

export class WebGPURenderGeometry {
  layoutId = 0;
  layout = null;
  drawCount = 0;
  instanceCount = 1;
  indexBuffer = null;
  vertexBuffers = [];
  materialBindGroup = null;

  constructor(gpu) {
    this.modelBuffer = gpu.device.createBuffer({
      size: MODEL_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bindGroup = gpu.device.createBindGroup({
      layout: gpu.bindGroupLayouts.model,
      entries: [{
        binding: 0,
        resource: { buffer: this.modelBuffer },
      }]
    });
  }
}
