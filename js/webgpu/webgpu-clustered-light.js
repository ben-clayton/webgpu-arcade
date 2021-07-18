// Lots of this is ported or otherwise influenced by http://www.aortiz.me/2018/12/21/CG.html and
// https://github.com/Angelo1211/HybridRenderingEngine

import { System } from 'ecs';
import { WebGPUCamera } from './webgpu-camera.js';
import {
  DISPATCH_SIZE, 
  ClusterBoundsSource,
  ClusterLightsSource
} from './wgsl/clustered-light.js';

const emptyArray = new Uint32Array(1);

export class WebGPUClusteredLights extends System {
  #outputSize = {width: 0, height: 0};

  init(gpu) {
    const device = gpu.device;

    // Cluster Bounds computation resources
    gpu.bindGroupLayouts.clusterBounds = device.createBindGroupLayout({
      label: `Cluster Storage Bind Group Layout`,
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }
      }]
    });

    device.createComputePipelineAsync({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.clusterBounds,
        ]
      }),
      compute: {
        module: device.createShaderModule({ code: ClusterBoundsSource, label: "Cluster Bounds" }),
        entryPoint: 'computeMain',
      }
    }).then((pipeline) => {
      this.boundsPipeline = pipeline;
    });

    // Cluster Lights computation resources
    gpu.bindGroupLayouts.clusterLights = device.createBindGroupLayout({
      label: `Cluster Bounds Bind Group Layout`,
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
      }, {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }
      }]
    });

    device.createComputePipelineAsync({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayouts.clusterLights,
        ]
      }),
      compute: {
        module: device.createShaderModule({ code: ClusterLightsSource, label: "Cluster Lights" }),
        entryPoint: 'computeMain',
      }
    }).then((pipeline) => {
      this.lightsPipeline = pipeline;
    });
  }

  updateClusterBounds(gpu, camera, passEncoder) {
    if (!this.boundsPipeline ||
      (this.#outputSize.width == gpu.size.width &&
      this.#outputSize.height == gpu.size.height)) {
      return;
    }

    this.#outputSize.width = gpu.size.width;
    this.#outputSize.height = gpu.size.height;

    passEncoder.setPipeline(this.boundsPipeline);
    passEncoder.setBindGroup(1, camera.clusterBoundsBindGroup);
    passEncoder.dispatch(...DISPATCH_SIZE);
  }

  updateClusterLights(gpu, frameBindings, passEncoder) {
    if (!this.clusterLightsPipeline) { return; }

    // Reset the light offset counter to 0 before populating the light clusters.
    device.queue.writeBuffer(camera.clusterLightsBuffer, 0, emptyArray);

    // Update the FrameUniforms buffer with the values that are used by every
    // program and don't change for the duration of the frame.
    passEncoder.setPipeline(this.lightsPipeline);
    passEncoder.setBindGroup(1, camera.clusterLightsBindGroup);
    passEncoder.dispatch(...DISPATCH_SIZE);
  }

  execute(delta, time) {
    const gpu = this.world;

    this.query(WebGPUCamera).forEach((entity, camera) => {
      const commandEncoder = gpu.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setBindGroup(0, camera.bindGroup);

      this.updateClusterBounds(gpu, camera, passEncoder);
      this.updateClusterLights(gpu, camera, passEncoder);

      passEncoder.endPass();

      gpu.device.queue.submit([commandEncoder.finish()]);
    });
    /*c*/
  }
}
