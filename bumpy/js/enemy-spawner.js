import { System, Tag } from 'toro/core/ecs.js';
import { Transform } from 'toro/core/transform.js';
import { Collider } from './collision.js';
import { ImpactDamage } from './impact-damage.js';
import { Health } from './lifetime.js';
import { Points } from './score.js';
import { Velocity } from './velocity.js';

const ENEMY_TAG = Tag('enemy');

export class EnemySpawnerSystem extends System {
  nextSpawn = 0

  init(gpu, shipMeshes) {
    this.shipMeshes = shipMeshes;
  }

  execute(delta, time) {
    this.nextSpawn -= delta;
    if (this.nextSpawn <= 0) {
      const enemyX = Math.random() * 80 - 40;
      const enemyZ = -75;

      const enemyType = Math.floor(Math.random() * 5);
      switch(enemyType) {
        case 0:
          for (let i = 0; i < 5; ++i) {
            this.world.create(this.shipMeshes.Light,
              ENEMY_TAG,
              new Transform({ position: [enemyX, 0, enemyZ - (i * 7)] }),
              new Velocity([0, 0, 30]),
              new Collider(2),
              new Health(3),
              new ImpactDamage(5, ENEMY_TAG),
              new Points(200)
            );
          }
          break;
        case 1:
          this.world.create(this.shipMeshes.MultiGun,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 20]),
            new Collider(3),
            new Health(5),
            new ImpactDamage(10, ENEMY_TAG),
            new Points(500)
          );
          break;
        case 2:
          this.world.create(this.shipMeshes.Mine,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 20]),
            new Collider(3),
            new Health(10),
            new ImpactDamage(10, ENEMY_TAG),
            new Points(800)
          );
          break;
        case 3:
          this.world.create(this.shipMeshes.Laser,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 15]),
            new Collider(3),
            new Health(15),
            new ImpactDamage(10, ENEMY_TAG),
            new Points(1000)
          );
          break;
        case 4:
          this.world.create(this.shipMeshes.Missile,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 15]),
            new Collider(3),
            new Health(20),
            new ImpactDamage(10, ENEMY_TAG),
            new Points(1200)
          );
          break;
        case 5:
          this.world.create(this.shipMeshes.Heavy,
            ENEMY_TAG,
            new Transform({ position: [enemyX, 0, enemyZ] }),
            new Velocity([0, 0, 10]),
            new Collider(3),
            new Health(30),
            new ImpactDamage(20, ENEMY_TAG),
            new Points(2000)
          );
          break;
      }

      this.nextSpawn += (Math.random() * 2.0) + 0.5;
    }

    // Any enemies that pass off the bottom of the screen are destroyed.
    this.query(ENEMY_TAG, Transform).forEach((entity, enemy, transform) => {
      if (transform.position > 60) {
        entity.destroy();
      }
    });
  }
}