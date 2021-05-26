import { Component, System, Types } from 'ecs';

export class Transform extends Component {
  static schema = {
    position: { type: Types.Vec3 },
    orientation: { type: Types.Quat },
    scale: { type: Types.Vec3 },
  };
}

export class TransformMatrix extends Component {
  static schema = {
    matrix: { type: Types.Vec3 },
    orientation: { type: Types.Quat },
    scale: { type: Types.Vec3 },
  };
}