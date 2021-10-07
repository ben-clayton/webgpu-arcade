import { System } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';
import { SphereGeometry } from 'engine/geometry/sphere.js';
import { PBRMaterial } from 'engine/core/materials.js';
import { Mesh } from 'engine/core/mesh.js';
import { PointLight } from 'engine/core/light.js';

import { Physics2DBody } from '../common/physics-2d.js';
import { Paddle } from './player.js';

import { vec3 } from 'gl-matrix';
import { Collisions } from '../common/impact-damage.js';

class BallState {
  waitingForLaunch = true;
}

export class BallSystem extends System {
  init(gpu) {
    this.ballQuery = this.query(BallState, Physics2DBody, Transform);
    this.paddleQuery = this.query(Paddle);

    const ballGeometry = new SphereGeometry(gpu, 1);
    const ballMaterial = new PBRMaterial();
    ballMaterial.baseColorFactor.set([0.0, 0.0, 0.0, 1.0]);
    ballMaterial.emissiveFactor.set([0.9, 0.9, 0.5]);
    this.ballMesh = new Mesh({ geometry: ballGeometry, material: ballMaterial });
  }

  execute(delta, time) {
    let ballCount = 0;
    let paddleState;

    this.paddleQuery.forEach((entity, paddle) => {
      paddleState = paddle;
      return false; // Only get one paddle
    });

    this.ballQuery.forEach((entity, ball, body, transform) => {
      if (ball.waitingForLaunch && paddleState) {
        Matter.Body.setPosition(body.body, {
          x: paddleState.x,
          y: -23
        });

        if (paddleState.launch) {
          // Launch the ball in a semi-random direction, but always primarily up
          const vel = vec3.fromValues((Math.random() * 2.0 - 1.0) * 0.5, 1, 0);
          vec3.normalize(vel, vel);
          vec3.scale(vel, vel, 0.8);
          Matter.Body.setVelocity(body.body, {
            x: vel[0],
            y: vel[1]
          });
          ball.waitingForLaunch = false;
        }
      }

      // Has the ball collided with anything?
      const collisions = entity.get(Collisions);
      if (collisions) {
        for (const collider of collisions.entities) {
          // If we collided with a paddle give the ball's velocity a little bump.
          if (collider.get(Paddle)) {
            Matter.Body.setVelocity(body.body, {
              x: body.body.velocity.x * 1.2,
              y: body.body.velocity.y * 1.2,
            });
          }
        }
      }

      // If a ball gets past a player, destroy the ball.
      if (transform.position[1] < -30) {
        entity.destroy();
      } else {
        ballCount++;
      }
    });

    // If there are no balls currently in play, spawn a new one.
    if (ballCount == 0) {
      this.spawnBall(paddleState);
    }
  }

  spawnBall(paddleState) {
    const ball = this.world.create(
      new BallState(),
      this.ballMesh,
      new PointLight({ color: [1, 1, 0.8], intensity: 10, range: 10 }),
      new Physics2DBody('circle', paddleState.x, -23, 1, { friction: 0, restitution: 1, frictionAir: 0 }),
      new Transform({ position: [paddleState.x, -23, 0] })
    );
    ball.name = 'The Ball';

    return ball;
  }
}