import { System } from 'ecs';
import { vec3 } from 'gl-matrix';
import { AmbientLight, PointLight } from '../core/light.js';
import { Transform } from '../core/transform.js';
import { WebGPU } from './webgpu.js';

import { LIGHT_BUFFER_SIZE } from './wgsl/common.js';

const MAX_LIGHTS = 256;
const GLOBAL_LIGHTS_BUFFER_SIZE = 4 + MAX_LIGHTS * LIGHT_BUFFER_SIZE;

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
      size: GLOBAL_LIGHTS_BUFFER_SIZE,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    this.lightCount = 0;
  }
}

export class WebGPULightSystem extends System {
  nextByteOffset = 4 * Float32Array.BYTES_PER_ELEMENT;
  freedLights = [];

  init(gpu) {
    this.arrayBuffer = new ArrayBuffer(GLOBAL_LIGHTS_BUFFER_SIZE);
    this.ambientColor = new Float32Array(this.arrayBuffer, 0, 3);
    this.lightCount = new Uint32Array(this.arrayBuffer, 3 * Float32Array.BYTES_PER_ELEMENT, 1);
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
        this.lightCount[0]++;
        entity.add(new WebGPULight(this.arrayBuffer, this.nextByteOffset));
        this.nextByteOffset += LIGHT_BUFFER_SIZE;
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
    gpu.device.queue.writeBuffer(lights.buffer, 0, this.arrayBuffer);
    lights.lightCount = this.lightCount[0];
  }
}