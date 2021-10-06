import { System } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';
import { BoundingVolume, BoundingVolumeType } from 'engine/core/bounding-volume.js';
import { vec3, mat4 } from 'gl-matrix';

export class Collider {
  constructor(...filter) {
    this.filter = filter;
  }
}

export class Collisions {
  entities = [];
}

const tmpVec = vec3.create();

class FrameCollider {
  constructor(entity, collider, bounds, transform) {
    this.entity = entity;
    this.filters = collider.filter;
    this.bounds = bounds;

    mat4.getScaling(tmpVec, transform.worldMatrix);
    const scale = Math.max(tmpVec[0], Math.max(tmpVec[1], tmpVec[2]));
    this.radiusSq = (bounds.radius * scale) * (bounds.radius * scale);

    this.worldPosition = vec3.create();
    transform.getWorldPosition(this.worldPosition, bounds.center);

    this.collisions = null;
    entity.remove(Collisions);
  }

  checkCollision(other) {
    // There's gotta be a faster way to handle this
    for (const filter of this.filters) {
      if (other.entity.has(filter)) {
        return;
      }
    }

    for (const filter of other.filters) {
      if (this.entity.has(filter)) {
        return;
      }
    }

    let sqrDist = vec3.sqrDist(this.worldPosition, other.worldPosition);
    if (sqrDist < this.radiusSq + other.radiusSq) {
      // TODO: Do a more precise check for AABB vs. AABB.
      if (this.bounds.type == BoundingVolumeType.AABB) {
        
      } else if (other.bounds.type == BoundingVolumeType.AABB) {
        
      }

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
    this.colliderQuery = this.query(Collider, BoundingVolume, Transform);
  }

  execute() {
    const allColliders = [];

    this.colliderQuery.forEach((entity, collider, bounds, transform) => {
      const frameCollider = new FrameCollider(entity, collider, bounds, transform);
      // TODO: You would fail your Silicon Valley job interview with this code.
      // I don't really care. Fix it if it becomes a problem.
      for (const otherCollider of allColliders) {
        frameCollider.checkCollision(otherCollider);
      }
      allColliders.push(frameCollider);
    });
  }
}