import { System, Tag } from 'toro/core/ecs.js';
import { Stage } from 'toro/core/stage.js';

const DEAD_TAG = Tag('dead');

export class Lifetime {
  constructor(value = 1) {
    this.lifetime = value;
  }
}

export class LifetimeSystem extends System {
  init() {
    this.lifetimeQuery = this.query(Lifetime);
  }

  execute(delta, time) {
    this.lifetimeQuery.forEach((entity, lifetime) => {
      lifetime.lifetime -= delta;
      if (lifetime.lifetime <= 0) {
        entity.add(DEAD_TAG);
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