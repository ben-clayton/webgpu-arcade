import { System, Tag } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';

import { vec3, quat } from 'gl-matrix';

const IDENTITY_QUAT = quat.create();

export class Physics2DBody {
  world = null;
  refCount = 0;

  constructor(type, ...args) {
    this.body = Matter.Bodies[type](...args);
  }

  addedToEntity() {
    this.refCount++;
  }

  removedFromEntity(entity) {
    this.refCount--;
    if (this.refCount == 0 && this.world) {
      Matter.Composite.remove(this.world, this.body);
    }
  }
}

export class Physics2DSystem extends System {
  init(gpu) {
    this.engine = Matter.Engine.create({ gravity: { scale: 1, x: 0, y: 0 } });
    Matter.Resolver._restingThresh = 0.001;

    this.bodyQuery = this.query(Physics2DBody);
  }

  execute(delta, time) {
    Matter.Engine.update(this.engine, delta);

    this.bodyQuery.forEach((entity, body) => {
      // Add the physics body to the physics world if it isn't already.
      if (!body.world) {
        Matter.Composite.add(this.engine.world, body.body);
        body.world = this.engine.world;
      }

      // Sync up the object transform with the physics body
      let transform = entity.get(Transform);
      if (!transform) {
        transform = new Transform();
        entity.add(transform);
      }
      vec3.set(transform.position, body.body.position.x, body.body.position.y, transform.position[2]);
      quat.rotateZ(transform.orientation, IDENTITY_QUAT, body.body.angle);
    });
  }
}