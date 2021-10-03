import { quat, vec3 } from 'gl-matrix';
import { System, Tag } from 'toro/core/ecs.js';
import { Transform } from 'toro/core/transform.js';
import { Velocity } from '../velocity.js';
import { BulletFactory } from '../weapon.js';

const tmpTransform = new Transform();
const MINE_COOLDOWN = 1.5;

const MINE_SPREAD_COUNT = 6;
const MINE_SPREAD_RADIUS = 3;
const MINE_OFFSETS = [];

for (let i = 0; i < MINE_SPREAD_COUNT; ++i) {
  const t = (Math.PI * 2 / MINE_SPREAD_COUNT) * i;
  const x = Math.sin(t) * MINE_SPREAD_RADIUS;
  const z = Math.cos(t) * MINE_SPREAD_RADIUS;

  MINE_OFFSETS.push([x, 0, z]);
}

export class MineEnemy {
  mineCooldown = MINE_COOLDOWN;
}

export class MineEnemySystem extends System {
  init(gpu) {
    this.mineEnemyQuery = this.query(MineEnemy, Transform);

    this.bulletFactory = new BulletFactory(gpu, {
      speed: -10,
      radius: 0.6,
      lifetime: 10,
      color: [1.0, 0.2, 0.2],
      filter: Tag('enemy')
    });
  }

  execute(delta, time) {
    this.mineEnemyQuery.forEach((entity, lightEnemy, transform) => {
      // Fire a shot towards the 
      lightEnemy.mineCooldown -= delta;
      if (lightEnemy.mineCooldown <= 0) {
        lightEnemy.mineCooldown += MINE_COOLDOWN;

        for (const offset of MINE_OFFSETS) {
          vec3.add(tmpTransform.position, transform.position, offset);
          this.bulletFactory.fireBullet(this.world, tmpTransform)
            .add(Tag('enemy'));
        }
      }
    });
  }
}