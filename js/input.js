import { Component, System, Types } from 'ecs';
import { OutputCanvas } from './output-canvas.js';

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
    wheelDelta: { type: Types.Vec2 },
  };
}

export class InputSystem extends System {
  static queries = {
    outputCanvases: { components: [OutputCanvas], listen: { added: true, removed: true } },
  };

  eventCanvas = null;
  lastMouseX = 0;
  lastMouseY = 0;
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  mouseWheelDeltaX = 0;
  mouseWheelDeltaY = 0;

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

    this.mousewheelCallback = (event) => {
      const mouse = this.modifySingleton(Mouse);
      this.mouseWheelDeltaX += event.wheelDeltaX;
      this.mouseWheelDeltaY += event.wheelDeltaY;
    };
  }

  execute() {
    // If the canvas that we're rendering to changes, update the mouse event listeners.
    this.queries.outputCanvases.removed.forEach(entity => {
      const output = entity.read(OutputCanvas);
      output.canvas.removeEventListener('pointerenter', this.pointerEnterCallback);
      output.canvas.removeEventListener('pointerdown', this.pointerDownCallback);
      output.canvas.removeEventListener('pointermove', this.pointerMoveCallback);
      output.canvas.removeEventListener('pointerup', this.pointerUpCallback);
      output.canvas.removeEventListener('mousewheel', this.mousewheelCallback);
    });

    this.queries.outputCanvases.added.forEach(entity => {
      const output = entity.read(OutputCanvas);
      output.canvas.addEventListener('pointerenter', this.pointerEnterCallback);
      output.canvas.addEventListener('pointerdown', this.pointerDownCallback);
      output.canvas.addEventListener('pointermove', this.pointerMoveCallback);
      output.canvas.addEventListener('pointerup', this.pointerUpCallback);
      output.canvas.addEventListener('mousewheel', this.mousewheelCallback);
    });

    // Update the mouse singleton with the latest movement deltas since the last frame.
    const mouse = this.modifySingleton(Mouse);
    mouse.delta[0] = this.mouseDeltaX;
    mouse.delta[1] = this.mouseDeltaY;
    mouse.wheelDelta[0] = this.mouseWheelDeltaX;
    mouse.wheelDelta[1] = this.mouseWheelDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseWheelDeltaX = 0;
    this.mouseWheelDeltaY = 0;
  }
}