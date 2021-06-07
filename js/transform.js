import { mat4, vec3, quat } from 'gl-matrix';

export class Transform {
  position = vec3.create();
  orientation = quat.create();
  scale = vec3.fromValues(1, 1, 1);

  // Yes, this could stand to be a lot better.
  #matrix = mat4.create();
  get matrix() {
    mat4.fromRotationTranslationScale(this.#matrix,
      this.orientation,
      this.position,
      this.scale);
    return this.#matrix;
  }
}