import { System, Tag } from 'engine/core/ecs.js';
import { KeyboardState, GamepadState } from 'engine/core/input.js';
import { Transform } from 'engine/core/transform.js';
import { Velocity } from './velocity.js';
import { vec3 } from 'gl-matrix';

// TODO: Move somewhere more globally accessible?
const MIN_BOUNDS = vec3.fromValues(-40, 0, -50);
const MAX_BOUNDS = vec3.fromValues(40, 0, 50);

const DIRECTION = vec3.create();
const PLAYER_SPEED = 80;

const FIRING_TAG = Tag('firing');

export class PlayerControlSystem extends System {
  init() {
    this.playerQuery = this.query(Tag('player'), Velocity);
  }

  execute(delta, time) {
    const gamepad = this.singleton.get(GamepadState);
    const keyboard = this.singleton.get(KeyboardState);
    //const mouse = this.singleton.get(MouseState);

    let firing = false;

    vec3.set(DIRECTION, 0, 0, 0);

    // Keyboard input
    if (keyboard.keyPressed('KeyW') || keyboard.keyPressed('ArrowUp')) {
      DIRECTION[2] -= 1.0;
    }
    if (keyboard.keyPressed('KeyS') || keyboard.keyPressed('ArrowDown')) {
      DIRECTION[2] += 1.0;
    }
    if (keyboard.keyPressed('KeyA') || keyboard.keyPressed('ArrowLeft')) {
      DIRECTION[0] -= 1.0;
    }
    if (keyboard.keyPressed('KeyD') || keyboard.keyPressed('ArrowRight')) {
      DIRECTION[0] += 1.0;
    }
    if (keyboard.keyPressed('Space')) {
      firing = true;
    }

    // Gamepad input
    for (const pad of gamepad.gamepads) {
      // Left Stick
      if (pad.axes.length > 1) {
        // Account for a deadzone
        DIRECTION[0] += Math.abs(pad.axes[0]) > 0.1 ? pad.axes[0] : 0;
        DIRECTION[2] += Math.abs(pad.axes[1]) > 0.1 ? pad.axes[1] : 0;
      }

      if (pad.buttons.length > 0 && pad.buttons[0].pressed) {
        firing = true;
      }

      // Dpad
      if (pad.buttons.length > 15) {
        if (pad.buttons[12].pressed) {
          DIRECTION[2] -= 1.0;
        }
        if (pad.buttons[13].pressed) {
          DIRECTION[2] += 1.0;
        }
        if (pad.buttons[14].pressed) {
          DIRECTION[0] -= 1.0;
        }
        if (pad.buttons[15].pressed) {
          DIRECTION[0] += 1.0;
        }
      }
    }

    // Ensure we can never move too fast.
    if (vec3.squaredLength(DIRECTION) > 1) {
      vec3.normalize(DIRECTION, DIRECTION);
    }

    this.playerQuery.forEach((entity, player, velocity) => {
      if (firing) {
        entity.add(FIRING_TAG);
      } else {
        entity.remove(FIRING_TAG);
      }

      // Apply any new motion
      vec3.scale(velocity.velocity, DIRECTION, PLAYER_SPEED);
    });
  }
}

export class PlayerBoundsSystem extends System {
  init() {
    this.playerQuery = this.query(Tag('player'), Transform);
  }

  execute() {
    this.playerQuery.forEach((entity, player, transform) => {
      // Clamp the player to the play area's bounds
      vec3.max(transform.position, transform.position, MIN_BOUNDS);
      vec3.min(transform.position, transform.position, MAX_BOUNDS);
    });
  }
}