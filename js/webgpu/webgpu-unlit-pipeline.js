import { AttributeLocation } from '../core/geometry.js';
import { WebGPUPipelineSystem } from './webgpu-pipeline.js';
import { UnlitVertexSource, UnlitFragmentSource, MATERIAL_BUFFER_SIZE } from './wgsl/unlit-material.js';
import { vec4 } from 'gl-matrix';

export class UnlitMaterial {
  baseColorFactor = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
  baseColorTexture;
};

// Can reuse these for every unlit material
const materialArray = new Float32Array(MATERIAL_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT);
const baseColorFactor = new Float32Array(materialArray.buffer, 0, 4);

export class WebGPUUnlitPipelineSystem extends WebGPUPipelineSystem {
  init(gpu) {
    super.init(gpu, UnlitMaterial);

    this.whiteTextureView = gpu.textureLoader.fromColor(1.0, 1.0, 1.0, 1.0).texture.createView();
    this.defaultSampler = gpu.device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

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
        resource: material.baseColorTexture || this.whiteTextureView,
      },
      {
        binding: 2,
        resource: this.defaultSampler,
      }]
    });
  }

  createPipeline(gpu, entity, gpuGeometry) {
    const layout = gpuGeometry.layout;

    if (!layout.locationsUsed.includes(AttributeLocation.position)) {
      console.error('Cannot use UnlitMaterial if the associated Geometry does not define at least a position attribute.')
      return null;
    }

    return gpu.device.createRenderPipeline({
      label: `Unlit Pipeline (LayoutID: ${gpuGeometry.layoutId})`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.model,
          this.bindGroupLayout,
        ]
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: UnlitVertexSource(layout) }),
        entryPoint: 'vertexMain',
        buffers: layout.buffers,
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: UnlitFragmentSource(layout) }),
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format,
        }],
      },

      primitive: {
        topology: layout.primitive.topology,
        stripIndexFormat: layout.primitive.stripIndexFormat,
        cullMode: 'back',
      },
      depthStencil: {
        format: gpu.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
      multisample: { count: gpu.sampleCount, },
    });
  }
}