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
  lastMouseX = 0;
  lastMouseY = 0;
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

    this.pointerEnterCallback = (event) => {
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    };

    this.pointerMoveCallback = (event) => {
      const mouse = this.modifySingleton(Mouse);
      this.mouseDeltaX += event.clientX - this.lastMouseX;
      this.mouseDeltaY += event.clientY - this.lastMouseY;
      this.lastMouseX = mouse.position[0] = event.clientX;
      this.lastMouseY = mouse.position[1] = event.clientY;
    };

    this.pointerDownCallback = (event) => {
      const mouse = this.modifySingleton(Mouse);
      mouse.buttons[event.button] = true;
    };

    this.pointerUpCallback = (event) => {
      const mouse = this.modifySingleton(Mouse);
      mouse.buttons[event.button] = false;
    };
  }

  execute() {
    // If the canvas that we're rendering to changes, update the mouse event listeners.
    const gpu = this.readSingleton(WebGPU);
    if (gpu.canvas !== this.eventCanvas) {
      if (this.eventCanvas) {
        this.eventCanvas.removeEventListener('pointerenter', this.pointerEnterCallback);
        this.eventCanvas.removeEventListener('pointerdown', this.pointerDownCallback);
        this.eventCanvas.removeEventListener('pointermove', this.pointerMoveCallback);
        this.eventCanvas.removeEventListener('pointerup', this.pointerUpCallback);
      }
      this.eventCanvas = gpu.canvas;
      if (this.eventCanvas) {
        this.eventCanvas.addEventListener('pointerenter', this.pointerEnterCallback);
        this.eventCanvas.addEventListener('pointerdown', this.pointerDownCallback);
        this.eventCanvas.addEventListener('pointermove', this.pointerMoveCallback);
        this.eventCanvas.addEventListener('pointerup', this.pointerUpCallback);
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