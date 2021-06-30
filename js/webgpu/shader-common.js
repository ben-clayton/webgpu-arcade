import { wgsl } from './wgsl-utils.js';

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
