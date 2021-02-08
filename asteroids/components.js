import { Component, TagComponent, Types } from '../js/ecs/index.js';

//----------------------
// Components
//----------------------

export class Player extends TagComponent {}
export class PlayerBullet extends TagComponent {}
export class Enemy extends TagComponent {}
export class Dead extends TagComponent {}

export class Transform extends Component {
  static schema = {
    position: { type: Types.Vec2 },
    orientation: { type: Types.Number },
  };
}

export class Velocity extends Component {
  static schema = {
    direction: { type: Types.Vec2 },
    angular: { type: Types.Number },
    maxSpeed: { type: Types.Number }
  };
}

export class Collider extends Component {
  static schema = {
    radius: { type: Types.Number, default: 1 },
  };
}

export class Health extends Component {
  static schema = {
    value: { type: Types.Number, default: 1 },
  };
}

export class Damage extends Component {
  static schema = {
    value: { type: Types.Number, default: 1 },
    immune: { type: Types.Array, default: [] }
  };
}

export class Lifespan extends Component {
  static schema = {
    value: { type: Types.Number, default: 1 },
  };
}

export class Polygon extends Component {
  static schema = {
    points: { type: Types.Array },
    fill: { type: Types.String, default: "#e2736e" },
    stroke: { type: Types.String, default: "#b74843" },
  };
}

export class CanvasContext extends Component {
  static schema = {
    canvas: { type: Types.Ref },
    ctx: { type: Types.Ref },
  };
}
