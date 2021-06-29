//
// Camera
//

// Number of Float32 values in the camera buffer.
const CAMERA_ARRAY_SIZE = 56;

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

export class WebGPUCamera {
  constructor(gpu) {
    const device = gpu.device;
    this.array = new Float32Array(CAMERA_ARRAY_SIZE);
    const arrayBuffer = this.array.buffer;
    this.projection = new Float32Array(arrayBuffer, 0, 16);
    this.inverseProjection = new Float32Array(arrayBuffer, 16 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.view = new Float32Array(arrayBuffer, 32 * Float32Array.BYTES_PER_ELEMENT, 16);
    this.position = new Float32Array(arrayBuffer, 48 * Float32Array.BYTES_PER_ELEMENT, 3);
    this.time = new Float32Array(arrayBuffer, 51 * Float32Array.BYTES_PER_ELEMENT, 1);
    this.outputSize = new Float32Array(arrayBuffer, 52 * Float32Array.BYTES_PER_ELEMENT, 2);
    this.zRange = new Float32Array(arrayBuffer, 54 * Float32Array.BYTES_PER_ELEMENT, 2);

    this.buffer = device.createBuffer({
      size: arrayBuffer.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
  }
}

//
// Clustered Lights
//

export const TILE_COUNT = [32, 18, 48];
export const TOTAL_TILES = TILE_COUNT[0] * TILE_COUNT[1] * TILE_COUNT[2];

// Each cluster tracks up to MAX_LIGHTS_PER_CLUSTER light indices (ints) and one light count.
// This limitation should be able to go away when we have atomic methods in WGSL.
export const MAX_LIGHTS_PER_CLUSTER = 256;
export const MAX_CLUSTERED_LIGHTS = TOTAL_TILES * 64;
export const CLUSTER_LIGHTS_SIZE = (8 * TOTAL_TILES) + (4 * MAX_CLUSTERED_LIGHTS) + 4;

export function ClusterStruct(group, binding, access = 'read') { return `
  struct ClusterBounds {
    minAABB : vec3<f32>;
    maxAABB : vec3<f32>;
  };
  [[block]] struct Clusters {
    bounds : [[stride(32)]] array<ClusterBounds, ${TOTAL_TILES}>;
  };
  [[group(${group}), binding(${binding})]] var<storage, ${access}> clusters : Clusters;
`;
}

export function ClusterLightsStruct(group, binding, access='read') { return `
  struct ClusterLights {
    offset : u32;
    count : u32;
  };
  [[block]] struct ClusterLightGroup {
    offset : atomic<u32>;
    lights : [[stride(8)]] array<ClusterLights, ${TOTAL_TILES}>;
    indices : [[stride(4)]] array<u32, ${MAX_CLUSTERED_LIGHTS}>;
  };
  [[group(${group}), binding(${binding})]] var<storage, ${access}> clusterLights : ClusterLightGroup;
`;
}

export class WebGPUClusteredLights {
  constructor(gpu) {
    const device = gpu.device;

    this.boundsBuffer = device.createBuffer({
      size: TOTAL_TILES * 32, // Cluster x, y, z size * 32 bytes per cluster.
      usage: GPUBufferUsage.STORAGE
    });

    this.lightsBuffer = device.createBuffer({
      size: CLUSTER_LIGHTS_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.boundsBindGroup = device.createBindGroup({
      layout: gpu.bindGroupLayouts.clusterBounds,
      entries: [{
        binding: 0,
        resource: {
          buffer: this.boundsBuffer,
        },
      }],
    });

    this.lightsBindGroup = device.createBindGroup({
      layout: gpu.bindGroupLayouts.clusterLights,
      entries: [{
        binding: 0,
        resource: { buffer: this.boundsBuffer },
      }, {
        binding: 1,
        resource: { buffer: this.lightsBuffer },
      }],
    });
  }
}