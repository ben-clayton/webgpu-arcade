import { mat4, vec3, quat } from 'gl-matrix';

const DEFAULT_ORIENTATION = quat.create();
const DEFAULT_SCALE = vec3.fromValues(1, 1, 1);

export class Transform {
  #array = new Float32Array(26);
  #matrix = new Float32Array(this.#array.buffer, 0, 16);
  #useMatrix = false;
  position = new Float32Array(this.#array.buffer, 16 * Float32Array.BYTES_PER_ELEMENT, 3);
  orientation = new Float32Array(this.#array.buffer, 19 * Float32Array.BYTES_PER_ELEMENT, 4);
  scale = new Float32Array(this.#array.buffer, 23 * Float32Array.BYTES_PER_ELEMENT, 3);

  constructor(position, orientation, scale) {
    if (position) {
      this.position.set(position);
    }
    this.orientation.set(orientation ? orientation : DEFAULT_ORIENTATION);
    this.scale.set(scale ? scale : DEFAULT_SCALE);
  }

  // Yes, this could stand to be a lot better.
  get matrix() {
    if (!this.#useMatrix) {
      mat4.fromRotationTranslationScale(this.#matrix,
        this.orientation,
        this.position,
        this.scale);
    }
    return this.#matrix;
  }

  set matrix(value) {
    this.#useMatrix = true;
    this.#matrix = value;
  }
}