import { AttributeLocation } from '../core/geometry.js';
import { WebGPUPipelineSystem } from './webgpu-pipeline.js';
import { UnlitVertexSource, UnlitFragmentSource, MATERIAL_BUFFER_SIZE } from './wgsl/unlit-material.js';
import { vec4 } from 'gl-matrix';

export class UnlitMaterial {
  baseColorFactor = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
  baseColorTexture;
  baseColorSampler;
  transparent = false;
  doubleSided = false;
  alphaCutoff = 0.0;
};

// Can reuse these for every unlit material
const materialArray = new Float32Array(MATERIAL_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT);
const baseColorFactor = new Float32Array(materialArray.buffer, 0, 4);

export class WebGPUUnlitPipelineSystem extends WebGPUPipelineSystem {
  init(gpu) {
    super.init(gpu, UnlitMaterial);

    this.bindGroupLayout = gpu.device.createBindGroupLayout({
      label: 'PBR Material BindGroupLayout',
      entries: [{
        binding: 0, // Uniform Buffer
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {}
      },
      {
        binding: 1, // baseColorTexture
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      },
      {
        binding: 2, // baseColorSampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      }]
    });
  }

  createMaterialBindGroup(gpu, entity, material) {
    vec4.copy(baseColorFactor, material.baseColorFactor);
    materialArray[4] = material.alphaCutoff;

    const materialBuffer = gpu.device.createBuffer({
      size: MATERIAL_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(materialBuffer, 0, materialArray);

    return gpu.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: materialBuffer },
      },
      {
        binding: 1,
        resource: material.baseColorTexture || gpu.whiteTextureView,
      },
      {
        binding: 2,
        resource: material.baseColorSampler || gpu.defaultSampler,
      }]
    });
  }

  createVertexModule(gpu, entity, gpuGeometry, material) {
    return {
      module: gpu.device.createShaderModule({ code: UnlitVertexSource(gpuGeometry.layout) }),
      entryPoint: 'vertexMain',
    };
  }

  createFragmentModule(gpu, entity, gpuGeometry, material) {
    return {
      module: gpu.device.createShaderModule({ code: UnlitFragmentSource(gpuGeometry.layout) }),
      entryPoint: 'fragmentMain',
    };
  }
}