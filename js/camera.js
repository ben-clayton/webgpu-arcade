import { Component, System, Types } from 'ecs';
import { Keyboard, Mouse } from './input.js';
import { Position, Orientation } from './transform.js';

export class Camera extends Component {
  static schema = {
    device: { type: Types.Ref },

    // TODO: A lot of this probably needs to move somewhere else eventually
    canvas: { type: Types.Ref },
    context: { type: Types.Ref },
    format: { type: Types.String },
    depthFormat: { type: Types.String, default: 'depth24plus' },
    sampleCount: { type: Types.Number, default: 4 },
    swapChain: { type: Types.Ref },
  };

  get adapter() {
    return this.device.adapter;
  }
}

export class FlyingControls extends Component {
  static schema = {
    speed: { type: Types.Number, default: 3 },
    position: { type: Types.Vec3 },
    angles: { type: Types.Vec3 },

    // Internal state
    rotationMatrix: { type: Types.Mat4 },
    dirty: { type: Types.Mat4 },
  };
}

const TMP_DIR = vec3.create();
export class FlyingControlsSystem extends System {
  static queries = {
    flyingControls: { components: [FlyingControls] },
  };

  execute(delta) {
    const keyboard = this.readSingleton(Keyboard);
    const mouse = this.readSingleton(Mouse);

    this.queries.flyingControls.results.forEach(entity => {
      const control = entity.modify(FlyingControls);

      // Handle Mouse state.
      if (mouse.buttons[0] && (mouse.delta[0] || mouse.delta[1])) {
        control.angles[1] += mouse.delta[0];
        // Keep our rotation in the range of [0, 2*PI]
        // (Prevents numeric instability if you spin around a LOT.)
        while (control.angles[1] < 0) {
          control.angles[1] += Math.PI * 2.0;
        }
        while (control.angles[1] >= Math.PI * 2.0) {
          control.angles[1] -= Math.PI * 2.0;
        }

        control.angles[0] += mouse.delta[1];
        // Clamp the up/down rotation to prevent us from flipping upside-down
        control.angles[0] = Math.min(Math.max(control.angles[0], -Math.PI*0.5), Math.PI*0.5);

        // Update the rotation matrix
        const rot = control.rotationMatrix;
        mat4.identity(rot);
        mat4.rotateY(rot, rot, -this._angles[1]);
        mat4.rotateX(rot, rot, -this._angles[0]);
        control.dirty = true;
      }

      // Handle keyboard state.
      vec3.set(TMP_DIR, 0, 0, 0);
      if (keyboard.isPressed('KeyW')) {
        TMP_DIR[2] -= 1.0;
      }
      if (keyboard.isPressed('KeyS')) {
        TMP_DIR[2] += 1.0;
      }
      if (keyboard.isPressed('KeyA')) {
        TMP_DIR[0] -= 1.0;
      }
      if (keyboard.isPressed('KeyD')) {
        TMP_DIR[0] += 1.0;
      }
      if (keyboard.isPressed('Space')) {
        TMP_DIR[1] += 1.0;
      }
      if (keyboard.isPressed('ShiftLeft')) {
        TMP_DIR[1] -= 1.0;
      }

      if (DIR[0] !== 0 || DIR[1] !== 0 || DIR[2] !== 0) {
        vec3.transformMat4(TMP_DIR, TMP_DIR, control.rotationMatrix);
        vec3.normalize(TMP_DIR, TMP_DIR);
        vec3.scaleAndAdd(control.position, control.position, TMP_DIR, (control.speed / 1000.0) * delta);
        control.dirty = true;
      }
    });
  }
}