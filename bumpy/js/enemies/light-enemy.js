import { quat, vec3 } from 'gl-matrix';
import { System, Tag } from 'toro/core/ecs.js';
import { Transform } from 'toro/core/transform.js';
import { Collider } from '../collision.js';
import { ImpactDamage } from '../impact-damage.js';
import { Health } from '../lifetime.js';
import { Points } from '../score.js';
import { Velocity } from '../velocity.js';

const LightEnemyState = {
  ADVANCING: 0,
  TURNING: 1,
  RETREATING: 2,
};

const TURN_TIME = 1;
const ORIGIN = vec3.create();

export class LightEnemy {
  state = LightEnemyState.ADVANCING;
  initialOrientation;
  initialVelocity;
  turnAmount = TURN_TIME;
  turnDirection = 1;
}

export class LightEnemySystem extends System {
  init(gpu) {
    this.playerQuery = this.query(Tag('player'), Transform);
    this.lightEnemyQuery = this.query(LightEnemy, Transform, Velocity);
  }

  execute(delta, time) {
    let playerTransform;

    this.playerQuery.forEach((entity, player, transform) => {
      playerTransform = transform;
      // Only handle one player, because there should only be one.
      return false;
    });

    this.lightEnemyQuery.forEach((entity, lightEnemy, transform, velocity) => {
      if (!lightEnemy.initialVelocity) {
        lightEnemy.initialOrientation = quat.clone(transform.orientation);
        lightEnemy.initialVelocity = vec3.clone(velocity.velocity);
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
          vec3.rotateY(velocity.velocity, lightEnemy.initialVelocity, ORIGIN, Math.PI * t * lightEnemy.turnDirection);
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
}