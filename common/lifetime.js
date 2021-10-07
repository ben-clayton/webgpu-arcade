import { System, Tag } from 'engine/core/ecs.js';
import { Stage } from 'engine/core/stage.js';
import { Transform } from 'engine/core/transform.js';
import { TrailParticleEmitter, SpriteParticleEmitter } from '../../engine/core/particle.js';

const DEAD_TAG = Tag('dead');

export class Lifetime {
  constructor(value = 1) {
    this.lifetime = value;
  }
}

export class Health {
  constructor(value = 1) {
    this.health = value;
  }
}

export class LifetimeHealthSystem extends System {
  init() {
    this.lifetimeQuery = this.query(Lifetime);
    this.healthQuery = this.query(Health);
  }

  execute(delta) {
    this.lifetimeQuery.forEach((entity, lifetime) => {
      lifetime.lifetime -= delta;
      if (lifetime.lifetime <= 0) {
        entity.add(DEAD_TAG);
      }
    });

    this.healthQuery.forEach((entity, health) => {
      if (health.health <= 0) {
        entity.add(DEAD_TAG);

        this.world.create(
          entity.get(Transform),
          new Lifetime(3.0),
          new TrailParticleEmitter({
            num_particles: 128,
            max_particles: 128,
            spawn_rate: 300,
            spawn_radius: 2,
            spread: 1.0,
            speed_from: 10,
            speed_to: 50,
            particle_life_from: 0.1,
            particle_life_to: 0.8,
            particle_size_start: 0.1,
            particle_size_end: 0.3,
            particle_alpha_start: 1.0,
            particle_alpha_end: 0.0,
            gravity: 80,
            global_velocity: [0, 0, 10],
          }),
          new SpriteParticleEmitter({
            num_particles: 256,
            max_particles: 256,
            spawn_rate: 300,
            spawn_radius: 3,
            spread: 1.0,
            speed_from: 5,
            speed_to: 25,
            particle_life_from: 0.1,
            particle_life_to: 0.8,
            particle_size_start: 0.1,
            particle_size_end: 0.3,
            particle_alpha_start: 1.0,
            particle_alpha_end: 0.0,
            gravity: 80,
            global_velocity: [0, 0, 10],
          }),
        );
      }
    });
  }
}

// Remove any entities tagged as 'dead' at the very end of the frame.
export class DeadSystem extends System {
  stage = Stage.Last;

  init() {
    this.deadQuery = this.query(DEAD_TAG);
  }

  execute() {
    this.deadQuery.forEach((entity) => {
      entity.destroy();
    });
  }
}