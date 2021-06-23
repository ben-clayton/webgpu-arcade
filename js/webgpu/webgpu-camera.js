import { System } from 'ecs';
import { mat4, vec3 } from 'gl-matrix';

import { WebGPU } from './webgpu-components.js';
import { Camera } from '../camera.js';
import { Transform } from '../transform.js';

export const CameraUniformsSize = 224;
export const CameraUniforms = `
  [[block]] struct CameraUniforms {
    projection : mat4x4<f32>;
    inverseProjection : mat4x4<f32>;
    view : mat4x4<f32>;
    position : vec3<f32>;
    time : f32;
    outputSize : vec2<f32>;
    zNear : f32;
    zFar : f32;
  };
  [[group(0), binding(0)]] var<uniform> camera : CameraUniforms;
`;

export class WebGPUCamera {
  constructor(device) {
    this.array = new Float32Array(CameraUniformsSize / Float32Array.BYTES_PER_ELEMENT);
    this.projection = new Float32Array(this.array.buffer, 0, 16);
    this.inverseProjection = new Float32Array(this.array.buffer, 16 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.view = new Float32Array(this.array.buffer, 32 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.position = new Float32Array(this.array.buffer, 48 * Float32Array.BYTES_PER_ELEMENT, 3);
    this.time = new Float32Array(this.array.buffer, 51 * Float32Array.BYTES_PER_ELEMENT, 1);
    this.outputSize = new Float32Array(this.array.buffer, 52 * Float32Array.BYTES_PER_ELEMENT, 2);
    this.zRange = new Float32Array(this.array.buffer, 54 * Float32Array.BYTES_PER_ELEMENT, 2);

    this.buffer = device.createBuffer({
      size: this.array.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

    this.bindGroup = null; 
  }
}

/*export const LightUniforms = `
  struct Light {
    position : vec3<f32>;
    range : f32;
    color : vec3<f32>;
    intensity : f32;
  };

  [[block]] struct LightUniforms {
    ambient : vec3<f32>;
    lightCount : u32;
    lights : [[stride(32)]] array<Light>;
  };
  [[group(0), binding(1)]] var<storage> globalLights : [[access(read)]] LightUniforms;
`;*/

export class WebGPUCameraSystem extends System {
  createFrameBindGroup() {
    this.frameBindGroupLayout = gpu.device.createBindGroupLayout({
      label: 'Frame BindGroupLayout',
      entries: [{
        binding: 0, // Camera uniforms (Projection, View, etc.)
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: {},
      }, /*{
        binding: 1, // Light uniforms
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
      }, {
        binding: 2, // Cluster Lights storage
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }
      }*/]
    });

    this.frameBindGroupLayout = gpu.device.createBindGroup({
      label: 'Frame BindGroup',
      layout: this.frameBindGroupLayout,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.cameraBuffer,
        },
      }, /*{
        binding: 1,
        resource: {
          buffer: this.lightsBuffer,
        },
      }, {
        binding: 2,
        resource: {
          buffer: this.clusterLightsBuffer
        }
      }*/],
    });
  }

  execute(delta, time) {
    const gpu = this.singleton.get(WebGPU);
    if (!gpu) { return; }

    // If a Camera does not have an associated WebGPUCamera add one.
    this.query(Camera).not(WebGPUCamera).forEach((entity) => {
      entity.add(new WebGPUCamera(gpu.device));
    });

    // If a WebGPUCamera has had it's Camera removed, also remove the WebGPU camera.
    this.query(WebGPUCamera).not(Camera).forEach((entity) => {
      entity.remove(WebGPUCamera);
    });

    // Update the values for the WebGPU camera every frame and write the values to the buffer.
    this.query(Camera, WebGPUCamera).forEach((entity, camera, gpuCamera) => {
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