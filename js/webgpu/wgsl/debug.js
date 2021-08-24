import { CameraStruct, SkinStructs } from './common.js';

export const BoneVertexSource = `
  ${CameraStruct(0, 0)}
  ${SkinStructs(1)}

  struct VertexInput {
    [[builtin(instance_index)]] instanceIndex : u32;
    [[location(0)]] position : vec4<f32>;
  };

  struct VertexOutput {
    [[builtin(position)]] position : vec4<f32>;
  };

  [[stage(vertex)]]
  fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;

    var instanceMatrix = joint.matrices[input.instanceIndex];
    // Cancel out scale
    instanceMatrix[0][0] = 1.0;
    instanceMatrix[1][1] = 1.0;
    instanceMatrix[2][2] = 1.0;
    output.position = camera.projection * camera.view * instanceMatrix * input.position;

    return output;
  }
`;

export const BoneFragmentSource = `
  [[stage(fragment)]]
  fn fragmentMain() -> [[location(0)]] vec4<f32> {
    return vec4<f32>(0.0, 1.0, 1.0, 1.0);
  }
`;