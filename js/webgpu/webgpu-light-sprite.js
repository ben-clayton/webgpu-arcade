import { WebGPUSystem } from './webgpu-system.js';
import { Geometry } from '../core/geometry.js';
import { WebGPURenderBatch } from './webgpu-render-batch.js';
import { WebGPUMesh, WebGPUMeshPrimitive } from './webgpu-mesh.js';
import { WebGPUMaterialPipeline, RenderOrder } from './materials/webgpu-materials.js';
import { WebGPULightBuffer } from './webgpu-light.js';
import { LightSpriteVertexSource, LightSpriteFragmentSource } from './wgsl/light-sprite.js';

export class WebGPULightSpriteSystem extends WebGPUSystem {
  init(gpu) {
    const vertexModule = gpu.device.createShaderModule({
      code: LightSpriteVertexSource,
      label: 'Light Sprite Vertex'
    });
    const fragmentModule = gpu.device.createShaderModule({
      code: LightSpriteFragmentSource,
      label: 'Light Sprite Fragment'
    });

    // Setup a render pipeline for drawing the light sprites
    this.pipeline = gpu.device.createRenderPipeline({
      label: `Light Sprite Pipeline`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
        ]
      }),
      vertex: {
        module: vertexModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one',
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one",
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32'
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less',
        format: gpu.depthFormat,
      },
      multisample: {
        count: gpu.sampleCount,
      }
    });

    const gpuPipeline = new WebGPUMaterialPipeline({
      pipeline: this.pipeline,
      renderOrder: RenderOrder.Last
    });

    this.lightMesh = new WebGPUMesh(
      new WebGPUMeshPrimitive(
        new Geometry({ drawCount: 4 }),
        gpuPipeline
      )
    );
  }

  execute(delta, time) {
    const lights = this.singleton.get(WebGPULightBuffer);
    const renderBatch = this.singleton.get(WebGPURenderBatch);
    renderBatch.addMesh(this.lightMesh, null, lights.lightCount);
  }
}