import { System } from 'toro/core/ecs.js';
import { Collisions } from './collision.js';
import { Health } from './lifetime.js';

export class ImpactDamage {
  constructor(value = 1, filter = null) {
    this.damage = value;
    this.filter = filter;
  }
}

export class ImpactDamageSystem extends System {
  init() {
    this.impactDamageQuery = this.query(ImpactDamage, Collisions);
  }

  execute() {
    this.impactDamageQuery.forEach((entity, damage, collisions) => {
      for (const colliderEntity of collisions.entities) {
        if (damage.filter && colliderEntity.has(damage.filter)) {
          continue;
        }

        const colliderHealth = colliderEntity.get(Health);
        if (colliderHealth) {
          colliderHealth.health -= damage.damage;
        }
      }
    });
  }
}
