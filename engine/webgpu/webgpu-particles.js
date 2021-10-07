import { WebGPUSystem } from './webgpu-system.js';
import {
  ParticleVertexSource,
  ParticleFragmentSource,
  SpriteParticleSimulationSource,
  TrailParticleSimulationSource,
  SIMULATION_UNIFORM_BUFFER_SIZE,
  SIMULATION_WORKGROUP_SIZE
} from './wgsl/particle.js';
import { WebGPUComputePass } from './webgpu-compute-pass.js';
import { WebGPURenderPass } from './webgpu-render-pass.js';
import { Entity } from '../core/ecs.js';
import { Transform } from '../core/transform.js';
import { ParticleSystem, SpriteParticleEmitter, TrailParticleEmitter } from '../core/particle.js';
import { mat4, vec3 } from 'gl-matrix';

const kIndexBufferSize = 1024 * 1024 * 10;
const kVertexBufferSize = 1024 * 1024 * 10;
const kDrawDataBufferSize = 64;

class WebGPUParticleEmitterData {
  particleBuffer = null;
  uniformBuffer = null;
  bindGroup = null;
  numParticles = 0;
  numSpawned = 0;
  timeSinceLastSpawn = 0;
};

export class WebGPUParticleComputePass extends WebGPUComputePass {
  emitterData = new Map();

