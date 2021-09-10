import { System, Tag } from 'toro/core/ecs.js';
import { KeyboardState, GamepadState } from 'toro/core/input.js';
import { Transform} from 'toro/core/transform.js';
import { vec3 } from 'gl-matrix';

// TODO: Move somewhere more globally accessible?
const MIN_BOUNDS = vec3.fromValues(-40, 0, -50);
const MAX_BOUNDS = vec3.fromValues(40, 0, 50);

const ACCEL = vec3.create();
const PLAYER_SPEED = 70;

const FIRING_TAG = Tag('firing');

export class PlayerControlSystem extends System {
  init() {
    this.playerQuery = this.query(Tag('player'));
  }

  execute(delta, time) {
    const gamepad = this.singleton.get(GamepadState);
    const keyboard = this.singleton.get(KeyboardState);
    //const mouse = this.singleton.get(MouseState);

    let firing = false;

    vec3.set(ACCEL, 0, 0, 0);

    // Keyboard input
    if (keyboard.keyPressed('KeyW') || keyboard.keyPressed('ArrowUp')) {
      ACCEL[2] -= 1.0;
    }
    if (keyboard.keyPressed('KeyS') || keyboard.keyPressed('ArrowDown')) {
      ACCEL[2] += 1.0;
    }
    if (keyboard.keyPressed('KeyA') || keyboard.keyPressed('ArrowLeft')) {
      ACCEL[0] -= 1.0;
    }
    if (keyboard.keyPressed('KeyD') || keyboard.keyPressed('ArrowRight')) {
      ACCEL[0] += 1.0;
    }
    if (keyboard.keyPressed('Space')) {
      firing = true;
    }

    // Gamepad input
    for (const pad of gamepad.gamepads) {
      // Left Stick
      if (pad.axes.length > 1) {
        // Account for a deadzone
        ACCEL[0] += Math.abs(pad.axes[0]) > 0.1 ? pad.axes[0] : 0;
        ACCEL[2] += Math.abs(pad.axes[1]) > 0.1 ? pad.axes[1] : 0;
      }

      if (pad.buttons.length > 0 && pad.buttons[0].pressed) {
        firing = true;
      }

      // Dpad
      if (pad.buttons.length > 15) {
        if (pad.buttons[12].pressed) {
          ACCEL[2] -= 1.0;
        }
        if (pad.buttons[13].pressed) {
          ACCEL[2] += 1.0;
        }
        if (pad.buttons[14].pressed) {
          ACCEL[0] -= 1.0;
        }
        if (pad.buttons[15].pressed) {
          ACCEL[0] += 1.0;
        }
      }
    }

    // Ensure we can never accelerate too fast.
    if (vec3.squaredLength(ACCEL) > 1) {
      vec3.normalize(ACCEL, ACCEL);
    }

    this.playerQuery.forEach((entity) => {
      if (firing) {
        entity.add(FIRING_TAG);
      } else {
        entity.remove(FIRING_TAG);
      }

      if (ACCEL[0] || ACCEL[2]) {
        const transform = entity.get(Transform);
        vec3.scaleAndAdd(transform.position, transform.position, ACCEL, PLAYER_SPEED * delta);

        // Clamp to the play bounds
        vec3.max(transform.position, transform.position, MIN_BOUNDS);
        vec3.min(transform.position, transform.position, MAX_BOUNDS);
      }
    });
  }
}