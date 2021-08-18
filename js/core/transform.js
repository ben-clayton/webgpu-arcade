import { mat4, vec3, quat } from 'gl-matrix';

const DEFAULT_ORIENTATION = quat.create();
const DEFAULT_SCALE = vec3.fromValues(1, 1, 1);

export class Transform {
  #buffer;
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
    // Allocate storage for all the transform elements
    if (options.worldMatrixStorage) {
      this.#buffer = new Float32Array(26).buffer;
      this.#worldMatrix = options.worldMatrixStorage;
    } else {
      this.#buffer = new Float32Array(42).buffer;
      this.#worldMatrix = new Float32Array(this.#buffer, 26 * Float32Array.BYTES_PER_ELEMENT, 16);
    }

    this.#position = new Float32Array(this.#buffer, 0, 3);
    this.#orientation = new Float32Array(this.#buffer, 3 * Float32Array.BYTES_PER_ELEMENT, 4);
    this.#scale = new Float32Array(this.#buffer, 7 * Float32Array.BYTES_PER_ELEMENT, 3);
    this.#matrix = new Float32Array(this.#buffer, 10 * Float32Array.BYTES_PER_ELEMENT, 16);

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
  #matrixStorage;
  #matrices = [];
  #transforms = [];
  
  constructor(count) {
    this.#matrixStorage = new Float32Array(16 * count);
    const buffer = this.#matrixStorage.buffer;
    for (let i = 0; i < count; ++i) {
      const offset = i * 16 * Float32Array.BYTES_PER_ELEMENT;
      const matrix = new Float32Array(buffer, offset, 16);
      mat4.identity(matrix);
      this.#matrices[i] = matrix;
    }
  }

  getTransform(index) {
    if (index >= this.#matrices.length) {
      throw new Error(`Transform index ${index} is out of bounds`);
    }

    if (this.#transforms[index] == undefined) {
      this.#transforms[index] = new Transform({ worldMatrixStorage: this.#matrices[index] });
    }
    return this.#transforms[index];
  }

  // Places the given transform at the given index, replacing it's worldMatrix storage with the
  // pooled storage.
  setTransformAtIndex(index, transform) {
    if (index >= this.#matrices.length) {
      throw new Error(`Transform index ${index} is out of bounds`);
    }
    // TODO: Could end up with multiple transforms with a shared world matrix by doing this.
    // Do we need to replace the storage of any old transform at the same index?
    transform.replaceWorldMatrixStorage(this.#matrices[index]);
    this.#transforms[index] = transform;
  }

  resolveWorldMatrices() {
    for (const transform of this.#transforms) {
      transform.resolveWorldMatrix();
    }
  }

  get worldMatrixArray() {
    this.resolveWorldMatrices();
    return this.#matrixStorage;
  }
}