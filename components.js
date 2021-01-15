import { Component, TagComponent, Types } from "https://ecsy.io/build/ecsy.module.js";

//----------------------
// Components
//----------------------

export class Player extends TagComponent {}
export class PlayerBullet extends TagComponent {}
export class Enemy extends TagComponent {}
export class Dead extends TagComponent {}

export class Transform extends Component {
  static schema = {
    x: { type: Types.Number },
    y: { type: Types.Number },
    orientation: { type: Types.Number },
  };
}

export class Velocity extends Component {
  static schema = {
    x: { type: Types.Number },
    y: { type: Types.Number },
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
