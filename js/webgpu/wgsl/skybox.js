import { CameraStruct, ModelStruct, ColorConversions } from './common.js';

export const SkyboxVertexSource = `
  ${ModelStruct()}
  ${CameraStruct(0, 0)}

  struct VertexInput {
    [[location(0)]] position : vec4<f32>;
  };

  struct VertexOutput {
    [[builtin(position)]] position : vec4<f32>;
    [[location(0)]] texCoord : vec3<f32>;
  };

  [[stage(vertex)]]
  fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.texCoord = input.position.xyz;

    var modelView : mat4x4<f32> = camera.view * model.matrix;
    // Drop the translation portion of the modelView matrix
    modelView[3] = vec4<f32>(0.0, 0.0, 0.0, modelView[3].w);
    output.position = camera.projection * modelView * input.position;
    // Returning the W component for both Z and W forces the geometry depth to
    // the far plane. When combined with a depth func of "less-equal" this makes
    // the sky write to any depth fragment that has not been written to yet.
    output.position = output.position.xyww;
    return output;
  }
`;

export const SkyboxFragmentSource = `
  ${ColorConversions}

  struct FragmentInput {
    [[location(0)]] texCoord : vec3<f32>;
  };
  [[group(2), binding(0)]] var skyboxTexture : texture_cube<f32>;
  [[group(2), binding(1)]] var skyboxSampler : sampler;

  [[stage(fragment)]]
  fn fragmentMain(input : FragmentInput) -> [[location(0)]] vec4<f32> {
    let color = textureSample(skyboxTexture, skyboxSampler, input.texCoord);
    return vec4<f32>(linearTosRGB(color.rgb), 1.0);
  }
`;