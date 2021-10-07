import { System } from './ecs.js';

export class ParticleEmitterBase {
  color = new Float32Array(4);
  global_velocity = new Float32Array(3);

  constructor(options) {
    this.color.set(options?.color || [1, 1, 1, 1]);
    this.num_particles = options?.num_particles || 64;
    this.max_particles = options?.max_particles || 0;
    this.spawn_rate = options?.spawn_rate || 32.0;
    this.particle_size_start = options?.particle_size_start || 0.1;
    this.particle_size_end = options?.particle_size_end || 0.2;
    this.particle_alpha_start = options?.particle_alpha_start || 1.0;
    this.particle_alpha_end = options?.particle_alpha_end || 0.0;
    this.particle_life_from = options?.particle_life_from || 1.0;
    this.particle_life_to = options?.particle_life_to || 1.0;
    this.spawn_radius = options?.spawn_radius || 0.0;
    this.speed_from = options?.speed_from || 5;
    this.speed_to = options?.speed_to || 7;
    this.spread = options?.spread || 1.0;
    this.gravity = options?.gravity || 10.0;
    this.attractor = options?.attractor || null;
    this.attractor_strength = options?.attractor_strength || 1.0;
    this.global_velocity.set(options?.global_velocity || [0, 0, 0]);
  }
}

export class SpriteParticleEmitter extends ParticleEmitterBase {
  constructor(options) {
    super(options);
  }
}

export class TrailParticleEmitter extends ParticleEmitterBase {
  constructor(options) {
    super(options);
  }
}

export class ParticleSystem extends System {
  init(gpu) {
    this.spriteEmitterQuery = this.query(SpriteParticleEmitter);
    this.trailEmitterQuery = this.query(TrailParticleEmitter);
  }

  execute(delta, time, gpu) {
  }

  forEach(callback) {

    this.spriteEmitterQuery.forEach(callback);
    this.trailEmitterQuery.forEach(callback);
  }
}
