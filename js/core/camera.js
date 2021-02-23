import { Component, SystemStateComponent } from '../ecs/component.js';
import { Types } from '../ecs/types.js';
import { System, Not, Any } from '../ecs/system.js';
import { mat4 } from '../third-party/gl-matrix/dist/esm/index.js';

//
// Components
//

export class PerspectiveCamera extends Component {
  static schema = {
    aspect: { type: Types.Number, default: 1.0 },
    fieldOfView: { type: Types.Number, default: Math.PI * 0.5 },
    near: { type: Types.Number, default: 0.01 },
    far: { type: Types.Number, default: 1024 },
  };
}

export class OrthographicCamera extends Component {
  static schema = {
    top: { type: Types.Number, default: 1 },
    left: { type: Types.Number, default: -1 },
    bottom: { type: Types.Number, default: -1 },
    right: { type: Types.Number, default: 1 },
    near: { type: Types.Number, default: 0.01 },
    far: { type: Types.Number, default: 1024 },
  };
}

export class Projection extends SystemStateComponent {
  static schema = {
    value: { type: Types.Mat4 },
  };
}

//
// Systems
//

// This system processes all of the transforms applied to any entities (whether done as separate
// components or a single transform matrix) and computes all applicable world transforms
export class CameraSystem extends System {
  static queries = {
    addProjection: { components: [Any(PerspectiveCamera, OrthographicCamera), Not(Projection)] },
    updatePerspective: { components: [PerspectiveCamera], listen: { changed: true } },
    updateOrthographic: { components: [OrthographicCamera], listen: { changed: true } },
    removeProjection: { components: [Not(PerspectiveCamera, OrthographicCamera), Projection] },
  }

  execute(delta, time) {
    // Add projection matrices to entities that need them
    this.queries.addProjection.results.forEach((entity) => {
      entity.add(Projection);
    });

    // Clean up projection matrices from entities that no longer need them
    this.queries.removeProjection.results.forEach((entity) => {
      entity.remove(Projection);
    });

    this.queries.updatePerspective.results.forEach((entity) => {
      const perspective = entity.read(PerspectiveCamera);
      const projection = entity.modify(Projection);
      mat4.perspectiveZO(projection.value, perspective.fieldOfView, perspective.aspect, perspective.near, perspective.far);
    });

    this.queries.updateOrthographic.results.forEach((entity) => {
      const ortho = entity.read(OrthographicCamera);
      const projection = entity.modify(Projection);
      mat4.orthoZO(projection.value, ortho.left, ortho.right, ortho.bottom, ortho.top, ortho.near, ortho.far);
    });
  }
}

