import { System } from 'ecs';
import { vec3 } from 'gl-matrix';
import { AmbientLight, PointLight } from '../light.js';
import { Transform } from '../transform.js';
import { WebGPU } from './webgpu-components.js';

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

const MAX_LIGHTS = 256;

// Number of Float32 values in the lights buffer.
const LIGHT_ARRAY_SIZE = 8;
const GLOBAL_LIGHTS_ARRAY_SIZE = 4 + MAX_LIGHTS * LIGHT_ARRAY_SIZE;

export class WebGPULight {
  constructor(arrayBuffer, byteOffset) {
    this.position = new Float32Array(arrayBuffer, byteOffset, 3);
    this.range = new Float32Array(arrayBuffer, byteOffset + 12, 1);
    this.color = new Float32Array(arrayBuffer, byteOffset + 16, 3);
    this.intensity = new Float32Array(arrayBuffer, byteOffset + 28, 1);
  }
}

export class WebGPULightBuffer {
  constructor(gpu) {
    this.buffer = gpu.device.createBuffer({
      size: GLOBAL_LIGHTS_ARRAY_SIZE * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
  }
}

export class WebGPULightSystem extends System {
  nextByteOffset = 4 * Float32Array.BYTES_PER_ELEMENT;
  freedLights = [];

  init(gpu) {
    this.array = new Float32Array(GLOBAL_LIGHTS_ARRAY_SIZE);
    const arrayBuffer = this.array.buffer;
    this.ambientColor = new Float32Array(arrayBuffer, 0, 3);
    this.lightCount = new Uint32Array(arrayBuffer, 3 * Float32Array.BYTES_PER_ELEMENT, 1);
    this.lightCount[0] = 0;

    this.singleton.add(new WebGPULightBuffer(gpu));
  }

  execute(delta, time) {
    // If a PointLight does not have an associated WebGPULight add one.
    this.query(PointLight).not(WebGPULight).forEach((entity) => {
      if (this.freedLights.length) {
        // Recycle previously used and released
        entity.add(freedLights.pop());
      } else {
        this.lightCount++;
        entity.add(new WebGPULight(this.array.buffer, this.nextByteOffset));
        this.nextByteOffset += LIGHT_ARRAY_SIZE * Float32Array.BYTES_PER_ELEMENT;
      }
    });

    // If a WebGPULight has had it's PointLight removed, also remove the WebGPULight
    // and push it onto a list of freed lights.
    this.query(WebGPULight).not(PointLight).forEach((entity) => {
      const gpuLight = entity.remove(WebGPULight);
      gpuLight.intensity[0] = 0;
      this.freedLights.push(entity.remove(WebGPULight));
    });

    this.query(PointLight, WebGPULight).forEach((entity, light, gpuLight) => {
      const transform = entity.get(Transform);
      if (transform) {
        vec3.copy(gpuLight.position, transform.position);
      } else {
        // If the light doesn't have a transform position it at the origin.
        vec3.set(gpuLight.position, 0, 0, 0);
      }

      gpuLight.range[0] = light.range >= 0 ? light.range : light.computedRange;
      vec3.copy(gpuLight.color, light.color);
      gpuLight.intensity[0] = light.intensity;
    });

    // Accumulate all of the ambient lights.
    vec3.set(this.ambientColor, 0, 0, 0);
    this.query(AmbientLight).forEach((entity, light) => {
      vec3.add(this.ambientColor, this.ambientColor, light.color);
    });

    const gpu = this.singleton.get(WebGPU);
    const lights = this.singleton.get(WebGPULightBuffer);
    gpu.device.queue.writeBuffer(lights.buffer, 0, this.array);
  }
}