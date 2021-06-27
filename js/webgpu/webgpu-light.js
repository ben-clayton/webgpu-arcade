import { System } from 'ecs';
import { vec3 } from 'gl-matrix';
import { AmbientLight, PointLight } from '../light.js';
import { Transform } from '../transform.js';

const LIGHT_FLOAT_SIZE = 8;

export class WebGPULight {
  constructor(buffer, byteOffset) {
    this.byteOffset = byteOffset;
    this.position = new Float32Array(buffer, byteOffset, 3);
    this.range = new Float32Array(buffer, byteOffset + 12, 1);
    this.color = new Float32Array(buffer, byteOffset + 16, 3);
    this.intensity = new Float32Array(buffer, byteOffset + 28, 1);
  }
}

export class WebGPULightSystem extends System {
  lightCapacity = 256;

  nextByteOffset = 0;
  freedLights = [];

  init(gpu) {
    this.array = new Float32Array(4 + this.lightCapacity * LIGHT_FLOAT_SIZE);
    const buffer = this.array.buffer;
    this.ambientColor = new Float32Array(buffer, 0, 3);
    this.lightCount = new Uint32Array(buffer, 3 * Float32Array.BYTES_PER_ELEMENT, 1);
    this.lightCount[0] = 0;
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
        this.nextByteOffset += LIGHT_FLOAT_SIZE * Float32Array.BYTES_PER_ELEMENT;
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
  }
}