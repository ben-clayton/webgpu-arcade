import { System, Tag } from 'toro/core/ecs.js';
import { SphereGeometry } from 'toro/geometry/sphere.js';
import { UnlitMaterial } from 'toro/core/materials.js';
import { Mesh } from 'toro/core/mesh.js';
import { Transform } from 'toro/core/transform.js';

import { Velocity } from './velocity.js';
import { Lifetime, Health } from './lifetime.js';
import { ImpactDamage } from './impact-damage.js';
import { Collider } from './collision.js';

const FIRING_TAG = Tag('firing');

export class BasicWeapon {
  fire = false;
  cooldown = 0;
  //position = vec3.fromValues(0, 0, 1);
  //direction = vec3.fromValues(0, 0, 1);
}

export class BasicWeaponSystem extends System {
  cooldown = 0.1;
  velocity = [0, 0, -120];
  lifetime = 2;
  impactDamage = 1;

  init(gpu) {
    this.weaponQuery = this.query(BasicWeapon);

    // Create the bullet mesh for this weapon
    const geometry = new SphereGeometry(gpu, 0.5, 12, 6);
    const material = new UnlitMaterial();
    material.baseColorFactor[0] = 1.0;
    material.baseColorFactor[1] = 1.0;
    material.baseColorFactor[2] = 0.8;
    this.bulletMesh = new Mesh({ geometry, material });
  }

  spawnBullet(origin) {
    const bullet = this.world.create(
      Tag('player-bullet'),
      this.bulletMesh,
      new Transform({ transform: origin }),
      new Velocity(this.velocity),
      new Lifetime(this.lifetime),
      new Health(1),
      new ImpactDamage(this.impactDamage, Tag('player')),
      new Collider(0.5)
    );

    return bullet;
  }

  execute(delta, time) {
    this.weaponQuery.forEach((entity, weapon) => {
      if (entity.has(FIRING_TAG)) {
        weapon.fire = true;
      }
      
      // Don't do anything if the weapon is still cooling down.
      if (weapon.cooldown > 0) {
        weapon.cooldown -= delta;
        return;
      }

      // If the weapon hasn't currently been set to fire, return.
      if (!weapon.fire) { return; }

      weapon.cooldown = this.cooldown;
      weapon.fire = false;

      const origin = entity.get(Transform);
      this.spawnBullet(origin);
    });
  }
}