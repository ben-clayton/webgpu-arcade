import { System, Tag } from 'engine/core/ecs.js';
import { SphereGeometry } from 'engine/geometry/sphere.js';
import { UnlitMaterial } from 'engine/core/materials.js';
import { Mesh } from 'engine/core/mesh.js';
import { Transform } from 'engine/core/transform.js';

import { Velocity } from './velocity.js';
import { Lifetime, Health } from './lifetime.js';
import { ImpactDamage } from './impact-damage.js';
import { Collider } from './collision.js';
import { vec3, vec4 } from 'gl-matrix';
import { PointLight } from 'engine/core/light.js';

const FIRING_TAG = Tag('firing');
const tmpVec = vec3.create();

export class BulletFactory {
  constructor(gpu, options = {}) {
    this.speed = options.speed !== undefined ? options.speed : 120;
    this.lifetime = options.lifetime || 2;
    this.impactDamage = options.impactDamage || 1;
    this.radius = options.radius || 0.3;
    this.color = options.color || [1.0, 1.0, 0.8];
    this.filter = options.filter;

    const geometry = new SphereGeometry(gpu, this.radius, 12, 6);
    const material = new UnlitMaterial();
    material.baseColorFactor.set(this.color);
    this.bulletMesh = new Mesh({ geometry, material });
  }

  fireBullet(world, origin, destination) {
    let transform;
    let velocity;
    if (destination) {
      vec3.subtract(tmpVec, origin.position, destination.position);
      vec3.normalize(tmpVec, tmpVec);
      vec3.scale(tmpVec, tmpVec, -this.speed);

      transform = new Transform({ position: origin.position });
      velocity = new Velocity(tmpVec);
    } else {
      transform = new Transform({ matrix: origin.worldMatrix });
      velocity = new Velocity([0, 0, -this.speed]);
    }

    const bullet = world.create(
      this.bulletMesh,
      transform,
      velocity,
      new Lifetime(this.lifetime),
      new Health(1),
      new ImpactDamage(this.impactDamage, this.filter),
      new Collider(this.radius),
      new PointLight({ color: this.color, intensity: 10, range: 10 }),
    );

    return bullet;
  }
}

export class BasicWeapon {
  fire = false;
  cooldown = 0;

  constructor(options = {}) {
    this.filter = options.filter || null;
    this.transforms = options.transforms || [null];
  }
}

export class BasicWeaponSystem extends System {
  cooldown = 0.1;

  init(gpu) {
    this.weaponQuery = this.query(BasicWeapon);

    this.bulletFactory = new BulletFactory(gpu, {
      filter: Tag('player') // TODO: Should have been pulled from the weapon
    });
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
        this.bulletFactory.fireBullet(this.world, weaponTransform || origin)
          .add(Tag('player-bullet'));
      }
    });
  }
}