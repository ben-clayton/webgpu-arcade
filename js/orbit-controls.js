import { Component, System, Types, Not } from 'ecs';
import { Keyboard, Mouse } from './input.js';
import { Transform } from './transform.js';
import { vec3, quat } from 'gl-matrix';

export class OrbitControls extends Component {
  static schema = {
    target: { type: Types.Vec3 },
    angle: { type: Types.Vec2 },
    distance: { type: Types.Number, default: 5 },
    maxAngleX: { type: Types.Number, default: Math.PI * 0.5 },
    minAngleX: { type: Types.Number, default: -Math.PI * 0.5 },
    maxAngleY: { type: Types.Number, default: Math.PI},
    minAngleY: { type: Types.Number, default: -Math.PI },
    constrainXAngle: { type: Types.Boolean, default: true },
    constrainYAngle: { type: Types.Boolean, default: false },
    maxDistance: { type: Types.Number, default: 10 },
    minDistance: { type: Types.Number, default: 1 },
    distanceStep: { type: Types.Number, default: 0.005 },
    constrainDistance: { type: Types.Boolean, default: true },
  };
}

const TMP_DIR = vec3.create();

export class OrbitControlsSystem extends System {
  static queries = {
    orbitControls: { components: [OrbitControls, Transform], listen: { added: true } },
  };

  updateTransform(entity, control) {
    const transform = entity.modify(Transform);

    // Update the orientation
    const q = transform.orientation;
    quat.identity(q);
    quat.rotateY(q, q, -control.angle[1]);
    quat.rotateX(q, q, -control.angle[0]);

    vec3.set(transform.position, 0, 0, control.distance);
    vec3.transformQuat(transform.position, transform.position, transform.orientation);
    vec3.add(transform.position, transform.position, control.target);
  }

  execute(delta) {
    const mouse = this.readSingleton(Mouse);

    this.queries.orbitControls.results.forEach(entity => {
      const control = entity.modify(OrbitControls);

      let updated = false

      // Handle Mouse state.
      if (mouse.buttons[0] && (mouse.delta[0] || mouse.delta[1])) {
        control.angle[1] += mouse.delta[0] * 0.025;
        if(control.constrainYAngle) {
            control.angle[1] = Math.min(Math.max(control.angle[1], control.minAngleY), control.maxAngleY);
        } else {
            while (control.angle[1] < -Math.PI) {
                control.angle[1] += Math.PI * 2;
            }
            while (control.angle[1] >= Math.PI) {
                control.angle[1] -= Math.PI * 2;
            }
        }

        control.angle[0] += mouse.delta[1] * 0.025;
        if(control.constrainXAngle) {
            control.angle[0] = Math.min(Math.max(control.angle[0], control.minAngleX), control.maxAngleX);
        } else {
            while (control.angle[0] < -Math.PI) {
                control.angle[0] += Math.PI * 2;
            }
            while (control.angle[0] >= Math.PI) {
                control.angle[0] -= Math.PI * 2;
            }
        }

        updated = true;
      }

      if (mouse.wheelDelta[1]) {
        control.distance += (-mouse.wheelDelta[1] * control.distanceStep);
        if(control.constrainDistance) {
            control.distance = Math.min(Math.max(control.distance, control.minDistance), control.maxDistance);
        }
        updated = true;
      }

      if (updated) {
        this.updateTransform(entity, control);
      }
    });

    this.queries.orbitControls.added.forEach(entity => {
        this.updateTransform(entity, entity.modify(OrbitControls));
    });
  }
}