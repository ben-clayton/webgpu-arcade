import { System } from 'ecs';
import { TransformMatrix } from './transform.js';
import { OutputCanvas } from './output-canvas.js';
import { mat4 } from 'gl-matrix';

export class Camera {
  fieldOfView = Math.PI * 0.5;
  zNear = 0.01;
  zFar = 1000.0;

  viewMatrix = mat4.create();
  projectionMatrix = mat4.create();
}

export class CameraSystem extends System {
  execute() {
    // Set the camera's view matrix to the identity matrix if there's no transform
    this.query(Camera).not(TransformMatrix).forEach((entity, camera) => {
      mat4.identity(camera.viewMatrix);
    });

    // Set the camera's view matrix to the inverse of the transform if the camera has one
    this.query(Camera, TransformMatrix).forEach((entity, camera, transformMatrix) => {
      mat4.invert(camera.viewMatrix, transformMatrix.value);
    });

    // Set the projection matrix up for any camera associated with an output canvas
    this.query(Camera, OutputCanvas).forEach((entity, camera, output) => {
      mat4.perspectiveZO(camera.projectionMatrix, camera.fieldOfView, output.width / output.height,
                         camera.zNear, camera.zFar);
    });
  }
}
