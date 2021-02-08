import { Component } from '../ecs/Component.js';
import { SystemStateComponent } from '../ecs/SystemStateComponent.js';
import { Types } from '../ecs/Types.js';

export class WebGPU extends Component {
  static schema = {
    canvas: { type: Types.Ref },
    context: { type: Types.Ref },
    device: { type: Types.Ref },
    swapChain: { type: Types.Ref },
  };
}

export class WebGPUSwapConfig extends Component {
  static schema = {
    format: { type: Types.String },
    depthFormat: { type: Types.String, default: 'depth24plus' },
    sampleCount: { type: Types.Number, default: 4 },
    width: { type: Types.Number },
    height: { type: Types.Number },
  };
}

export class WebGPURenderGeometry extends SystemStateComponent {
  static schema = {
    indexBuffer: { type: Types.Ref },
    vertexBuffers: { type: Types.Array },
    vertexState: { type: Types.Ref },
    drawCount: { type: Types.Number },
    topology: { type: Types.String },
  };
}

export class WebGPUPipeline extends SystemStateComponent {
  static schema = {
    pipeline: { type: Types.Ref },
  };
}