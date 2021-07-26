import { System } from 'ecs';
import { WebGPURenderGeometry } from './webgpu-geometry.js';
import { WebGPURenderPipeline, RenderOrder } from './webgpu-pipeline.js';
import { CameraStruct, ColorConversions } from './wgsl/common.js';

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

const SkyboxVertexSource = `
  var<private> pos : array<vec2<f32>, 4> = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0)
  );

  ${CameraStruct(0, 0)}
  ${LightStruct(0, 1)}

  struct VertexInput {
    [[builtin(vertex_index)]] vertexIndex : u32;
    [[builtin(instance_index)]] instanceIndex : u32;
  };

  struct VertexOutput {
    [[builtin(position)]] position : vec4<f32>;
    [[location(0)]] localPos : vec2<f32>;
    [[location(1)]] color: vec3<f32>;
  };

  [[stage(vertex)]]
  fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;

    let light = &globalLights.lights[input.instanceIndex];

    output.localPos = pos[input.vertexIndex];
    output.color = (*light).color * (*light).intensity;
    let worldPos = vec3<f32>(output.localPos, 0.0) * (*light).range * 0.025;

    // Generate a billboarded model view matrix
    var bbModelViewMatrix : mat4x4<f32>;
    bbModelViewMatrix[3] = vec4<f32>((*light).position, 1.0);
    bbModelViewMatrix = camera.view * bbModelViewMatrix;
    bbModelViewMatrix[0][0] = 1.0;
    bbModelViewMatrix[0][1] = 0.0;
    bbModelViewMatrix[0][2] = 0.0;

    bbModelViewMatrix[1][0] = 0.0;
    bbModelViewMatrix[1][1] = 1.0;
    bbModelViewMatrix[1][2] = 0.0;

    bbModelViewMatrix[2][0] = 0.0;
    bbModelViewMatrix[2][1] = 0.0;
    bbModelViewMatrix[2][2] = 1.0;

    output.position = camera.projection * bbModelViewMatrix * vec4<f32>(worldPos, 1.0);
    return output;
  }
`;

const SkyboxFragmentSource = `
  ${ColorConversions}

  struct FragmentInput {
    [[location(0)]] localPos : vec2<f32>;
    [[location(1)]] color: vec3<f32>;
  };

  [[stage(fragment)]]
  fn fragmentMain(input : FragmentInput) -> [[location(0)]] vec4<f32> {
    let distToCenter = length(input.localPos);
    let fade = (1.0 - distToCenter) * (1.0 / (distToCenter * distToCenter));
    return vec4<f32>(linearTosRGB(input.color * fade), fade);
  }
`;

export class WebGPUSkyboxSystem extends System {
  init(gpu) {
    const vertexModule = gpu.device.createShaderModule({
      code: LightSpriteVertexSource,
      label: 'Skybox Vertex'
    });
    const fragmentModule = gpu.device.createShaderModule({
      code: LightSpriteFragmentSource,
      label: 'Skybox Fragment'
    });

    // Setup a render pipeline for drawing the skybox
    this.pipeline = gpu.device.createRenderPipeline({
      label: `Skybox Pipeline`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
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
        depthCompare: 'less',
        format: gpu.depthFormat,
      },
      multisample: {
        count: gpu.sampleCount,
      }
    });

    const vertexBuffer = this.device.createBuffer({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    const vertexArray = new Float32Array(vertexBuffer.getMappedRange());
    vertexArray.set(SKYBOX_CUBE_VERTS);
    vertexBuffer.unmap();

    const indexBuffer = this.device.createBuffer({
      size: indexArray.byteLength,
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
    this.gpuGeometry.vertexBuffers = [vertexBuffer];
    this.gpuGeometry.indexBuffer = indexBuffer;
    this.gpuGeometry.drawCount = 36;

    this.skyboxQuery = this.query(Skybox).not(WebGPUGeometry);
    this.entity = this.world.create(this.gpuPipeline, this.gpuGeometry);
  }

  execute(delta, time) {
    this.skyboxQuery.forEach((entity, skybox) => {
      // TODO: Create a material bind group.
      entity.add(this.gpuPipeline, this.gpuGeometry);
    });
  }
}