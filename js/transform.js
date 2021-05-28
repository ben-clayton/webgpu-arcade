import { Component, System, Types, Not } from 'ecs';
import { mat4 } from 'gl-matrix';

export class Transform extends Component {
  static schema = {
    position: { type: Types.Vec3 },
    orientation: { type: Types.Quat, default: [0, 0, 0, 1]  },
    scale: { type: Types.Vec3, default: [1, 1, 1] },
  };
}

export class TransformMatrix extends Component {
  static schema = {
    value: { type: Types.Mat4 },
  };
}

function updateTransformMatrix(entity) {
  const transform = entity.read(Transform);
  const matrix = entity.modify(TransformMatrix);
  mat4.fromRotationTranslationScale(matrix.value,
    transform.orientation,
    transform.position,
    transform.scale);
}

export class TransformSystem extends System {
  static queries = {
    needsMatrix: { components: [Transform, Not(TransformMatrix)] },
    updateMatrix: { components: [Transform], listen: { changed: true } },
  };

  execute(delta) {
    this.queries.needsMatrix.results.forEach(entity => {
      entity.add(TransformMatrix);
      updateTransformMatrix(entity);
    });

    this.queries.updateMatrix.changed.forEach(updateTransformMatrix);
  }
}