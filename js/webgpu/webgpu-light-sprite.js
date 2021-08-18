import { System } from 'ecs';
import { Geometry } from '../core/geometry.js';
import { WebGPURenderGeometry } from './webgpu-geometry.js';
import { WebGPURenderPipeline, RenderOrder } from './webgpu-pipeline.js';
import { WebGPULightBuffer } from './webgpu-light.js';
import { LightSpriteVertexSource, LightSpriteFragmentSource } from './wgsl/light-sprite.js';

export class WebGPULightSpriteSystem extends System {
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

    this.gpuPipeline = new WebGPURenderPipeline();
    this.gpuPipeline.renderOrder = RenderOrder.Last;
    this.gpuPipeline.pipeline = this.pipeline;

    const geometry = new Geometry({
      drawCount: 4
    });

    this.gpuGeometry = new WebGPURenderGeometry(gpu);
    this.gpuGeometry.instanceCount = 0;

    this.entity = this.world.create(geometry, this.gpuPipeline, this.gpuGeometry);
  }

  execute(delta, time) {
    const lights = this.singleton.get(WebGPULightBuffer);
    this.gpuGeometry.instanceCount = lights.lightCount;
  }
}