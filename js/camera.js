import { Component, System, Types, Not } from 'ecs';
import { TransformMatrix } from './transform.js';
import { OutputCanvas } from './output-canvas.js';
import { mat4 } from 'gl-matrix';

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
    identity: { components: [Camera, Not(TransformMatrix)], listen: { added: true } },
    view: { components: [Camera, TransformMatrix], listen: { changed: [TransformMatrix] } },
    perspective: { components: [Camera, OutputCanvas], listen: { changed: true } },
  };

  execute(delta) {
    this.queries.identity.added.forEach(entity => {
      const camera = entity.modify(Camera);
      mat4.identity(camera.viewMatrix);
    });

    this.queries.view.changed.forEach(entity => {
      const camera = entity.modify(Camera);
      const transformMatrix = entity.read(TransformMatrix);
      mat4.invert(camera.viewMatrix, transformMatrix.value);
    });

    this.queries.perspective.changed.forEach(entity => {
      const camera = entity.modify(Camera);
      const output = entity.read(OutputCanvas);
      mat4.perspectiveZO(camera.projectionMatrix, camera.fieldOfView, output.width / output.height,
                         camera.zNear, camera.zFar);
    });
  }
}
