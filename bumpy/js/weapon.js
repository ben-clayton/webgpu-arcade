import { System, Tag } from 'toro/core/ecs.js';
import { SphereGeometry } from 'toro/geometry/sphere.js';
import { UnlitMaterial } from 'toro/core/materials.js';
import { Mesh } from 'toro/core/mesh.js';
import { Transform } from 'toro/core/transform.js';

import { Velocity } from './velocity.js';
import { Lifetime, Health } from './lifetime.js';
import { ImpactDamage } from './impact-damage.js';
import { Collider } from './collision.js';
import { vec3, vec4 } from 'gl-matrix';
import { PointLight } from 'toro/core/light.js';

const FIRING_TAG = Tag('firing');
const TMP_VELOCITY = vec4.create();

export class BasicWeapon {
  fire = false;
  cooldown = 0;
  //position = vec3.fromValues(0, 0, 1);
  //direction = vec3.fromValues(0, 0, 1);

  constructor(options = {}) {
    this.filter = options.filter || null;
    this.transforms = options.transforms || [null];
  }
}

export class BasicWeaponSystem extends System {
  cooldown = 0.1;
  speed = -120;
  lifetime = 2;
  impactDamage = 1;
  radius = 0.5;

  init(gpu) {
    this.weaponQuery = this.query(BasicWeapon);

    // Create the bullet mesh for this weapon
    const geometry = new SphereGeometry(gpu, this.radius, 12, 6);
    const material = new UnlitMaterial();
    material.baseColorFactor[0] = 1.0;
    material.baseColorFactor[1] = 1.0;
    material.baseColorFactor[2] = 0.8;
    this.bulletMesh = new Mesh({ geometry, material });
  }

  spawnBullet(origin, filter) {
    const transform = new Transform();
    vec4.set(TMP_VELOCITY, 0, 0, this.speed, 0);

    if (origin) {
      vec3.transformMat4(transform.position, transform.position, origin.worldMatrix);
      vec4.transformMat4(TMP_VELOCITY, TMP_VELOCITY, origin.worldMatrix);
    }

    const bullet = this.world.create(
      Tag('player-bullet'),
      this.bulletMesh,
      transform,
      new Velocity(TMP_VELOCITY),
      new Lifetime(this.lifetime),
      new Health(1),
      new ImpactDamage(this.impactDamage, filter),
      new Collider(this.radius),
      new PointLight({ color: [1.0, 1.0, 0.8], intensity: 10 })
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

      for (const weaponTransform of weapon.transforms) {
        this.spawnBullet(weaponTransform || origin, weapon.filter);
      }
    });
  }
}