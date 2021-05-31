import { Component, Types } from 'ecs';

export class WebGPU extends Component {
  static schema = {
    device: { type: Types.Ref },

    // TODO: A lot of this probably needs to move somewhere else eventually
    canvas: { type: Types.Ref },
    context: { type: Types.Ref },
    format: { type: Types.String },
    depthFormat: { type: Types.String, default: 'depth24plus' },
    sampleCount: { type: Types.Number, default: 1 },
    swapChain: { type: Types.Ref },
  };

  get adapter() {
    return this.device.adapter;
  }
}
