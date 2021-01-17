import { Component } from '../third-party/ecsy/src/Component.js';
import { Types } from '../third-party/ecsy/src/Types.js';

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