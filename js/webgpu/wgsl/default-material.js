import { Attribute } from '../../core/geometry.js';
import { wgsl } from './wgsl-utils.js';
import { CameraStruct, ModelStruct, ColorConversions } from './common.js';

function DefaultAttributes(layout) {
  let inputs = layout.locationsUsed.map((location) => {
    switch(location) {
      case Attribute.position: return ``;
      case Attribute.normal: return `[[location(${Attribute.normal})]] normal : vec3<f32>;`;
      case Attribute.tangent: return `// Tangent unused`;
      case Attribute.texCoord: return `[[location(${Attribute.texCoord})]] texCoord : vec2<f32>;`;
      case Attribute.color: return `[[location(${Attribute.color})]] color : vec4<f32>;`;
    }
  });

  return inputs.join('\n');
};

export function DefaultVertexSource(layout) {
  return wgsl`
      ${CameraStruct()}
      ${ModelStruct()}
      
      struct VertexInput {
        ${DefaultAttributes(layout)}
        [[location(${Attribute.position})]] position : vec3<f32>;
      };

      struct VertexOutput {
        ${DefaultAttributes(layout)}
        [[builtin(position)]] position : vec4<f32>;
      };

      [[stage(vertex)]]
      fn vertexMain(input : VertexInput) -> VertexOutput {
        var output : VertexOutput;
        output.position = camera.projection * camera.view * model.matrix * vec4<f32>(input.position, 1.0);
#if ${layout.locationsUsed.includes(Attribute.normal)}
        output.normal = normalize((mesh.matrix * vec4<f32>(input.normal, 0.0)).xyz);
#endif
#if ${layout.locationsUsed.includes(Attribute.texCoord)}
        output.texCoord = input.texCoord;
#endif
#if ${layout.locationsUsed.includes(Attribute.color)}
        output.color = input.color;
#endif
        return output;
      }
    `;
}

export function DefaultFragmentSource(layout) {
    return wgsl`
      ${ColorConversions}

      struct VertexOutput {
        ${DefaultAttributes(layout)}
      };

      [[stage(fragment)]]
      fn fragmentMain(input : VertexOutput) -> [[location(0)]] vec4<f32> {
#if ${layout.locationsUsed.includes(Attribute.color)}
        let baseColor = input.color;
#else
        // Something that'll stand out :)
        let baseColor = vec4<f32>(1.0, 0.0, 1.0, 1.0);
#endif

#if ${layout.locationsUsed.includes(Attribute.normal)}
        //let normal = input.normal;
#else
        //let xTangent = dFdx(viewPosition);
        //let yTangent = dFdy(viewPosition);
        //let normal = normalize(cross(xTangent, yTangent));
#endif

        let sRGBColor = linearTosRGB(baseColor.rgb);
        return vec4<f32>(sRGBColor, baseColor.a);
      }
    `
}