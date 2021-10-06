import { System } from 'engine/core/ecs.js';
import { Transform } from 'engine/core/transform.js';
import { SphereGeometry } from 'engine/geometry/sphere.js';
import { PBRMaterial } from 'engine/core/materials.js';
import { Mesh } from 'engine/core/mesh.js';
import { PointLight } from 'engine/core/light.js';

import { Physics2DBody } from '../common/physics-2d.js';

import { vec3 } from 'gl-matrix';

class BallState {
  launchTimeout = 1;
}

export class BallSystem extends System {
  init(gpu) {
    this.ballQuery = this.query(BallState, Transform, Physics2DBody);

    const ballGeometry = new SphereGeometry(gpu, 1);
    const ballMaterial = new PBRMaterial();
    ballMaterial.baseColorFactor.set([0.0, 0.0, 0.0, 1.0]);
    ballMaterial.emissiveFactor.set([0.9, 0.9, 0.5]);
    this.ballMesh = new Mesh({ geometry: ballGeometry, material: ballMaterial });
  }

  execute(delta, time) {
    let ballCount = 0;
    this.ballQuery.forEach((entity, ball, transform, body) => {
      if (ball.launchTimeout > 0) {
        ball.launchTimeout -= delta;
        if (ball.launchTimeout <= 0) {
          // Launch the ball in a random direction
          const vel = vec3.fromValues((Math.random() * 2.0 - 1.0) * 1.2, (Math.random() * 2.0 - 1.0), 0);
          vec3.normalize(vel, vel);
          vec3.scale(vel, vel, 1);
          Matter.Body.setVelocity(body.body, {
            x: vel[0],
            y: vel[1]
          });
        }
      }

      // If the ball gets past a player, increase the score and destroy the ball.
      if (transform.position[0] < -32) {
        // TODO: Score +1 for Blue
        entity.destroy();
      } else if (transform.position[0] > 32) {
        // TODO: Score +1 for Red
        entity.destroy();
      } else {
        ballCount++;
      }
    });

    // If there are no balls currently in play, spawn a new one.
    if (ballCount == 0) {
      this.spawnBall();
    }
  }

  spawnBall() {
    const ball = this.world.create(
      new BallState(),
      this.ballMesh,
      new PointLight({ color: [1, 1, 0.8], intensity: 10, range: 10 }),
      new Physics2DBody('circle', 0, 0, 1, { friction: 0, restitution: 1, frictionAir: 0 })
    );

    return ball;
  }
}