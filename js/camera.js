import { Component, System, Types, Not } from 'ecs';
import { TransformMatrix } from './transform.js';
import { mat4 } from 'gl-matrix';

export class OutputCanvas extends Component {
  static schema = {
    canvas: { type: Types.Ref },
  };
}

export class Camera extends Component {
  static schema = {
    fieldOfView: { type: Types.Number, default: Math.PI * 0.5 },
    zNear: { type: Types.Number, default: 0.01 },
    zFar: { type: Types.Number, default: 1000.0 },

    // "Private"
    viewMatrix: { type: Types.Mat4 },
    projectionMatrix: { type: Types.Mat4 },
  };
}

export class CameraSystem extends System {
  static queries = {
    cameras: { components: [Camera] },
  };

  execute(delta) {
    // TODO: Only update when changed
    this.queries.cameras.results.forEach(entity => {
      const camera = entity.modify(Camera);

      const output = entity.read(OutputCanvas);
      let aspectRatio = 1.0;
      if (output) {
        // TODO: Handle resize in a better place.
        const targetWidth = output.canvas.offsetWidth; // * devicePixelRatio;
        const targetHeight = output.canvas.offsetHeight; // * devicePixelRatio;
        if (output.canvas.width != targetWidth ||
            output.canvas.height != targetHeight) {
          output.canvas.width = targetWidth;
          output.canvas.height = targetHeight;
        }

        aspectRatio = output.canvas.width / output.canvas.height;
      }

      mat4.perspectiveZO(camera.projectionMatrix,
        camera.fieldOfView, aspectRatio, camera.zNear, camera.zFar);

      const transformMatrix = entity.read(TransformMatrix);
      if (transformMatrix) {
        mat4.invert(camera.viewMatrix, transformMatrix.value);
      } else {
        mat4.identity(camera.viewMatrix);
      }
    });
  }
}