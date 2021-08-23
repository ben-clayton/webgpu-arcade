import { mat4, vec3, quat } from 'gl-matrix';

const DEFAULT_ORIENTATION = quat.create();
const DEFAULT_SCALE = vec3.fromValues(1, 1, 1);

export class Transform {
  #position;
  #orientation;
  #scale;
  #matrix;
  #worldMatrix;

  #useMatrix = false;
  #matrixDirty = true;
  #worldMatrixDirty = true;
  #parent = null;
  #children;

  constructor(options = {}) {
    let buffer;
    let offset = 0;
    // Allocate storage for all the transform elements
    if (options.externalStorage) {
      buffer = options.externalStorage.buffer;
      offset = options.externalStorage.offset;
      const worldMatrixOffset = options.externalStorage.worldMatrixOffset ?? offset + 26 * Float32Array.BYTES_PER_ELEMENT;
      this.#worldMatrix = new Float32Array(buffer, worldMatrixOffset, 16);
    } else {
      buffer = new Float32Array(42).buffer;
      this.#worldMatrix = new Float32Array(buffer, 26 * Float32Array.BYTES_PER_ELEMENT, 16);
    }

    this.#position = new Float32Array(buffer, offset, 3);
    this.#orientation = new Float32Array(buffer, offset + 3 * Float32Array.BYTES_PER_ELEMENT, 4);
    this.#scale = new Float32Array(buffer, offset + 7 * Float32Array.BYTES_PER_ELEMENT, 3);
    this.#matrix = new Float32Array(buffer, offset + 10 * Float32Array.BYTES_PER_ELEMENT, 16);

    if (options.matrix) {
      this.#useMatrix = true;
      this.#matrixDirty = false;
      this.#matrix.set(options.matrix);
    } else {
      if (options.position) {
        this.#position.set(options.position);
      }
      this.#orientation.set(options.orientation ? options.orientation : DEFAULT_ORIENTATION);
      this.#scale.set(options.scale ? options.scale : DEFAULT_SCALE);
    }
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
    this.resolveWorldMatrix();
    return this.#worldMatrix;
  }

  resolveWorldMatrix(recursive = false) {
    if (this.#worldMatrixDirty) {
      if (!this.parent) {
        this.#worldMatrix.set(this.matrix);
      } else {
        mat4.mul(this.#worldMatrix, this.parent.worldMatrix, this.matrix);
      }
      this.#worldMatrixDirty = false;
    }
  
    if (recursive && this.#children) {
      for (const child of this.#children) {
        child.resolveWorldMatrix(recursive);
      }
    }
  }

  replaceWorldMatrixStorage(worldMatrixStorage) {
    this.#worldMatrix = worldMatrixStorage;
    this.#makeDirty();
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

export class TransformPool {
  #buffer;
  #worldMatrixArray;
  #transforms = [];
  
  constructor(count) {
    this.#buffer = new Float32Array(42 * count).buffer;
    this.#worldMatrixArray = new Float32Array(this.#buffer, 0, 16 * count);

    const baseOffset = 16 * Float32Array.BYTES_PER_ELEMENT * count;
    for (let i = 0; i < count; ++i) {
      this.#transforms[i] = new Transform({
        externalStorage: {
          buffer: this.#buffer,
          offset: baseOffset + (i * 24 * Float32Array.BYTES_PER_ELEMENT),
          worldMatrixOffset: i * 16 * Float32Array.BYTES_PER_ELEMENT,
        }
      });
    }
  }

  getTransform(index) {
    return this.#transforms[index];
  }

  resolveWorldMatrices() {
    for (const transform of this.#transforms) {
      transform.resolveWorldMatrix();
    }
  }

  get worldMatrixArray() {
    this.resolveWorldMatrices();
    return this.#worldMatrixArray;
  }
}