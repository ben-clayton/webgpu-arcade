import { System, Tag } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';

import { Collider } from '../../../common/collision.js';
import { ImpactDamage } from '../../../common/impact-damage.js';
import { Health } from '../../../common/lifetime.js';
import { Points } from '../../../common/score.js';
import { Velocity } from '../../../common/velocity.js';

import { LightEnemy, LightEnemySystem } from './light-enemy.js';
import { MineEnemy, MineEnemySystem } from './mine-enemy.js';
import { quat } from 'gl-matrix';
import { BoundingVolume } from '../../../engine/core/bounding-volume.js';

const ENEMY_TAG = Tag('enemy');

const CW_90 = quat.create();
quat.rotateY(CW_90, CW_90, Math.PI / 2);
const CCW_90 = quat.create();
quat.rotateY(CCW_90, CCW_90, Math.PI / -2);

export class EnemySpawnerSystem extends System {
  nextSpawn = 0

  init(gpu, shipMeshes) {
    this.shipMeshes = shipMeshes;

    this.world.registerRenderSystem(LightEnemySystem);
    this.world.registerRenderSystem(MineEnemySystem);
  }

  execute(delta, time) {
    this.nextSpawn -= delta;
    if (this.nextSpawn <= 0) {
      const enemyX = Math.random() * 80 - 40;
      const enemyZ = -75;

      const enemyType = Math.floor(Math.random() * 6);
      switch(enemyType) {
        case 0:
          for (let i = 0; i < 5; ++i) {
            this.world.create(this.shipMeshes.Light,
              this.shipMeshes.Light.boundingVolume,
              ENEMY_TAG,
              new LightEnemy(),
              new Transform({ position: [enemyX, 0, enemyZ - (i * 8)] }),
              new Velocity([0, 0, 30]),
              new Collider(ENEMY_TAG),
              //new BoundingVolume({ radius: 2 }),
              new Health(3),
              new ImpactDamage(5),
              new Points(200)
            );
          }
          break;
        case 1:
          this.world.create(this.shipMeshes.MultiGun,
            this.shipMeshes.MultiGun.boundingVolume,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 20]),
            new Collider(ENEMY_TAG),
            //new BoundingVolume({ radius: 3 }),
            new Health(5),
            new ImpactDamage(10),
            new Points(500)
          );
          break;
        case 2:
          const direction = Math.floor(Math.random() * 2) ? -1 : 1;

          this.world.create(this.shipMeshes.Mine,
            this.shipMeshes.Mine.boundingVolume,
            ENEMY_TAG,
            new MineEnemy(),
            new Transform({
              position: [-70 * direction, 0, -60],
              orientation: direction > 0 ? CW_90 : CCW_90
            }),
            new Velocity([-10 * direction, 0, 15]),
            new Collider(ENEMY_TAG),
            //new BoundingVolume({ radius: 3 }),
            new Health(10),
            new ImpactDamage(10),
            new Points(800)
          );
          break;
        case 3:
          this.world.create(this.shipMeshes.Laser,
            this.shipMeshes.Laser.boundingVolume,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 15]),
            new Collider(ENEMY_TAG),
            //new BoundingVolume({ radius: 4 }),
            new Health(15),
            new ImpactDamage(10),
            new Points(1000)
          );
          break;
        case 4:
          this.world.create(this.shipMeshes.Missile,
            this.shipMeshes.Missile.boundingVolume,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 15]),
            new Collider(ENEMY_TAG),
            //new BoundingVolume({ radius: 3 }),
            new Health(20),
            new ImpactDamage(10),
            new Points(1200)
          );
          break;
        case 5:
          this.world.create(this.shipMeshes.Heavy,
            this.shipMeshes.Heavy.boundingVolume,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 12]),
            new Collider(ENEMY_TAG),
            //new BoundingVolume({ radius: 5.5 }),
            new Health(30),
            new ImpactDamage(20),
            new Points(2000)
          );
          break;
      }

      this.nextSpawn += (Math.random() * 2.0) + 1;
    }

    // Any enemies that pass off the bottom of the screen are destroyed.
    this.query(ENEMY_TAG, Transform).forEach((entity, enemy, transform) => {
      if (transform.position > 60) {
        entity.destroy();
      }
    });
  }
}