import { wgsl } from './wgsl-utils.js';

export const CAMERA_BUFFER_SIZE = 56 * Float32Array.BYTES_PER_ELEMENT;
export function CameraStruct(group = 0, binding = 0) { return `
  [[block]] struct Camera {
    projection : mat4x4<f32>;
    inverseProjection : mat4x4<f32>;
    view : mat4x4<f32>;
    position : vec3<f32>;
    time : f32;
    outputSize : vec2<f32>;
    zNear : f32;
    zFar : f32;
  };
  [[group(${group}), binding(${binding})]] var<uniform> camera : Camera;
`;
}

export const LIGHT_BUFFER_SIZE = 8 * Float32Array.BYTES_PER_ELEMENT;
export function LightStruct(group = 0, binding = 1) { return `
  struct Light {
    position : vec3<f32>;
    range : f32;
    color : vec3<f32>;
    intensity : f32;
  };

  [[block]] struct GlobalLights {
    ambient : vec3<f32>;
    lightCount : u32;
    lights : [[stride(32)]] array<Light>;
  };
  [[group(${group}), binding(${binding})]] var<storage, read> globalLights : GlobalLights;
`;
}

const APPROXIMATE_SRGB = true;
export const ColorConversions = wgsl`
#if ${APPROXIMATE_SRGB}
  // linear <-> sRGB approximations
  // see http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
  let GAMMA = 2.2;
  fn linearTosRGB(linear : vec3<f32>) -> vec3<f32> {
    let INV_GAMMA = 1.0 / GAMMA;
    return pow(linear, vec3<f32>(INV_GAMMA, INV_GAMMA, INV_GAMMA));
  }

  fn sRGBToLinear(srgb : vec3<f32>) -> vec3<f32> {
    return pow(srgb, vec3<f32>(GAMMA, GAMMA, GAMMA));
  }
#else
  // linear <-> sRGB conversions
  fn linearTosRGB(linear : vec3<f32>) -> vec3<f32> {
    if (all(linear <= vec3<f32>(0.0031308, 0.0031308, 0.0031308))) {
      return linear * 12.92;
    }
    return (pow(abs(linear), vec3<f32>(1.0/2.4, 1.0/2.4, 1.0/2.4)) * 1.055) - vec3<f32>(0.055, 0.055, 0.055);
  }

  fn sRGBToLinear(srgb : vec3<f32>) -> vec3<f32> {
    if (all(srgb <= vec3<f32>(0.04045, 0.04045, 0.04045))) {
      return srgb / vec3<f32>(12.92, 12.92, 12.92);
    }
    return pow((srgb + vec3<f32>(0.055, 0.055, 0.055)) / vec3<f32>(1.055, 1.055, 1.055), vec3<f32>(2.4, 2.4, 2.4));
  }
#endif
`;