import { WebGPUSystem } from './webgpu-system.js';
import { mat4, vec3 } from 'gl-matrix';

import { Transform } from '../core/transform.js';
import { Camera } from '../core/camera.js';
import { LightBuffer } from '../core/light.js';

import { CAMERA_BUFFER_SIZE } from './wgsl/common.js';
import { CLUSTER_BOUNDS_SIZE, CLUSTER_LIGHTS_SIZE } from './wgsl/clustered-light.js';

export class WebGPUCamera {
  constructor(gpu, lightBuffer) {
    const device = gpu.device;

    this.arrayBuffer = new ArrayBuffer(CAMERA_BUFFER_SIZE);
    this.projection = new Float32Array(this.arrayBuffer, 0, 16);
    this.inverseProjection = new Float32Array(this.arrayBuffer, 16 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.view = new Float32Array(this.arrayBuffer, 32 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.position = new Float32Array(this.arrayBuffer, 48 * Float32Array.BYTES_PER_ELEMENT, 3);
    this.time = new Float32Array(this.arrayBuffer, 51 * Float32Array.BYTES_PER_ELEMENT, 1);
    this.outputSize = new Float32Array(this.arrayBuffer, 52 * Float32Array.BYTES_PER_ELEMENT, 2);
    this.zRange = new Float32Array(this.arrayBuffer, 54 * Float32Array.BYTES_PER_ELEMENT, 2);

    this.cameraBuffer = device.createBuffer({
      size: CAMERA_BUFFER_SIZE,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.clusterBoundsBuffer = device.createBuffer({
      size: CLUSTER_BOUNDS_SIZE,
      usage: GPUBufferUsage.STORAGE
    });

    this.clusterLightsBuffer = device.createBuffer({
      size: CLUSTER_LIGHTS_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.clusterBoundsBindGroup = device.createBindGroup({
      layout: gpu.bindGroupLayouts.clusterBounds,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.clusterBoundsBuffer,
        },
      }],
    });

    this.clusterLightsBindGroup = device.createBindGroup({
      layout: gpu.bindGroupLayouts.clusterLights,
      entries: [{
        binding: 0,
        resource: { buffer: this.cameraBuffer, },
      }, {
        binding: 1,
        resource: { buffer: this.clusterBoundsBuffer },
      }, {
        binding: 2,
        resource: { buffer: this.clusterLightsBuffer },
      }, {
        binding: 3,
        resource: { buffer: lightBuffer.gpuBuffer, },
      }],
    });

    this.bindGroup = gpu.device.createBindGroup({
      layout: gpu.bindGroupLayouts.frame,
      entries: [{
        binding: 0,
        resource: { buffer: this.cameraBuffer, },
      }, {
        binding: 1,
        resource: { buffer: lightBuffer.gpuBuffer, },
      }, {
        binding: 2,
        resource: { buffer: this.clusterLightsBuffer, },
      }, {
        binding: 3,
        resource: gpu.defaultSampler
      }],
    });
  }
}

export class WebGPUCameraSystem extends WebGPUSystem {
  execute(delta, time) {
    const gpu = this.world;

    // If a Camera does not have an associated WebGPUCamera add one.
    this.query(Camera).not(WebGPUCamera).forEach((entity) => {
      const lights = this.singleton.get(LightBuffer);
      entity.add(new WebGPUCamera(gpu, lights.buffer));
    });

    // If a WebGPUCamera has had it's Camera removed, also remove the WebGPUCamera.
    this.query(WebGPUCamera).not(Camera).forEach((entity) => {
      entity.remove(WebGPUCamera);
    });

    // Update the values for the WebGPUCamera every frame and write the values to the buffer.
    this.query(Camera, WebGPUCamera).forEach((entity, camera, gpuCamera) => {
      // Update the values for the WebGPU camera every frame and write the values to the buffer.
      const transform = entity.get(Transform);
      if (transform) {
        mat4.invert(gpuCamera.view, transform.worldMatrix);
        transform.getWorldPosition(gpuCamera.position);
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

      gpu.device.queue.writeBuffer(gpuCamera.cameraBuffer, 0, gpuCamera.arrayBuffer);
    });
  }
}