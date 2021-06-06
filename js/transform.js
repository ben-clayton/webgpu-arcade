import { System } from 'ecs';
import { mat4, vec3, quat } from 'gl-matrix';

export class Transform {
  position = vec3.create();
  orientation = quat.create();
  scale = vec3.fromValues(1, 1, 1);
}

export class TransformMatrix {
  value = mat4.create();
}

function updateTransformMatrix(entity, transform) {
  const matrix = entity.get(TransformMatrix);
  mat4.fromRotationTranslationScale(matrix.value,
    transform.orientation,
    transform.position,
    transform.scale);
}

export class TransformSystem extends System {
  execute(delta) {
    this.query(Transform).not(TransformMatrix).forEach((entity, transform) => {
      entity.add(new TransformMatrix());
      updateTransformMatrix(entity, transform);
    });

    this.query(Transform).forEach(updateTransformMatrix);
  }
}