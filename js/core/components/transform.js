import { Component, SystemStateComponent } from '../../ecs/component.js';
import { Types } from '../../ecs/types.js';

export class Position extends Component {
  static schema = {
    value: { type: Types.Vec3 },
  };
  static default = Float32Array([0, 0, 0]);
}

export class Orientation extends Component {
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