import { Component, System, Types, Not } from 'ecs';
import { TransformMatrix } from './transform.js';
import { mat4 } from 'gl-matrix';

export class Camera extends Component {
  static schema = {
    fieldOfView: { type: Types.Number, default: Math.PI * 0.5 },
    aspectRatio: { type: Types.Number, default: 1.0 },
    zNear: { type: Types.Number, default: 0.01 },
    zFar: { type: Types.Number, default: 1000.0 },

    // "Private"
    viewMatrix: { type: Types.Mat4 },
    projectionMatrix: { type: Types.Mat4 },
  };
}

export class CameraSystem extends System {
  static queries = {
    cameras: {
      components: [Camera]
    },
  };

  execute(delta) {
    // TODO: Only update when changed
    this.queries.cameras.results.forEach(entity => {
      const camera = entity.modify(Camera);

      mat4.perspectiveZO(camera.projectionMatrix,
        camera.fieldOfView, camera.aspectRatio,
        camera.zNear, camera.zFar);

      const transformMatrix = entity.read(TransformMatrix);
      if (transformMatrix) {
        mat4.invert(camera.viewMatrix, transformMatrix.value);
      } else {
        mat4.identity(viewMatrix);
      }
    });
  }
}