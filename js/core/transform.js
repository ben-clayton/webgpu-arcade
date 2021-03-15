import { Component, SystemStateComponent } from '../ecs/component.js';
import { Types } from '../ecs/types.js';
import { System, Not, Any } from '../ecs/system.js';
import { mat4 } from '../third-party/gl-matrix/dist/esm/index.js';

//
// Components
//

export class Position extends Component {
  static schema = {
    value: { type: Types.Vec3 },
  };
}

export class Rotation extends Component {
  static schema = {
    value: { type: Types.Quat },
  };
}

export class Scale extends Component {
  static schema = {
    value: { type: Types.Vec3 },
  };
}

export class Matrix extends Component {
  static schema = {
    value: { type: Types.Mat4 },
  };
}

export class EntityTransform extends SystemStateComponent {
  static schema = {
    localMatrix: { type: Types.Mat4 },
    worldMatrix: { type: Types.Mat4 },
    dirtyWorld: { type: Types.Boolean, default: true },
  };
}

//
// Systems
//

const DEFAULT_POSITION = new Float32Array([0, 0, 0]);
const DEFAULT_ROTATION = new Float32Array([0, 0, 0, 1]);
const DEFAULT_SCALE = new Float32Array([1, 1, 1]);
const IDENTITY_MATRIX = new Float32Array([1, 0, 0, 0,
                                          0, 1, 0, 0,
                                          0, 0, 1, 0,
                                          0, 0, 0, 1]);

function getParentWorldMatrix(entity) {
  let transform = entity.read(EntityTransform);
  if (transform) {
    return transform.worldMatrix;
  }
  if (entity.parent) {
    return getParentWorldMatrix(entity.parent);
  }
  return IDENTITY_MATRIX;
}

function updateWorldMatrix(entity, parentWorldMatrix) {
  let transform = entity.read(EntityTransform);
  if (transform) {
    mat4.multiply(transform.worldMatrix, parentWorldMatrix, transform.localMatrix);
    transform.dirtyWorld = false;
    parentWorldMatrix = transform.worldMatrix;
  }
  
  for (const child of entity) {
    updateWorldMatrix(child, parentWorldMatrix);
  }
}

const dirtyRoots = new Set();

function markTreeDirty(entity) {
  const transform = entity.modify(EntityTransform);
  // If this transform is already marked as dirty then don't recurse further.
  if (transform.dirtyWorld) {
    dirtyRoots.delete(entity);
    return false;
  } 
  transform.dirtyWorld = true;
}

// This system processes all of the transforms applied to any entities (whether done as separate
// components or a single transform matrix) and computes all applicable world transforms
export class TransformSystem extends System {
  static queries = {
    addTransforms: { components: [Any(Position, Rotation, Scale, Matrix), Not(EntityTransform)] },
    updateTransforms: { components: [Any(Position, Rotation, Scale, Matrix)], listen: { changed: true } },
    removeTransforms: { components: [Not(Position, Rotation, Scale, Matrix), LocalTransform] },
  }

  init() {
    this.frameId = 0;
  }

  execute(delta, time) {
    // Add local/world transforms to entities that need them
    this.queries.addTransforms.results.forEach((entity) => {
      entity.add(EntityTransform);
    });

    // First do a pass that doesn't actually remove the transform, but sets it
    // to the identity matrix and marks everything underneath it dirty
    this.queries.removeTransforms.results.forEach((entity) => {
      const transform = entity.modify(EntityTransform);
      transform.localMatrix = IDENTITY_MATRIX;
      dirtyRoots.add(entity);
      entity.traverse(markTreeDirty, EntityTransform);
    });

    // Update any local transforms that have changed components and dirty
    // the corresponding world transforms
    this.queries.updateTransforms.changed.forEach((entity) => {
      const transform = entity.modify(EntityTransform);
      const matrix = entity.read(TransformMatrix);
      if (matrix) {
        mat4.copy(local.matrix, matrix.value);
      } else {
        const position = entity.read(Position);
        const rotation = entity.read(Rotation);
        const scale = entity.read(Scale);
        mat4.fromRotationTranslationScale(local.matrix,
          rotation ? rotation.value : DEFAULT_ROTATION,
          position ? pos.value : DEFAULT_POSITION,
          scale ? scale.value : DEFAULT_SCALE);
      }

      if (!transform.dirtyWorld) {
        dirtyRoots.add(entity);
        entity.traverse(markTreeDirty, EntityTransform);
      }
    });

    for (const entity of dirtyRoots) {
      updateWorldMatrix(entity, getParentWorldMatrix(entity));
    }

    dirtyRoots.clear();

    // Finally clean up transforms from entities that no longer need them
    this.queries.removeTransforms.results.forEach((entity) => {
      entity.remove(EntityTransform);
    });
  }
}