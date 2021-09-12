import { System } from 'toro/core/ecs.js';
import { Transform } from 'toro/core/transform.js';
import { vec3 } from 'gl-matrix';

export class Velocity {
  constructor(value) {
    this.velocity = value ? vec3.clone(value) : vec3.create();
    this.maxSpeed = 0;
  }
}

export class Acceleration {
  constructor(value) {
    this.acceleration = value ? vec3.clone(value) : vec3.create();
  }
}

export class VelocityAccelerationSystem extends System {
  init() {
    this.accelerationQuery = this.query(Velocity, Acceleration);
    this.velocityQuery = this.query(Velocity, Transform);
  }

  execute(delta, time) {
    this.accelerationQuery.forEach((entity, velocity, acceleration) => {
      vec3.scaleAndAdd(velocity.velocity, velocity.velocity, acceleration.acceleration, delta);
    });

    this.velocityQuery.forEach((entity, velocity, transform) => {
      if (velocity.maxSpeed > 0) {
        const speed = vec3.length(velocity.velocity);
        if (speed > velocity.maxSpeed) {
          vec3.scale(velocity.velocity, velocity.velocity, velocity.maxSpeed / speed);
        }
      }
      vec3.scaleAndAdd(transform.position, transform.position, velocity.velocity, delta);
    });
  }
}