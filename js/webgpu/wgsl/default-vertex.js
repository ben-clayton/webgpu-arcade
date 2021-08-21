import { wgsl } from './wgsl-utils.js';
import { AttributeLocation } from '../../core/geometry.js';
import { CameraStruct, DefaultVertexInput, DefaultVertexOutput, GetInstanceMatrix } from './common.js';

export function DefaultVertexSource(layout) { return wgsl`
  ${CameraStruct()}

  ${DefaultVertexInput(layout)}
  ${DefaultVertexOutput(layout)}

  ${GetInstanceMatrix}

  [[stage(vertex)]]
  fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;

    let instanceMatrix = getInstanceMatrix(input);

#if ${layout.locationsUsed.includes(AttributeLocation.normal)}
    output.normal = normalize((instanceMatrix * vec4<f32>(input.normal, 0.0)).xyz);
#else
    output.normal = normalize((instanceMatrix * vec4<f32>(0.0, 0.0, 1.0, 0.0)).xyz);
#endif

#if ${layout.locationsUsed.includes(AttributeLocation.tangent)}
    output.tangent = normalize((instanceMatrix * vec4<f32>(input.tangent.xyz, 0.0)).xyz);
    output.bitangent = cross(output.normal, output.tangent) * input.tangent.w;
#endif

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

    let modelPos = instanceMatrix * input.position;
    output.worldPos = modelPos.xyz;
    output.view = camera.position - modelPos.xyz;
    output.position = camera.projection * camera.view * modelPos;
    return output;
  }`;
}
