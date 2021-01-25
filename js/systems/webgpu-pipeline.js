import { System, Not } from '../third-party/ecsy/src/System.js';
import { WebGPU, WebGPUSwapConfig, WebGPURenderGeometry, WebGPUPipeline } from '../components/webgpu.js';
import { AttributeLocation } from '../components/geometry.js';

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

  const colorAttrib = getAttributeLayout(geometry.vertexState, AttributeLocation.color);

  return {
    vertex: `
    [[location(${AttributeLocation.position})]] var<in> position : vec3<f32>;
    [[location(${AttributeLocation.color})]] var<in> color : vec4<f32>;
  
    [[builtin(position)]] var<out> outPosition : vec4<f32>;
    [[location(0)]] var<out> outColor : vec4<f32>;
  
    [[stage(vertex)]]
    fn vertexMain() -> void {
      outColor = color;
      outPosition = vec4<f32>(position, 1.0);
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
  }

  execute() {
    const gpu = this.getSingletonComponent(WebGPU);
    if (!gpu.device) { return; }

    const swapConfig = this.getSingletonComponent(WebGPUSwapConfig);

    this.queries.pendingPipeline.results.forEach((entity) => {
      const geometry = entity.getComponent(WebGPURenderGeometry);

      // TODO: Optimize
      const pipelineKey = JSON.stringify(geometry.vertexState);

      let gpuPipeline = this.pipelineCache.get(pipelineKey);
      if (!gpuPipeline) {
        const defaultShader = getDefaultShader(geometry);

        gpuPipeline = gpu.device.createRenderPipeline({
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

      entity.addComponent(WebGPUPipeline, { pipeline: gpuPipeline });
    });

    this.queries.removePipeline.results.forEach((entity) => {
      entity.removeComponent(WebGPUPipeline);
    });
  }
}