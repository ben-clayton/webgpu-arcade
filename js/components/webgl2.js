import { Component } from '../third-party/ecsy/src/Component.js';
import { SystemStateComponent } from '../third-party/ecsy/src/SystemStateComponent.js';
import { Types } from '../third-party/ecsy/src/Types.js';

export class WebGL2 extends Component {
  static schema = {
    canvas: { type: Types.Ref },
    context: { type: Types.Ref },
  };
}

export class WebGL2RenderGeometry extends SystemStateComponent {
  static schema = {
    indexBuffer: { type: Types.Ref },
    vertexBuffers: { type: Types.Array },
    vao: { type: Types.Ref },
    indexType: { type: Types.Number },
    drawCount: { type: Types.Number },
    topology: { type: Types.Number },
  };
}
