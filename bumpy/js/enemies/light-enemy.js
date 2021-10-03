import { quat, vec3 } from 'gl-matrix';
import { System, Tag } from 'toro/core/ecs.js';
import { Transform } from 'toro/core/transform.js';
import { SphereGeometry } from 'toro/geometry/sphere.js';
import { UnlitMaterial } from 'toro/core/materials.js';
import { Mesh } from 'toro/core/mesh.js';
import { Collider } from '../collision.js';
import { ImpactDamage } from '../impact-damage.js';
import { Lifetime, Health } from '../lifetime.js';
import { Velocity } from '../velocity.js';
import { PointLight } from 'toro/core/light.js';

const LightEnemyState = {
  ADVANCING: 0,
  TURNING: 1,
  RETREATING: 2,
};

const TURN_TIME = 1;
const tmpVec = vec3.create();

export class LightEnemy {
  state = LightEnemyState.ADVANCING;
  initialOrientation;
  turnAmount = TURN_TIME;
  turnDirection = 1;
  nextShot = Math.random() * 6 + 3;
}

export class LightEnemySystem extends System {
  init(gpu) {
    this.playerQuery = this.query(Tag('player'), Transform);
    this.lightEnemyQuery = this.query(LightEnemy, Transform, Velocity);

    const geometry = new SphereGeometry(gpu, 0.4, 12, 6);
    const material = new UnlitMaterial();
    material.baseColorFactor[0] = 1.0;
    material.baseColorFactor[1] = 0.8;
    material.baseColorFactor[2] = 1.0;
    this.bulletMesh = new Mesh({ geometry, material });
  }

  execute(delta, time) {
    let playerTransform;

    this.playerQuery.forEach((entity, player, transform) => {
      playerTransform = transform;
      // Only handle one player, because there should only be one.
      return false;
    });

    this.lightEnemyQuery.forEach((entity, lightEnemy, transform, velocity) => {
      if (!lightEnemy.initialOrientation) {
        lightEnemy.initialOrientation = quat.clone(transform.orientation);
      }

      // Fire a shot towards the 
      lightEnemy.nextShot -= delta;
      if (lightEnemy.nextShot <= 0) {
        lightEnemy.nextShot = Math.random() * 5 + 5;

        this.spawnBullet(transform, playerTransform);
      }

      // Fly till the ship nears the edge of the screen
      switch (lightEnemy.state) {
        case LightEnemyState.ADVANCING:
          // TODO: Make this something that works for any initial direction.
          if (transform.position[2] > 45) {
            lightEnemy.state = LightEnemyState.TURNING;
            // Always turn towards the player unless they're too close to the right wall
            if ((playerTransform && playerTransform.position[0] < transform.position[0]) ||
                transform.position[0] > 25) {
              lightEnemy.turnDirection = -1;
            }
          }
          break;

        case LightEnemyState.TURNING:
          lightEnemy.turnAmount -= delta;
          const t = Math.min(1, (TURN_TIME - lightEnemy.turnAmount) / TURN_TIME);
          quat.rotateY(transform.orientation, lightEnemy.initialOrientation, Math.PI * t * lightEnemy.turnDirection);
          if (t >= 1) {
            lightEnemy.state = LightEnemyState.RETREATING;
          }
          break;

        case LightEnemyState.RETREATING:
          if (transform.position[2] < -70) {
            entity.destroy();
          }
          break;
      }
    });
  }

  spawnBullet(transform, playerTransform) {
    if (!playerTransform) { return; }

    vec3.subtract(tmpVec, playerTransform.position, transform.position);
    vec3.normalize(tmpVec, tmpVec);
    vec3.scale(tmpVec, tmpVec, 35);

    this.world.create(
      Tag('enemy'),
      this.bulletMesh,
      new Transform({ position: transform.position }),
      new Velocity(tmpVec),
      new Lifetime(3),
      new Health(1),
      new ImpactDamage(1, Tag('enemy')),
      new Collider(0.3),
      new PointLight({ color: [1.0, 0.8, 1.0], intensity: 10, range: 10 })
    );
  }
}