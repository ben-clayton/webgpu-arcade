import { System } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';
import { vec3 } from 'gl-matrix';

export class Collider {
  constructor(radius) {
    this.radius = radius;
  }
}

export class Collisions {
  entities = [];
}

class FrameCollider {
  constructor(entity, collider, transform) {
    this.entity = entity;
    this.radiusSq = collider.radius * collider.radius;
    this.worldPosition = vec3.create();
    transform.getWorldPosition(this.worldPosition);

    this.collisions = null;
    entity.remove(Collisions);
  }

  checkCollision(other) {
    let sqrDist = vec3.sqrDist(this.worldPosition, other.worldPosition);
    if (sqrDist < this.radiusSq + other.radiusSq) {
      // Collision detected!
      if (!this.collisions) {
        this.collisions = new Collisions();
        this.entity.add(this.collisions);
      }
      this.collisions.entities.push(other.entity);

      if (!other.collisions) {
        other.collisions = new Collisions();
        other.entity.add(other.collisions);
      }
      other.collisions.entities.push(this.entity);
    }
  }
}

export class CollisionSystem extends System {
  init() {
    this.colliderQuery = this.query(Collider, Transform);
  }

  execute() {
    const allColliders = [];

    this.colliderQuery.forEach((entity, collider, transform) => {
      const frameCollider = new FrameCollider(entity, collider, transform);
      // TODO: You would fail your Silicon Valley job interview with this code.
      // I don't really care. Fix it if it becomes a problem.
      for (const otherCollider of allColliders) {
        frameCollider.checkCollision(otherCollider);
      }
      allColliders.push(frameCollider);
    });
  }
}