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

export class TransformMatrix extends Component {
  static schema = {
    value: { type: Types.Mat4 },
  };
}

export class Parent extends Component {
  static schema = {
    value: { type: Types.Ref }
  }
}

export class LocalTransform extends SystemStateComponent {
  static schema = {
    value: { type: Types.Mat4 },
    frameId: { type: Types.Number },
  };
}

export class WorldTransform extends SystemStateComponent {
  static schema = {
    value: { type: Types.Mat4 },
    frameId: { type: Types.Number },
  };
}

//
// Systems
//

const DEFAULT_POSITION = new Float32Array([0, 0, 0]);
const DEFAULT_ROTATION = new Float32Array([0, 0, 0, 1]);
const DEFAULT_SCALE = new Float32Array([1, 1, 1]);
const DEFAULT_TRANSFORM = new Float32Array([1, 0, 0, 0,
                                            0, 1, 0, 0,
                                            0, 0, 1, 0,
                                            0, 0, 0, 1]);

function updateWorldTransform(entity) {
  let local = entity.read(LocalTransform);
  if (!local) {
    return DEFAULT_TRANSFORM;
  }

  let world = entity.modify(WorldTransform);
  if (world) {
    if (world.frameId == local.frameId) {
      return world.value; // Don't update world transforms more than once per frame
    }
  }

  let parentWorldTransform = DEFAULT_TRANSFORM;
  let parent = entity.read(Parent);
  if (parent) {
    parentWorldTransform = updateWorldTransform(parent.value);
  }

  mat4.multiply(world.value, parentWorldTransform, local.value);
}

// This system processes all of the transforms applied to any entities (whether done as separate
// components or a single transform matrix) and computes all applicable world transforms
export class TransformSystem extends System {
  static queries = {
    addTransforms: { components: [Any(Position, Rotation, Scale, TransformMatrix, Parent), Not(LocalTransform)] },
    updateLocalTransforms: { components: [Any(Position, Rotation, Scale, TransformMatrix)], listen: { changed: true } },
    updateWorldTransforms: { components: [Any(LocalTransform, Parent)], listen: { changed: true } },
    removeTransforms: { components: [Not(Position, Rotation, Scale, TransformMatrix, Parent), LocalTransform] },
  }

  init() {
    this.frameId = 0;
  }

  execute(delta, time) {
    // Add local/world transforms to entities that need them
    this.queries.addTransforms.results.forEach((entity) => {
      entity.add(LocalTransform);
      entity.add(WorldTransform);
    });

    // Clean up local/world transforms from entities that no longer need them
    this.queries.removeTransforms.results.forEach((entity) => {
      entity.remove(LocalTransform);
      entity.remove(WorldTransform);
    });

    const currentFrame = this.frameId++;

    // Dirty any local transforms that have changed components
    this.queries.updateLocalTransforms.changed.forEach((entity) => {
      let local = entity.modify(LocalTransform);
      if (local) {
        if (local.frameId == currentFrame) {
          return; // Don't update local transforms more than once per frame
        }
      } else {
        entity.add(LocalTransform);
        local = entity.modify(LocalTransform);
      }

      const matrix = entity.read(TransformMatrix);
      if (matrix) {
        mat4.copy(local.value, matrix.value);
      } else {
        const position = entity.read(Position);
        const rotation = entity.read(Rotation);
        const scale = entity.read(Scale);
        mat4.fromRotationTranslationScale(local.value,
          rotation ? rotation.value : DEFAULT_ROTATION,
          position ? pos.value : DEFAULT_POSITION,
          scale ? scale.value : DEFAULT_SCALE);
      }
      local.frameId == currentFrame;
    });

    // Update each of the world transforms as needed
    this.queries.updateWorldTransforms.changed.forEach(updateWorldTransform);
  }
}