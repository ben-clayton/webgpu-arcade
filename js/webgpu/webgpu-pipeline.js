import { System, Not } from '../ecs/system.js';
import { WebGPU, WebGPUSwapConfig, WebGPULayouts, WebGPURenderGeometry, WebGPUPipeline } from './webgpu-components.js';
import { AttributeLocation } from '../core/components/geometry.js';

function getAttributeLayout(vertexState, location) {
  for (const vertexBuffer of vertexState.vertexBuffers) {
    for (const attribute of vertexBuffer.attributes) {
      if (attribute.shaderLocation === location) {
        return attribute;
      }
    }
  }
  return null;
}

// A shader to use when there's no material to pull it from
function getDefaultShader(geometry) {
  const positionAttrib = getAttributeLayout(geometry.vertexState, AttributeLocation.position);
  if (!positionAttrib) { return null; }

  //const colorAttrib = getAttributeLayout(geometry.vertexState, AttributeLocation.color);

  return {
    vertex: `
    [[block]] struct ProjectionUniforms {
      [[offset(0)]] matrix : mat4x4<f32>;
    };
    [[group(0), binding(0)]] var<uniform> projection : ProjectionUniforms;

    [[block]] struct ViewUniforms {
      [[offset(0)]] matrix : mat4x4<f32>;
    };
    [[group(0), binding(1)]] var<uniform> view : ViewUniforms;

    [[block]] struct ModelUniforms {
      [[offset(0)]] matrix : mat4x4<f32>;
    };
    [[group(1), binding(0)]] var<uniform> model : ModelUniforms;

    [[location(${AttributeLocation.position})]] var<in> position : vec3<f32>;
    [[location(${AttributeLocation.color})]] var<in> color : vec4<f32>;

    [[builtin(position)]] var<out> outPosition : vec4<f32>;
    [[location(0)]] var<out> outColor : vec4<f32>;

    [[stage(vertex)]]
    fn vertexMain() -> void {
      outColor = color;
      outPosition = projection.matrix * view.matrix * vec4<f32>(position, 1.0);
      //outPosition = projection.matrix * view.matrix * model.matrix * vec4<f32>(position, 1.0);
      return;
    }`,
    fragment: `
    [[location(0)]] var<in> inColor : vec4<f32>;

    [[location(0)]] var<out> outColor : vec4<f32>;

    [[stage(fragment)]]
    fn fragmentMain() -> void {
      outColor = inColor;
      return;
    }`,
  };
}

export class WebGPUPipelineSystem extends System {
  static queries = {
    pendingPipeline: { components: [WebGPURenderGeometry, Not(WebGPUPipeline)] }, // TODO: Include Material
    removePipeline: { components: [Not(WebGPURenderGeometry), WebGPUPipeline] }
  };

  init() {
    this.pipelineCache = new Map();
    this.pipelineLayout = null;
  }

  execute() {
    const gpu = this.readSingleton(WebGPU);
    if (!gpu.device) { return; }

    const swapConfig = this.readSingleton(WebGPUSwapConfig);
    this.queries.pendingPipeline.results.forEach((entity) => {
      const geometry = entity.read(WebGPURenderGeometry);

      // TODO: Optimize
      const pipelineKey = JSON.stringify(geometry.vertexState);

      let gpuPipeline = this.pipelineCache.get(pipelineKey);
      if (!gpuPipeline) {
        if (!this.pipelineLayout) {
          const layouts = this.readSingleton(WebGPULayouts);

          this.pipelineLayout = gpu.device.createPipelineLayout({
            bindGroupLayouts: [
              layouts.bindGroup.frame, // set 0
              layouts.bindGroup.model, // set 1
            ]
          });
        }

        const defaultShader = getDefaultShader(geometry);

        gpuPipeline = gpu.device.createRenderPipeline({
          layout: this.pipelineLayout,

          vertexStage: {
            module: gpu.device.createShaderModule({ code: defaultShader.vertex }),
            entryPoint: 'vertexMain',
          },
          fragmentStage: {
            module: gpu.device.createShaderModule({ code: defaultShader.fragment }),
            entryPoint: 'fragmentMain',
          },

          primitiveTopology: geometry.topology,
          vertexState: geometry.vertexState,

          colorStates: [{
            format: swapConfig.format,
          }],
          depthStencilState: {
            format: swapConfig.depthFormat,
            depthWriteEnabled: true,
            depthCompare: 'less',
          },
          sampleCount: swapConfig.sampleCount,
        });
      }

      entity.add(WebGPUPipeline, { pipeline: gpuPipeline });
    });

    this.queries.removePipeline.results.forEach((entity) => {
      entity.remove(WebGPUPipeline);
    });
  }
}