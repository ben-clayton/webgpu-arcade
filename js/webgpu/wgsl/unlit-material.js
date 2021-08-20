import { wgsl } from './wgsl-utils.js';
import { AttributeLocation } from '../../core/geometry.js';
import { CameraStruct, InstanceStruct, ColorConversions } from './common.js';

export const MATERIAL_BUFFER_SIZE = 5 * Float32Array.BYTES_PER_ELEMENT;
export function MaterialStruct(group = 2) { return `
  [[block]] struct Material {
    baseColorFactor : vec4<f32>;
    alphaCutoff : f32;
  };
  [[group(${group}), binding(0)]] var<uniform> material : Material;

  [[group(${group}), binding(1)]] var baseColorTexture : texture_2d<f32>;
  [[group(${group}), binding(2)]] var baseColorSampler : sampler;
`;
}

function DefaultAttributes(layout) {
  let inputs = layout.locationsUsed.map((location) => {
      switch(location) {
      case AttributeLocation.position: return `[[location(${AttributeLocation.position})]] position : vec4<f32>;`;
      case AttributeLocation.normal: return `[[location(${AttributeLocation.normal})]] normal : vec3<f32>;`;
      case AttributeLocation.tangent: return `[[location(${AttributeLocation.tangent})]] tangent : vec4<f32>;`;
      case AttributeLocation.texcoord: return `[[location(${AttributeLocation.texcoord})]] texcoord : vec2<f32>;`;
      case AttributeLocation.texcoord2: return `[[location(${AttributeLocation.texcoord2})]] texcoord2 : vec2<f32>;`;
      case AttributeLocation.color: return `[[location(${AttributeLocation.color})]] color : vec4<f32>;`;
      }
  });

  return inputs.join('\n');
};

function VertexOutput(layout) { return wgsl`
  struct VertexOutput {
    [[builtin(position)]] position : vec4<f32>;
    [[location(0)]] worldPos : vec3<f32>;
    [[location(1)]] texcoord : vec2<f32>;
    [[location(2)]] texcoord2 : vec2<f32>;
    [[location(3)]] color : vec4<f32>;
  };
`;
}

export function UnlitVertexSource(layout) { return wgsl`
  ${CameraStruct()}
  ${InstanceStruct()}

  struct VertexInputs {
    [[builtin(instance_index)]] instanceIndex : u32;
    ${DefaultAttributes(layout)}
  };

  ${VertexOutput(layout)}

  [[stage(vertex)]]
  fn vertexMain(input : VertexInputs) -> VertexOutput {
    var output : VertexOutput;

#if ${layout.locationsUsed.includes(AttributeLocation.color)}
    output.color = input.color;
#else
    output.color = vec4<f32>(1.0, 1.0, 1.0, 1.0);
#endif

#if ${layout.locationsUsed.includes(AttributeLocation.texcoord)}
    output.texcoord = input.texcoord;
#endif
#if ${layout.locationsUsed.includes(AttributeLocation.texcoord2)}
    output.texcoord2 = input.texcoord2;
#endif

    let instanceMatrix = instance.matrix[input.instanceIndex];
    output.position = camera.projection * camera.view * instanceMatrix * input.position;
    return output;
  }`;
}

export function UnlitFragmentSource(layout) { return `
  ${ColorConversions}
  ${VertexOutput(layout)}
  ${MaterialStruct()}

  [[stage(fragment)]]
  fn fragmentMain(input : VertexOutput) -> [[location(0)]] vec4<f32> {
    let baseColorMap = textureSample(baseColorTexture, baseColorSampler, input.texcoord);
    if (baseColorMap.a < material.alphaCutoff) {
      discard;
    }
    let baseColor = input.color * material.baseColorFactor * baseColorMap;
    return vec4<f32>(linearTosRGB(baseColor.rgb), baseColor.a);
  }`;
};
