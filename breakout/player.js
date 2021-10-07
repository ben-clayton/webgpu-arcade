import { System, Tag } from 'engine/core/ecs.js';
import { KeyboardState, GamepadState } from 'engine/core/input.js';
import { BoxGeometry } from 'engine/geometry/box.js';
import { PBRMaterial } from 'engine/core/materials.js';
import { Mesh } from 'engine/core/mesh.js';
import { Physics2DBody } from '../common/physics-2d.js';

export class Paddle {
  constructor() {
    this.x = 0;
    this.launch = false;
  }
}

export class PlayerSystem extends System {
  init(gpu) {
    this.paddleQuery = this.query(Paddle, Physics2DBody);

    const paddleGeometry = new BoxGeometry(gpu, {
      width: 8,
      height: 1.5,
      depth: 1
    });
    
    const paddleMaterial = new PBRMaterial();
    paddleMaterial.baseColorFactor.set([1.0, 0.2, 0.2, 1.0]);
    paddleMaterial.emissiveFactor.set([0.2, 0.0, 0.0]);
    
    const paddle = this.world.create(
      new Paddle(),
      new Mesh({ geometry: paddleGeometry, material: paddleMaterial }),
      new Physics2DBody('rectangle', 0, -25, 8, 1.5, { isStatic: true, friction: 0, restitution: 1 })
    );
    paddle.name = 'Player Paddle';
  }

  execute(delta, time) {
    const gamepad = this.singleton.get(GamepadState);
    const keyboard = this.singleton.get(KeyboardState);
    //const mouse = this.singleton.get(MouseState);

    let movement = 0;
    let launch = false;

    // Keyboard input
    if (keyboard.keyPressed('KeyD') || keyboard.keyPressed('ArrowRight')) {
      movement += 1.0;
    }
    if (keyboard.keyPressed('KeyA') || keyboard.keyPressed('ArrowLeft')) {
      movement -= 1.0;
    }
    if (keyboard.keyPressed('KeyW') || keyboard.keyPressed('ArrowUp') || keyboard.keyPressed('Space')) {
      launch = true;
    }

    // Gamepad input
    for (const pad of gamepad.gamepads) {
      // Left Stick
      if (pad.axes.length > 1) {
        // Account for a deadzone
        movement += Math.abs(pad.axes[0]) > 0.1 ? pad.axes[0] : 0;
      }

      if (pad.buttons.length && pad.buttons[0].pressed) {
        launch = true;
      }

      // Dpad
      if (pad.buttons.length > 15) {
        if (pad.buttons[14].pressed) {
          movement -= 1.0;
        }
        if (pad.buttons[15].pressed) {
          movement += 1.0;
        }
      }
    }

    // Ensure we can never move too fast.
    movement = Math.min(1, Math.max(-1, movement));

    this.paddleQuery.forEach((entity, paddle, body) => {
      paddle.x += movement;

      // Constrain movement to the board
      paddle.x = Math.min(17, Math.max(-17, paddle.x));

      paddle.launch = launch;

      // Update the physics body
      Matter.Body.setPosition(body.body, { x: paddle.x, y: body.body.position.y });
    });
  }
}