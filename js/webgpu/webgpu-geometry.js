import { System, Not } from '../ecs/system.js';
import { Geometry, GeometryError, RenderGeometry } from '../core/components/geometry.js';
import { WebGPU, WebGPURenderGeometry } from './webgpu-components.js';

function typedArrayToBuffer(device, typedArray, usage, commandEncoder = null) {
  const alignedLength = Math.ceil(typedArray.byteLength / 4) * 4;
  const gpuBuffer = device.createBuffer({
    size: alignedLength,
    usage: usage | GPUBufferUsage.COPY_DST
  });

  const copyBuffer = device.createBuffer({
    size: alignedLength,
    usage: GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true
  });
  const copyArray = new typedArray.constructor(copyBuffer.getMappedRange());
  copyArray.set(typedArray);
  copyBuffer.unmap();

  if (!commandEncoder) {
    const commandEncoder = device.createCommandEncoder({});
    commandEncoder.copyBufferToBuffer(copyBuffer, 0, gpuBuffer, 0, alignedLength);
    device.queue.submit([commandEncoder.finish()]);
  } else {
    commandEncoder.copyBufferToBuffer(copyBuffer, 0, gpuBuffer, 0, alignedLength);
  }

  return gpuBuffer;
}

export class WebGPUGeometrySystem extends System {
  static queries = {
    pendingGeometry: { components: [Geometry, Not(GeometryError), Not(WebGPURenderGeometry)] },
    removeGeometry: { components: [Not(RenderGeometry), WebGPURenderGeometry]}
  };

  execute() {
    const gpu = this.readSingleton(WebGPU);

    if (!gpu.device) { return; }

    // Loop through any geometry that doesn't have an associated WebGPU resource yet and create the necessary buffers.
    // The Geometry components will be removed to allow the arrays they use to be GCed, and a RenderGeometry tag
    // component will be added in it's place. Removing the RenderGeometry component will remove to the WebGPU resources.
    this.queries.pendingGeometry.results.forEach((entity) => {
      const geometry = entity.read(Geometry);

      if (!geometry.vertices || !geometry.vertices.length) {
        entity.add(GeometryError, {
          message: 'Geometry must have at least one vertex attribute.'
        });
        return;
      }

      const gpuGeometry = {
        vertexBuffers: [],
        vertexState: {
          vertexBuffers: []
        },
        drawCount: geometry.vertices[0].maxVertexCount,
        topology: geometry.topology,
      };

      geometry.vertices.sort((a, b) => a.minAttributeLocation - b.minAttributeLocation);

      let slot = 0;
      for (const vertexBuffer of geometry.vertices) {
        gpuGeometry.vertexBuffers.push({
          slot: slot++,
          buffer: typedArrayToBuffer(gpu.device, vertexBuffer.values, GPUBufferUsage.VERTEX),
          offset: 0,
          size: vertexBuffer.values.byteLength,
        });
        const bufferState = {
          arrayStride: vertexBuffer.stride,
          attributes: [],
        };

        vertexBuffer.attributes.sort((a, b) => a.location - b.location);

        for (const attribute of vertexBuffer.attributes) {
          bufferState.attributes.push({
            shaderLocation: attribute.location,
            format: attribute.format,
            offset: attribute.offset,
          })
        }
        gpuGeometry.vertexState.vertexBuffers.push(bufferState);
        gpuGeometry.drawCount = Math.min(gpuGeometry.drawCount, vertexBuffer.maxVertexCount);
      }

      if (geometry.indices instanceof Uint16Array ||
          geometry.indices instanceof Uint32Array) {
        gpuGeometry.indexBuffer = {
          buffer: typedArrayToBuffer(gpu.device, geometry.indices, GPUBufferUsage.INDEX),
          format: geometry.indices instanceof Uint16Array ? 'uint16' : 'uint32',
          offset: 0,
          size: geometry.indices.byteLength,
        };
        gpuGeometry.drawCount = geometry.indices.length;
        if (geometry.topology == 'triangle-strip' ||
            geometry.topology == 'line-strip') {
          gpuGeometry.vertexState.indexFormat = gpuGeometry.indexBuffer.format;
        }
      } else if (geometry.indices) {
        entity.add(GeometryError, {
          message: 'Invalid Geometry indices format. Must be given as a Uint16Array or Uint32Array.'
        });
        return;
      }

      if (geometry.drawCount) {
        gpuGeometry.drawCount = geometry.drawCount;
      }

      entity.remove(Geometry);
      entity.add(RenderGeometry);
      entity.add(WebGPURenderGeometry, gpuGeometry);
    });

    // Loop through any WebGPU resources that no longer have the RenderGeometry tag component and remove the associated
    // WebGPU resources as well.
    this.queries.removeGeometry.results.forEach((entity) => {
      const gpuGeometry = entity.read(WebGPURenderGeometry);

      if (gpuGeometry.indexBuffer) {
        gpuGeometry.indexBuffer.destroy();
      }
      for (const vertexBuffer of gpuGeometry.vertexBuffers) {
        vertexBuffer.buffer.destroy();
      }

      entity.remove(WebGPURenderGeometry);
    });
  }
}