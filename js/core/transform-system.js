import { System, Not } from '../ecs/system.js';
import { Position, Orientation, Scale, TransformMatrix,
         LocalTransform, WorldTransform, Parent } from './components/transform.js';
import { mat4 } from './third-party/gl-matrix/dist/esm/mat4.js';

const DEFAULT_POSITION = Float32Array([0, 0, 0]);
const DEFAULT_ORIENTATION = Float32Array([0, 0, 0, 1]);
const DEFAULT_SCALE = Float32Array([1, 1, 1]);
const DEFAULT_TRANSFORM = Float32Array([1, 0, 0, 0,
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
    positions: { components: [Position], listen: { changed: true } },
    orientations: { components: [Orientation], listen: { changed: true } },
    scales: { components: [Scale], listen: { changed: true } },
    transforms: { components: [TransformMatrix], listen: { changed: true } },
    parent: { components: [TransformMatrix], listen: { changed: true } },

    updateTransforms: { components: [LocalTransform], listen: { changed: true } },
    updateParents: { components: [Parent], listen: { changed: true } },
    removeTransforms: { components: [Not(Position), Not(Orientation), Not(Scales), Not(Transforms), Not(Parent), LocalTransform] },
  }

  init() {
    this.frameId = 0;
  }

  execute(delta, time) {
    // Clean up local/world transforms from entities that no longer need them
    this.queries.removeTransforms.results.forEach((entity) => {
      entity.remove(LocalTransform);
      entity.remove(WorldTransform);
    });

    const currentFrame = this.frameId++;
    function updateLocalTransform(entity) {
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
        const orientation = entity.read(Orientation);
        const scale = entity.read(Scale);
        mat4.fromRotationTranslationScale(local.value,
          orientation ? orientation.value : DEFAULT_ORIENTATION,
          position ? pos.value : DEFAULT_POSITION,
          scale ? scale.value : DEFAULT_SCALE);
      }
      local.frameId == currentFrame;
    }

    // Dirty any local transforms that have changed components
    this.queries.transforms.changed.forEach(updateLocalTransform);
    this.queries.positions.changed.forEach(updateLocalTransform);
    this.queries.orientations.changed.forEach(updateLocalTransform);
    this.queries.scales.changed.forEach(updateLocalTransform);
    this.queries.parents.changed.forEach(updateLocalTransform);

    // Update each of the world transforms as needed
    this.queries.updateTransforms.changed.forEach(updateWorldTransform);
    this.queries.updateParents.results.forEach(updateWorldTransform);
  }
}