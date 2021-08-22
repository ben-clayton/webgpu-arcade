import { System } from 'ecs';
import { Geometry, Attribute } from '../core/geometry.js';
import { WebGPUMesh, WebGPUMeshPrimitive } from './webgpu-mesh.js';
import { WebGPUMaterialPipeline, RenderOrder, WebGPUMaterialBindGroups } from './materials/webgpu-materials.js';
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

    const vertexBuffer = gpu.createStaticBuffer(SKYBOX_CUBE_VERTS, 'vertex');
    const indexBuffer = gpu.createStaticBuffer(SKYBOX_CUBE_INDICES, 'index');

    this.gpuPipeline = new WebGPUMaterialPipeline({
      pipeline: this.pipeline,
      renderOrder: RenderOrder.Skybox
    });

    this.geometry = new Geometry({
      drawCount: 36,
      attributes: [ new Attribute('position', vertexBuffer) ],
      indices: { buffer: indexBuffer, format: 'uint16' }
    });

    this.skyboxQuery = this.query(Skybox).not(Geometry);
  }

  execute(delta, time) {
    const gpu = this.world;
    this.skyboxQuery.forEach(async (entity, skybox) => {
      entity.add(this.geometry);

      const skyboxTexture = await skybox.texture;

      const bindGroup = gpu.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [{
          binding: 0,
          resource: skyboxTexture.texture.createView({ dimension: 'cube' }),
        }]
      });

      entity.add(new WebGPUMesh(
        new WebGPUMeshPrimitive(
          this.geometry,
          this.gpuPipeline,
          new WebGPUMaterialBindGroups(bindGroup)
        )
      ));
    });
  }
}