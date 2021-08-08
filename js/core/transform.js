import { mat4, vec3, quat } from 'gl-matrix';

const DEFAULT_ORIENTATION = quat.create();
const DEFAULT_SCALE = vec3.fromValues(1, 1, 1);

export class Transform {
  #array = new Float32Array(42);
  #position = new Float32Array(this.#array.buffer, 0, 3);
  #orientation = new Float32Array(this.#array.buffer, 3 * Float32Array.BYTES_PER_ELEMENT, 4);
  #scale = new Float32Array(this.#array.buffer, 7 * Float32Array.BYTES_PER_ELEMENT, 3);

  #useMatrix = false;
  #matrix = new Float32Array(this.#array.buffer, 10 * Float32Array.BYTES_PER_ELEMENT, 16);
  #matrixDirty = true;
  #worldMatrix = new Float32Array(this.#array.buffer, 26 * Float32Array.BYTES_PER_ELEMENT, 16);
  #worldMatrixDirty = true;
  #parent = null;
  #children;

  constructor(position, orientation, scale) {
    if (position) {
      this.#position.set(position);
    }
    this.#orientation.set(orientation ? orientation : DEFAULT_ORIENTATION);
    this.#scale.set(scale ? scale : DEFAULT_SCALE);
  }

  get position() {
    this.#matrixDirty = true;
    this.#makeDirty();
    return this.#position;
  }
  set position(value) {
    this.#position.set(value);
    this.#matrixDirty = true;
    this.#makeDirty();
  }

  get orientation() {
    this.#matrixDirty = true;
    this.#makeDirty();
    return this.#orientation;
  }
  set orientation(value) {
    this.#orientation.set(value);
    this.#matrixDirty = true;
    this.#makeDirty();
  }

  get scale() {
    this.#matrixDirty = true;
    this.#makeDirty();
    return this.#scale;
  }
  set scale(value) {
    this.#scale.set(value);
    this.#matrixDirty = true;
    this.#makeDirty();
  }

  // Yes, this could stand to be a lot better.
  get matrix() {
    if (!this.#useMatrix && this.#matrixDirty) {
      mat4.fromRotationTranslationScale(this.#matrix,
        this.orientation,
        this.position,
        this.scale);
      this.#matrixDirty = false;
    }
    return this.#matrix;
  }

  set matrix(value) {
    if (!value) {
      this.#useMatrix = false;
      this.#matrixDirty = true;
    } else {
      this.#useMatrix = true;
      this.#matrix = value;
      this.#makeDirty();
    }
  }

  get worldMatrix() {
    if (this.#worldMatrixDirty) {
      if (!this.parent) {
        this.#worldMatrix.set(this.matrix);
      } else {
        mat4.mul(this.#worldMatrix, this.parent.worldMatrix, this.matrix);
      }
      this.#worldMatrixDirty = false;
    }
    return this.#worldMatrix;
  }

  addChild(transform) {
    if (transform.parent && transform.parent != this) {
      transform.parent.removeChild(transform);
    }

    if (!this.#children) { this.#children = new Set(); }
    this.#children.add(transform);
    transform.#parent = this;
    transform.#makeDirty();
  }

  removeChild(transform) {
    const removed = this.#children?.delete(transform);
    if (removed) {
      transform.#parent = null;
      transform.#makeDirty();
    }
  }

  get children() {
    return this.#children?.values() || [];
  }

  get parent() {
    return this.#parent;
  }

  #makeDirty() {
    if (this.#worldMatrixDirty) { return; }
    this.#worldMatrixDirty = true;

    if (this.#children) {
      for (const child of this.#children) {
        child.#makeDirty();
      }
    }
  }
}