import { Component, System, Types } from 'ecs';
import { WebGPU } from './webgpu/components.js';

export class Keyboard extends Component {
  static schema = {
    pressed: { type: Types.JSON, default: {} },
  };

  keyPressed(keycode) {
    return !!this.pressed[keycode];
  }
}

export class Mouse extends Component {
  static schema = {
    buttons: { type: Types.Array },
    position: { type: Types.Vec2 },
    delta: { type: Types.Vec2 },
  };
}

export class InputSystem extends System {
  eventCanvas = null;
  mouseDeltaX = 0;
  mouseDeltaY = 0;

  init() {
    window.addEventListener('keydown', (event) => {
      // Do nothing if event already handled
      if (event.defaultPrevented) { return; }
      this.modifySingleton(Keyboard).pressed[event.code] = true;
    });
    window.addEventListener('keyup', (event) => {
      this.modifySingleton(Keyboard).pressed[event.code] = false;
    });
    window.addEventListener('blur', (event) => {
      // Clear the pressed keys on blur so that we don't have inadvertent inputs
      // after we've shifted focus to another window.
      this.modifySingleton(Keyboard).pressed = {};
      this.modifySingleton(Mouse).buttons = [];
    });

    this.pointerEventCallback = (event) => {
      const mouse = this.modifySingleton(Mouse);
      mouse.buttons = event.buttons;
      mouse.position[0] = event.clientX;
      mouse.position[1] = event.clientY;
      this.mouseDeltaX += event.movementX;
      this.mouseDeltaY += event.movementY;
    };
  }

  execute() {
    // If the canvas that we're rendering to changes, update the mouse event listeners.
    const gpu = this.readSingleton(WebGPU);
    if (gpu.canvas !== this.eventCanvas) {
      if (this.eventCanvas) {
        this.eventCanvas.removeEventListener('pointerdown', this.pointerEventCallback);
        this.eventCanvas.removeEventListener('pointermove', this.pointerEventCallback);
        this.eventCanvas.removeEventListener('pointerup', this.pointerEventCallback);
      }
      this.eventCanvas = gpu.canvas;
      if (this.eventCanvas) {
        this.eventCanvas.addEventListener('pointerdown', this.pointerEventCallback);
        this.eventCanvas.addEventListener('pointermove', this.pointerEventCallback);
        this.eventCanvas.addEventListener('pointerup', this.pointerEventCallback);
      }
    }

    // Update the mouse singleton with the latest movement deltas since the last frame.
    const mouse = this.modifySingleton(Mouse);
    mouse.delta[0] = this.mouseDeltaX;
    mouse.delta[1] = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }
}