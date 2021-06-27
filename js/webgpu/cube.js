import { WebGPURenderable } from './webgpu-components.js';
import { CameraUniforms } from './webgpu-camera.js';

const Cube = {
  vertexShader: `
    ${CameraUniforms(0, 0)}
    
    struct VertexInput {
      [[location(0)]] position : vec4<f32>;
      [[location(1)]] color : vec4<f32>;
    };

    struct VertexOutput {
      [[location(0)]] color : vec4<f32>;
      [[builtin(position)]] position : vec4<f32>;
    };

    [[stage(vertex)]]
    fn vertexMain(input : VertexInput) -> VertexOutput {
      var output : VertexOutput;
      output.color = input.color;
      output.position = camera.projection * camera.view * input.position;
      return output;
    }
  `,
  fragmentShader: `
    [[stage(fragment)]]
    fn fragmentMain([[location(0)]] color : vec4<f32>) -> [[location(0)]] vec4<f32> {
      return color;
    }
  `,
  layout: {
    arrayStride: 4 * 10, // Byte size of one cube vertex
    attributes: [{
      // position
      shaderLocation: 0,
      offset: 0,
      format: "float32x4"
    }, {
      // color
      shaderLocation: 1,
      offset: 4 * 4,
      format: "float32x4"
    },
    {
      // UV
      shaderLocation: 2,
      offset: 4 * 8,
      format: "float32x2"
    }]
  },
  vertexCount: 36,
  vertexArray: new Float32Array([
    // float4 position, float4 color, float2 uv,
    1, -1, 1, 1,   1, 0, 1, 1,  1, 1,
    -1, -1, 1, 1,  0, 0, 1, 1,  0, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,  0, 0,
    1, -1, -1, 1,  1, 0, 0, 1,  1, 0,
    1, -1, 1, 1,   1, 0, 1, 1,  1, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,  0, 0,

    1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
    1, -1, 1, 1,   1, 0, 1, 1,  0, 1,
    1, -1, -1, 1,  1, 0, 0, 1,  0, 0,
    1, 1, -1, 1,   1, 1, 0, 1,  1, 0,
    1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
    1, -1, -1, 1,  1, 0, 0, 1,  0, 0,

    -1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
    1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
    1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
    -1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
    -1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
    1, 1, -1, 1,   1, 1, 0, 1,  0, 0,

    -1, -1, 1, 1,  0, 0, 1, 1,  1, 1,
    -1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
    -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
    -1, -1, -1, 1, 0, 0, 0, 1,  1, 0,
    -1, -1, 1, 1,  0, 0, 1, 1,  1, 1,
    -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,

    1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
    -1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
    -1, -1, 1, 1,  0, 0, 1, 1,  0, 0,
    -1, -1, 1, 1,  0, 0, 1, 1,  0, 0,
    1, -1, 1, 1,   1, 0, 1, 1,  1, 0,
    1, 1, 1, 1,    1, 1, 1, 1,  1, 1,

    1, -1, -1, 1,  1, 0, 0, 1,  1, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,  0, 1,
    -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
    1, 1, -1, 1,   1, 1, 0, 1,  1, 0,
    1, -1, -1, 1,  1, 0, 0, 1,  1, 1,
    -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
  ])
};

export class CubeRenderableFactory {
  constructor(gpu, frameBGL) {
    this.gpu = gpu;
    this.drawCount = Cube.vertexCount;

    this.vertexBuffer = gpu.device.createBuffer({
      size: Cube.vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    gpu.device.queue.writeBuffer(this.vertexBuffer, 0, Cube.vertexArray.buffer);

    this.pipeline = gpu.device.createRenderPipeline({
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [frameBGL]
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: Cube.vertexShader }),
        entryPoint: 'vertexMain',
        buffers: [Cube.layout],
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: Cube.fragmentShader }),
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format,
        }],
      },

      primitive: {
        topology: 'triangle-list',
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

  createRenderable() {
    const renderable = new WebGPURenderable();
    renderable.pipeline = this.pipeline;
    renderable.drawCount = Cube.vertexCount;
    renderable.setVertexBuffer(0, this.vertexBuffer);
    return renderable;
  }
}
