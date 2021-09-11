import { mat4, vec3, quat } from 'gl-matrix';

const DEFAULT_POSITION = vec3.create();
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

    if (options.transform) {
      // Copy the transform
      this.#position.set(options.transform.#position);
      this.#orientation.set(options.transform.#orientation);
      this.#scale.set(options.transform.#scale);
      this.#matrix.set(options.transform.worldMatrix);
      this.#useMatrix = options.transform.#useMatrix;
      this.#matrixDirty = options.transform.#matrixDirty;
    } else if (options.matrix) {
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

    if (options.parent) {
      options.parent.addChild(this);
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

  getWorldPosition(out) {
    vec3.set(out, 0, 0, 0);
    vec3.transformMat4(out, out, this.worldMatrix);
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

  // Only for use by TransformPool
  copyFlags(other) {
    this.#useMatrix = other.#useMatrix;
    this.#matrixDirty = other.#matrixDirty;
  }
}

export class TransformPool {
  #buffer;
  #worldMatrixArray;
  #transforms = [];

  constructor(size) {
    this.#buffer = new Float32Array(42 * size).buffer;
    this.#worldMatrixArray = new Float32Array(this.#buffer, 0, 16 * size);

    const baseOffset = 16 * Float32Array.BYTES_PER_ELEMENT * size;
    for (let i = 0; i < size; ++i) {
      this.#transforms[i] = new Transform({
        externalStorage: {
          buffer: this.#buffer,
          offset: baseOffset + (i * 26 * Float32Array.BYTES_PER_ELEMENT),
          worldMatrixOffset: i * 16 * Float32Array.BYTES_PER_ELEMENT,
        }
      });
    }
  }

  get size() {
    return this.#transforms.length;
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

  clone() {
    const out = new TransformPool(this.size);
    // Copy the entire buffer from this pool to the new one.
    new Float32Array(out.#buffer).set(new Float32Array(this.#buffer));
    for (let i = 0; i < this.size; ++i) {
      out.#transforms[i].copyFlags(this.#transforms[i]);
    }

    return out;
  }
}

// Creates a lightweight transform that always reports the same world matrix
// Mostly used for debug utilities that need to apply a static transform to
// a mesh.
export class StaticTransform {
  worldMatrix = new Float32Array(16);

  constructor(transform = null, matrix = null) {
    if (transform instanceof Float32Array) {
      matrix = transform;
      transform = null;
    }

    if (transform) {
      mat4.fromRotationTranslationScale(this.worldMatrix,
        transform.orientation || DEFAULT_ORIENTATION,
        transform.position || DEFAULT_POSITION,
        transform.scale || DEFAULT_SCALE);
      if (matrix) {
        mat4.mul(this.worldMatrix, matrix, this.worldMatrix);
      }
    } else if (matrix) {
      mat4.copy(this.worldMatrix, matrix);
    } else {
      mat4.identity(this.worldMatrix);
    }
  }
}
