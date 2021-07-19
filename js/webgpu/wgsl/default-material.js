import { AttributeLocation } from '../../core/geometry.js';
import { wgsl } from './wgsl-utils.js';
import { CameraStruct, ModelStruct, ColorConversions } from './common.js';

function DefaultAttributes(layout) {
  let inputs = layout.locationsUsed.map((location) => {
    switch(location) {
      case AttributeLocation.position: return ``;
      case AttributeLocation.normal: return `[[location(${AttributeLocation.normal})]] normal : vec3<f32>;`;
      case AttributeLocation.tangent: return `// Tangent unused`;
      case AttributeLocation.texcoord: return `[[location(${AttributeLocation.texcoord})]] texcoord : vec2<f32>;`;
      case AttributeLocation.texcoord2: return `[[location(${AttributeLocation.texcoord2})]] texcoord2 : vec2<f32>;`;
      case AttributeLocation.color: return `[[location(${AttributeLocation.color})]] color : vec4<f32>;`;
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
        [[location(${AttributeLocation.position})]] position : vec3<f32>;
      };

      struct VertexOutput {
        ${DefaultAttributes(layout)}
        [[builtin(position)]] position : vec4<f32>;
      };

      [[stage(vertex)]]
      fn vertexMain(input : VertexInput) -> VertexOutput {
        var output : VertexOutput;
        output.position = camera.projection * camera.view * model.matrix * vec4<f32>(input.position, 1.0);
#if ${layout.locationsUsed.includes(AttributeLocation.normal)}
        output.normal = normalize((model.matrix * vec4<f32>(input.normal, 0.0)).xyz);
#endif
#if ${layout.locationsUsed.includes(AttributeLocation.texcoord)}
        output.texcoord = input.texcoord;
#endif
#if ${layout.locationsUsed.includes(AttributeLocation.texcoord2)}
        output.ttexcoord2 = input.texcoord2;
#endif
#if ${layout.locationsUsed.includes(AttributeLocation.color)}
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
        [[builtin(position)]] position : vec4<f32>;
      };

      [[stage(fragment)]]
      fn fragmentMain(input : VertexOutput) -> [[location(0)]] vec4<f32> {
#if ${layout.locationsUsed.includes(AttributeLocation.color)}
        var baseColor = input.color;
#else
        // Something that'll stand out :)
        var baseColor = vec4<f32>(1.0, 1.0, 1.0, 1.0);
#endif

#if ${layout.locationsUsed.includes(AttributeLocation.normal)}
        let normal = input.normal;
        baseColor = baseColor * vec4<f32>(normal, 1.0);
#else
        //let xTangent = dFdx(viewPosition);
        //let yTangent = dFdy(viewPosition);
        //let normal = normalize(cross(xTangent, yTangent));
#endif
#if ${layout.locationsUsed.includes(AttributeLocation.texcoord)}
        //baseColor = baseColor * vec4<f32>(input.texcoord, 1.0, 1.0);
#endif

        let sRGBColor = linearTosRGB(baseColor.rgb);
        return vec4<f32>(sRGBColor, baseColor.a);
      }
    `
}