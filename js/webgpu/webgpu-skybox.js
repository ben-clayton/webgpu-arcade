import { System } from 'ecs';
import { WebGPURenderGeometry } from './webgpu-geometry.js';
import { WebGPURenderMaterial, WebGPURenderPipeline, RenderOrder } from './webgpu-pipeline.js';
import { SkyboxVertexSource, SkyboxFragmentSource } from './wgsl/skybox.js';
import { Skybox } from '../core/skybox.js';

const SKYBOX_CUBE_VERTS = new Float32Array([
  1.0,  1.0,  1.0, // 0
 -1.0,  1.0,  1.0, // 1
  1.0, -1.0,  1.0, // 2
 -1.0, -1.0,  1.0, // 3
  1.0,  1.0, -1.0, // 4
 -1.0,  1.0, -1.0, // 5
  1.0, -1.0, -1.0, // 6
 -1.0, -1.0, -1.0, // 7
]);

const SKYBOX_CUBE_INDICES = new Uint16Array([
  // PosX (Right)
  0, 2, 4,
  6, 4, 2,

  // NegX (Left)
  5, 3, 1,
  3, 5, 7,

  // PosY (Top)
  4, 1, 0,
  1, 4, 5,

  // NegY (Bottom)
  2, 3, 6,
  7, 6, 3,

  // PosZ (Front)
  0, 1, 2,
  3, 2, 1,

  // NegZ (Back)
  6, 5, 4,
  5, 6, 7,
]);

export class WebGPUSkyboxSystem extends System {
  init(gpu) {
    const vertexModule = gpu.device.createShaderModule({
      code: SkyboxVertexSource,
      label: 'Skybox Vertex'
    });
    const fragmentModule = gpu.device.createShaderModule({
      code: SkyboxFragmentSource,
      label: 'Skybox Fragment'
    });

    this.bindGroupLayout = gpu.device.createBindGroupLayout({
      label: 'Skybox BindGroupLayout',
      entries: [{
        binding: 0, // skyboxTexture
        visibility: GPUShaderStage.FRAGMENT,
        texture: { viewDimension: 'cube' }
      }]
    });

    // Setup a render pipeline for drawing the skybox
    this.pipeline = gpu.device.createRenderPipeline({
      label: `Skybox Pipeline`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.model,
          this.bindGroupLayout,
        ]
      }),
      vertex: {
        module: vertexModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
          attributes: [{
            shaderLocation: 0,
            format: 'float32x3',
            offset: 0,
          }]
        }]
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
        format: gpu.depthFormat,
      },
      multisample: {
        count: gpu.sampleCount,
      }
    });

    const vertexBuffer = gpu.device.createBuffer({
      size: SKYBOX_CUBE_VERTS.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    const vertexArray = new Float32Array(vertexBuffer.getMappedRange());
    vertexArray.set(SKYBOX_CUBE_VERTS);
    vertexBuffer.unmap();

    const indexBuffer = gpu.device.createBuffer({
      size: SKYBOX_CUBE_INDICES.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    const indexArray = new Uint16Array(indexBuffer.getMappedRange());
    indexArray.set(SKYBOX_CUBE_INDICES);
    indexBuffer.unmap();

    this.gpuPipeline = new WebGPURenderPipeline();
    this.gpuPipeline.renderOrder = RenderOrder.Skybox;
    this.gpuPipeline.pipeline = this.pipeline;

    this.gpuGeometry = new WebGPURenderGeometry(gpu);
    this.gpuGeometry.vertexBuffers = [{
      buffer: vertexBuffer,
      slot: 0,
      offset: 0
    }];
    this.gpuGeometry.indexBuffer = {
      buffer: indexBuffer,
      format: 'uint16'
    };
    this.gpuGeometry.drawCount = 36;

    this.skyboxQuery = this.query(Skybox).not(WebGPURenderGeometry);
  }

  execute(delta, time) {
    const gpu = this.world;
    this.skyboxQuery.forEach(async (entity, skybox) => {
      entity.add(this.gpuGeometry);

      const skyboxTexture = await skybox.texture;

      entity.add(this.gpuPipeline, new WebGPURenderMaterial(
        gpu.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [{
            binding: 0,
            resource: skyboxTexture.texture.createView({ dimension: 'cube' }),
          }]
        })
      ));
    });
  }
}