  constructor(gpu, indexBuffer, vertexBuffer, drawDataBuffer, particleSystem) {
    super();

    this.gpu = gpu;
    this.particleSystem = particleSystem;
    this.indexBuffer = indexBuffer;
    this.vertexBuffer = vertexBuffer;
    this.drawDataBuffer = drawDataBuffer;

    const device = gpu.device;

    this.simulationLayout = device.createBindGroupLayout({
      label: `Particle Simulation Data BindGroupLayout`,
      entries: [{
        binding: 0, // DrawData
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      }, {
        binding: 1, // VertexBuffer
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      }, {
        binding: 2, // IndexBuffer
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      }, {
        binding: 3, // Particles
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      }, {
        binding: 4, // Simulation
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      }]
    });

    this.spriteSimulationPipeline = device.createComputePipeline({
      label: 'Particle Sprite Simulation Pipeline',
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          this.simulationLayout,
        ]
      }),
      compute: {
        module: device.createShaderModule({
          label: 'Particle Sprite Simulation',
          code: SpriteParticleSimulationSource,
        }),
        entryPoint: 'main',
      },
    });

    this.trailSimulationPipeline = device.createComputePipeline({
      label: 'Particle Trail Simulation Pipeline',
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          this.simulationLayout,
        ]
      }),
      compute: {
        module: device.createShaderModule({
          label: 'Particle Trail Simulation',
          code: TrailParticleSimulationSource,
        }),
        entryPoint: 'main',
      },
    });
  }

  createEmitterParticleBuffer(emitter) {
    return this.gpu.device.createBuffer({
      size: emitter.num_particles * 128, // TODO: Properly calculate
      usage: GPUBufferUsage.STORAGE,
    });
  }

  createEmitterUniformBuffer(emitter) {
    return this.gpu.device.createBuffer({
      size: SIMULATION_UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  createEmitterBindGroup(particleBuffer, uniformBuffer) {
    return this.gpu.device.createBindGroup({
      label: `Particle Simulation BindGroup`,
      layout: this.simulationLayout,
      entries: [
        { binding: 0, resource: { buffer: this.drawDataBuffer, }, },
        { binding: 1, resource: { buffer: this.vertexBuffer, }, },
        { binding: 2, resource: { buffer: this.indexBuffer, }, },
        { binding: 3, resource: { buffer: particleBuffer, }, },
        { binding: 4, resource: { buffer: uniformBuffer, }, },
      ],
    });
  }

  run(passEncoder, camera) {
    this.gpu.device.queue.writeBuffer(this.drawDataBuffer, 0, new Uint32Array([
      0, // index_count
      1, // instance_count
      0, // first_index
      0, // base_vertex
      0, // ignore
      0, // vertex_count
    ]));

    const dead = new Set(this.emitterData.keys());

    console.log("num emitters:", dead.size);

    this.particleSystem.forEach((entity, emitter) => {
      dead.delete(emitter);

      let delta_time = 1.0 / 60.0;

      var data = this.emitterData.get(emitter);
      if (data === undefined || data.numParticles < emitter.num_particles) {
        data = new WebGPUParticleEmitterData();
        data.particleBuffer = this.createEmitterParticleBuffer(emitter);
        data.uniformBuffer = this.createEmitterUniformBuffer(emitter);
        data.bindGroup = this.createEmitterBindGroup(data.particleBuffer, data.uniformBuffer);
        data.numParticles = emitter.num_particles;
        this.emitterData.set(emitter, data);
      }

      const matrixOf = function (entity) {
        const transform = entity.get(Transform);
        if (transform) {
          return transform.worldMatrix;
        }
        const matrix = new Float32Array(16);
        mat4.identity(matrix);
        return matrix;
      };

      const ubo = new Float32Array(SIMULATION_UNIFORM_BUFFER_SIZE / 4);
      var offset = 0;

      const ubo_f = (count = 1) => {
        const arr = new Float32Array(ubo.buffer, offset * 4, count);
        offset += count;
        return arr;
      }
      const ubo_i = (count = 1) => {
        const arr = new Int32Array(ubo.buffer, offset * 4, count);
        offset += count;
        return arr;
      }

      data.timeSinceLastSpawn += delta_time;
      var num_to_spawn = Math.floor(data.timeSinceLastSpawn * emitter.spawn_rate);
      data.timeSinceLastSpawn -= Math.min(data.timeSinceLastSpawn, num_to_spawn * emitter.spawn_rate);

      if (emitter.max_particles > 0) {
        num_to_spawn = Math.min(data.numSpawned + num_to_spawn, emitter.max_particles) - data.numSpawned;
      }
      data.numSpawned += num_to_spawn;

      ubo[offset++] = Math.random();  // rand_seed.x
      ubo[offset++] = Math.random();  // rand_seed.y
      ubo_i()[0] = emitter.num_particles;
      ubo_i()[0] = num_to_spawn;
      ubo[offset++] = delta_time
      ubo[offset++] = emitter.particle_size_start;
      ubo[offset++] = emitter.particle_size_end;
      ubo[offset++] = emitter.particle_alpha_start;
      ubo[offset++] = emitter.particle_alpha_end;
      ubo[offset++] = emitter.spawn_radius;
      ubo[offset++] = emitter.particle_life_from;
      ubo[offset++] = emitter.particle_life_to;
      mat4.copy(ubo_f(16), matrixOf(entity));
      ubo[offset++] = emitter.speed_from;
      ubo[offset++] = emitter.speed_to;
      ubo[offset++] = emitter.spread;
      ubo[offset++] = emitter.gravity;

      const attractor = ubo_f(4);
      if (emitter.attractor) {
        if (emitter.attractor instanceof Float32Array) {
          vec3.copy(attractor, emitter.attractor);
          attractor[3] = emitter.attractor_strength;
        } else if (emitter.attractor instanceof Entity) {
          mat4.getTranslation(attractor, matrixOf(emitter.attractor));
          attractor[3] = emitter.attractor_strength;
        }
      }

      vec3.copy(ubo_f(16), emitter.global_velocity);

      this.gpu.device.queue.writeBuffer(data.uniformBuffer, 0, ubo);

      if (emitter instanceof SpriteParticleEmitter) {
        passEncoder.setPipeline(this.spriteSimulationPipeline);
      } else if (emitter instanceof TrailParticleEmitter) {
        passEncoder.setPipeline(this.trailSimulationPipeline);
      } else {
        throw new Exception("unknown emitter type");
      }
      passEncoder.setBindGroup(0, camera.bindGroup);
      passEncoder.setBindGroup(1, data.bindGroup);
      passEncoder.dispatch((emitter.num_particles + SIMULATION_WORKGROUP_SIZE - 1) / SIMULATION_WORKGROUP_SIZE);
    });

    dead.forEach(emitter => {
      const data = this.emitterData.get(emitter);
      data.particleBuffer.destroy();
      data.uniformBuffer.destroy();
      this.emitterData.delete(emitter)
    });
  }
};

export class WebGPUParticleRenderPass extends WebGPURenderPass {
  constructor(gpu, indexBuffer, vertexBuffer, drawDataBuffer) {
    super();

    this.gpu = gpu;
    this.indexBuffer = indexBuffer;
    this.vertexBuffer = vertexBuffer;
    this.drawDataBuffer = drawDataBuffer;

    const device = gpu.device;

    const vertexModule = device.createShaderModule({
      label: 'Particle Vertex',
      code: ParticleVertexSource,
    });
    const fragmentModule = device.createShaderModule({
      label: 'Particle Fragment',
      code: ParticleFragmentSource,
    });
    this.drawPipeline = device.createRenderPipeline({
      label: `Particle Pipeline`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
        ]
      }),
      vertex: {
        module: vertexModule,
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 8 * 4,
            stepMode: 'vertex',
            attributes: [
              {  // vertex position
                shaderLocation: 0,
                offset: 0,
                format: 'float32x4',
              },
              {  // vertex uv
                shaderLocation: 1,
                offset: 4 * 4,
                format: 'float32x2',
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'main',
        targets: [{
          format: gpu.renderTargets.format,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one",
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32'
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less',
        format: gpu.renderTargets.depthFormat,
      },
      multisample: {
        count: gpu.renderTargets.sampleCount,
      }
    });
  }

  render(passEncoder, camera) {
    passEncoder.setPipeline(this.drawPipeline);
    passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setBindGroup(0, camera.bindGroup);
    passEncoder.drawIndexedIndirect(this.drawDataBuffer, 0);
  }
};

export class WebGPUParticleSystem extends WebGPUSystem {
  init(gpu) {
    const device = gpu.device;
    const indexBuffer = device.createBuffer({
      size: kIndexBufferSize,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE,
    });
    const vertexBuffer = device.createBuffer({
      size: kVertexBufferSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    });
    const drawDataBuffer = device.createBuffer({
      size: kDrawDataBufferSize,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const particleSystem = this.world.getSystem(ParticleSystem);

    gpu.addComputePass(new WebGPUParticleComputePass(gpu, indexBuffer, vertexBuffer, drawDataBuffer, particleSystem));
    gpu.addRenderPass(new WebGPUParticleRenderPass(gpu, indexBuffer, vertexBuffer, drawDataBuffer));
  }
};
