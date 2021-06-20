import { ResourceCache } from './resource-cache.js';
import { Attribute } from './geometry.js';
import { wgsl } from './wgsl-utils.js';

const AttribInput = {
  position: `[[location(${Attribute.position})]] position : vec3<f32>;`,
  normal: `[[location(${Attribute.normal})]] normal : vec3<f32>;`,
  tangent: `[[location(${Attribute.tangent})]] tangent : vec3<f32>;`,
  texCoord: `[[location(${Attribute.texCoord})]] texCoord : vec2<f32>;`,
  color: `[[location(${Attribute.color})]] color : vec4<f32>;`,
};

function getShaderSource(defines) {
  return {
    vertex: wgsl`
      [[block]] struct FrameUniforms {
        projectionMatrix : mat4x4<f32>;
        viewMatrix : mat4x4<f32>;
      };
      [[set(0), binding(0)]] var<uniform> frame : FrameUniforms;
      
      struct VertexInput {
        ${AttribInput.position}
        ${AttribInput.color}
      };

      struct VertexOutput {
        [[location(0)]] color : vec4<f32>;
        [[builtin(position)]] position : vec4<f32>;
      };

      [[stage(vertex)]]
      fn vertexMain(input : VertexInput) -> VertexOutput {
        var output : VertexOutput;
        output.color = input.color;
        output.position = frame.projectionMatrix * frame.viewMatrix * vec4(input.position, 1.0);
        return output;
      }
    `,
    fragment: wgsl`
      [[stage(fragment)]]
      fn fragmentMain([[location(0)]] color : vec4<f32>) -> [[location(0)]] vec4<f32> {
        return color;
      }
    `
  };
}



// Creates a default RenderPipeline for the given geometry and output format. This will render using
// any positions, normals, and vertex colors that may be supplied. If no colors are given will
// render magenta to help visually identify geometry that lacks a proper material.
export class DefaultPipelineCache {
  constructor(device) {
    this.device = device;
  }

  getKeyFor(descriptor) {
    return `${descriptor.layout.id}:${descriptor.format}:${descriptor.depthFormat}:${descriptor.sampleCount}`;
  }

  createFor(descriptor, id) {

  }
}