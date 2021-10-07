import { System, Tag } from 'engine/core/ecs.js';
import { KeyboardState, GamepadState } from 'engine/core/input.js';
import { Physics2DBody } from '../common/physics-2d.js';

export class Paddle {
  constructor(player) {
    this.player = player;
    this.y = 0;
  }
}

export class PlayerControlSystem extends System {
  init() {
    this.paddleQuery = this.query(Paddle, Physics2DBody);
  }

  execute(delta, time) {
    const gamepad = this.singleton.get(GamepadState);
    const keyboard = this.singleton.get(KeyboardState);
    //const mouse = this.singleton.get(MouseState);

    const movement = [0, 0];

    // Keyboard input
    if (keyboard.keyPressed('KeyW')) {
      movement[0] += 1.0;
    }
    if (keyboard.keyPressed('KeyS')) {
      movement[0] -= 1.0;
    }

    if (keyboard.keyPressed('ArrowUp')) {
      movement[1] += 1.0;
    }
    if (keyboard.keyPressed('ArrowDown')) {
      movement[1] -= 1.0;
    }

    // Gamepad input
    for (const pad of gamepad.gamepads) {
      const i = pad.index % 2;
      // Left Stick
      if (pad.axes.length > 1) {
        // Account for a deadzone
        movement[i] -= Math.abs(pad.axes[1]) > 0.1 ? pad.axes[1] : 0;
      }

      // Dpad
      if (pad.buttons.length > 15) {
        if (pad.buttons[12].pressed) {
          movement[i] += 1.0;
        }
        if (pad.buttons[13].pressed) {
          movement[i] -= 1.0;
        }
      }
    }

    // Ensure we can never move too fast.
    movement[0] = Math.min(1, Math.max(-1, movement[0]));
    movement[1] = Math.min(1, Math.max(-1, movement[1]));

    this.paddleQuery.forEach((entity, paddle, body) => {
      paddle.y += movement[paddle.player];

      // Constrain movement to the board
      paddle.y = Math.min(15, Math.max(-15, paddle.y));

      // Update the physics body
      Matter.Body.setPosition(body.body, { x: body.body.position.x, y: paddle.y });
    });
  }
}