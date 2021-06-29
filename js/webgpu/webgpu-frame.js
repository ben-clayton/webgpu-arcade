import { System } from 'ecs';
import { mat4, vec3 } from 'gl-matrix';

import { Transform } from '../transform.js';
import { Camera } from '../camera.js';
import { WebGPU } from './webgpu-components.js';
import { WebGPUCamera, WebGPUClusteredLights } from './webgpu-frame-components.js';
import { WebGPULightBuffer } from './webgpu-light.js';

export class WebGPUFrameBindings {
  constructor(gpu, lights) {
    this.camera = new WebGPUCamera(gpu);
    this.cluster = new WebGPUClusteredLights(gpu);

    this.bindGroup = gpu.device.createBindGroup({
      layout: gpu.bindGroupLayouts.frame,
      entries: [{
        binding: 0,
        resource: { buffer: this.camera.buffer, },
      }, {
        binding: 1,
        resource: { buffer: lights.buffer, },
      }, {
        binding: 2,
        resource: { buffer: this.cluster.lightsBuffer, },
      }],
    });
  }
}

export class WebGPUFrameSystem extends System {
  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);

    // If a Camera does not have an associated WebGPUFrameBindings add one.
    this.query(Camera).not(WebGPUFrameBindings).forEach((entity) => {
      const lights = this.singleton.get(WebGPULightBuffer);
      entity.add(new WebGPUFrameBindings(gpu, lights));
    });

    // If a WebGPUFrameBindings has had it's Camera removed, also remove the WebGPUFrameBindings.
    this.query(WebGPUFrameBindings).not(Camera).forEach((entity) => {
      entity.remove(WebGPUFrameBindings);
    });

    // Update the values for the WebGPUCamera every frame and write the values to the buffer.
    this.query(Camera, WebGPUFrameBindings).forEach((entity, camera, frameBindings) => {
      const gpuCamera = frameBindings.camera;

      // Update the values for the WebGPU camera every frame and write the values to the buffer.
      const transform = entity.get(Transform);
      if (transform) {
        mat4.invert(gpuCamera.view, transform.matrix);
        vec3.copy(gpuCamera.position, transform.position);
      } else {
        // If the camera doesn't have a transform position it at the origin.
        mat4.identity(gpuCamera.view);
        vec3.set(gpuCamera.position, 0, 0, 0);
      }
      
      const aspect = gpu.size.width / gpu.size.height;
      mat4.perspectiveZO(gpuCamera.projection, camera.fieldOfView, aspect,
        camera.zNear, camera.zFar);
      mat4.invert(gpuCamera.inverseProjection, gpuCamera.projection);

      gpuCamera.time[0] = time;
      gpuCamera.outputSize[0] = gpu.size.width;
      gpuCamera.outputSize[1] = gpu.size.height;
      gpuCamera.zRange[0] = camera.zNear;
      gpuCamera.zRange[1] = camera.zFar;

      gpu.device.queue.writeBuffer(gpuCamera.buffer, 0, gpuCamera.array);
    });
  }
}