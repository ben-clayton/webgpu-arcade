import { System } from 'ecs';
import { WebGPUPipelineSystem } from './webgpu-pipeline.js';
import { PBRVertexSource, PBRFragmentSource, MATERIAL_BUFFER_SIZE } from './wgsl/pbr-material.js';

export class PBRMaterial {
  baseColor;
  baseColorTexture;
  normalTexture;
  metallicRoughnessFactor;
  metallicRoughnessTexture;
  emmissiveFactor;
  emissiveTexture;
  occlusionTexture;
};

export class WebGPUPBRPipelineSystem extends WebGPUPipelineSystem {
  init(gpu) {
    super.init(gpu, PBRMaterial);

    this.blackTextureView = gpu.textureLoader.fromColor(0, 0, 0, 0).texture.createView();
    this.whiteTextureView = gpu.textureLoader.fromColor(1.0, 1.0, 1.0, 1.0).texture.createView();
    this.blueTextureView = gpu.textureLoader.fromColor(0, 0, 1.0, 0).texture.createView();
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
      },
      {
        binding: 3, // normalTexture
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      },
      {
        binding: 4, // normalSampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      },
      {
        binding: 5, // metallicRoughnessTexture
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      },
      {
        binding: 6, // metallicRoughnessSampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      },
      {
        binding: 7, // occlusionTexture
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      },
      {
        binding: 8, // occlusionSampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      },
      {
        binding: 9, // emissiveTexture
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
      },
      {
        binding: 10, // emissiveSampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      }]
    });
  }

  createMaterialBindGroup(gpu, entity, material) {
    //vec4.copy(baseColorFactor, material.baseColorFactor);
    //vec2.copy(metallicRoughnessFactor, material.metallicRoughnessFactor);
    //vec3.copy(emissiveFactor, material.emissiveFactor);

    const materialBuffer = gpu.device.createBuffer({
      size: MATERIAL_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

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
      },
      {
        binding: 3,
        resource: material.normalTexture || this.blueTextureView,
      },
      {
        binding: 4,
        resource: this.defaultSampler,
      },
      {
        binding: 5,
        resource: material.metallicRoughnessTexture || this.whiteTextureView,
      },
      {
        binding: 6,
        resource: this.defaultSampler,
      },
      {
        binding: 7,
        resource: material.occlusionTexture || this.whiteTextureView,
      },
      {
        binding: 8,
        resource: this.defaultSampler,
      },
      {
        binding: 9,
        resource: material.emissiveTexture || this.blackTextureView,
      },
      {
        binding: 10,
        resource: this.defaultSampler,
      },]
    });
  }

  createPipeline(gpu, entity, gpuGeometry) {
    const layout = gpuGeometry.layout;

    return gpu.device.createRenderPipeline({
      label: `PBR Pipeline (LayoutID: ${gpuGeometry.layoutId})`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.model,
          this.bindGroupLayout,
        ]
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: PBRVertexSource(layout) }),
        entryPoint: 'vertexMain',
        buffers: layout.buffers,
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: PBRFragmentSource(layout) }),
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