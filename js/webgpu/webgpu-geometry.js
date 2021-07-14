import { System } from 'ecs';
import { mat4 } from 'gl-matrix';

import { MODEL_BUFFER_SIZE } from './wgsl/common.js';
import { StaticGeometry } from '../core/geometry.js';
import { Transform } from '../core/transform.js';
import { WebGPU } from './webgpu-components.js';

const IDENTITY_MATRIX = mat4.create();

class GeometryLayoutCache {
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
      return id;
    }
    return id;
  }

  getLayout(id) {
    return this.#cache.get(id);
  }

  getKey(geometry) {
    let key = `${geometry.buffers.length}[`;
    for (const buffer of geometry.buffers) {
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

export class WebGPUGeometrySystem extends System {
  geometryLayoutCache = new GeometryLayoutCache();

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);

    // For any entities with StaticGeometry but no WebGPURenderGeometry, create the WebGPU buffers
    // for the geometry, fill it from the StaticGeometry attributes, then clear the StaticGeometry's
    // attributes so the memory can be GCed if needed.
    this.query(StaticGeometry).not(WebGPURenderGeometry).forEach((entity, geometry) => {
      const gpuGeometry = new WebGPURenderGeometry(gpu);
      //renderable.pipeline = this.pipeline;
      gpuGeometry.drawCount = geometry.drawCount;

      gpuGeometry.layoutId = this.geometryLayoutCache.getId(geometry);
      gpuGeometry.layout = this.geometryLayoutCache.getLayout(gpuGeometry.layoutId);

      let i = 0;
      for (const buffer of geometry.buffers) {
        const alignedLength = Math.ceil(buffer.array.byteLength / 4) * 4;
        const vertexBuffer = gpu.device.createBuffer({
          size: alignedLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true
        });
        const mappedArray = new buffer.array.constructor(vertexBuffer.getMappedRange());
        mappedArray.set(buffer.array);
        vertexBuffer.unmap();
        gpuGeometry.vertexBuffers.push({
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
        gpuGeometry.indexBuffer = {
          buffer: indexBuffer,
          format: geometry.indexFormat
        };
      }

      // TODO: Allow StaticGeometry to GC?

      entity.add(gpuGeometry);
    });

    // Update the geometry's bind group.
    this.query(WebGPURenderGeometry).forEach((entity, geometry) => {
      const transform = entity.get(Transform);
      let modelMatrix = transform ? transform.matrix : IDENTITY_MATRIX;
      gpu.device.queue.writeBuffer(geometry.modelBuffer, 0, modelMatrix);
    });
  }
}