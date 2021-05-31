import { Component, System, Types, Not } from 'ecs';
import { Keyboard, Mouse } from './input.js';
import { Transform } from './transform.js';
import { vec3, quat } from 'gl-matrix';

export class FlyingControls extends Component {
  static schema = {
    speed: { type: Types.Number, default: 3 },
    angles: { type: Types.Vec2 },
  };
}

const TMP_DIR = vec3.create();

export class FlyingControlsSystem extends System {
  static queries = {
    flyingControls: { components: [FlyingControls, Transform] },
  };

  execute(delta) {
    const keyboard = this.readSingleton(Keyboard);
    const mouse = this.readSingleton(Mouse);

    this.queries.flyingControls.results.forEach(entity => {
      const control = entity.modify(FlyingControls);

      // Handle Mouse state.
      if (mouse.buttons[0] && (mouse.delta[0] || mouse.delta[1])) {
        control.angles[1] += mouse.delta[0] * 0.025;
        // Keep our rotation in the range of [0, 2*PI]
        // (Prevents numeric instability if you spin around a LOT.)
        while (control.angles[1] < 0) {
          control.angles[1] += Math.PI * 2.0;
        }
        while (control.angles[1] >= Math.PI * 2.0) {
          control.angles[1] -= Math.PI * 2.0;
        }

        control.angles[0] += mouse.delta[1] * 0.025;
        // Clamp the up/down rotation to prevent us from flipping upside-down
        control.angles[0] = Math.min(Math.max(control.angles[0], -Math.PI*0.5), Math.PI*0.5);

        // Update the rotation matrix
        const q = entity.modify(Transform).orientation;
        quat.identity(q);
        quat.rotateY(q, q, -control.angles[1]);
        quat.rotateX(q, q, -control.angles[0]);
        //quat.fromEuler(q, -control.angles[0], -control.angles[1], 0); // ?
      }

      // Handle keyboard state.
      vec3.set(TMP_DIR, 0, 0, 0);
      if (keyboard.keyPressed('KeyW')) {
        TMP_DIR[2] -= 1.0;
      }
      if (keyboard.keyPressed('KeyS')) {
        TMP_DIR[2] += 1.0;
      }
      if (keyboard.keyPressed('KeyA')) {
        TMP_DIR[0] -= 1.0;
      }
      if (keyboard.keyPressed('KeyD')) {
        TMP_DIR[0] += 1.0;
      }
      if (keyboard.keyPressed('Space')) {
        TMP_DIR[1] += 1.0;
      }
      if (keyboard.keyPressed('ShiftLeft')) {
        TMP_DIR[1] -= 1.0;
      }

      if (TMP_DIR[0] !== 0 || TMP_DIR[1] !== 0 || TMP_DIR[2] !== 0) {
        const transform = entity.modify(Transform);
        vec3.transformQuat(TMP_DIR, TMP_DIR, transform.orientation);
        vec3.normalize(TMP_DIR, TMP_DIR);
        vec3.scaleAndAdd(transform.position, transform.position, TMP_DIR, control.speed * delta);
      }
    });
  }
}