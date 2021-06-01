import { Component, Types } from 'ecs';

export class WebGPU extends Component {
  static schema = {
    device: { type: Types.Ref },
    format: { type: Types.String, default: 'bgra8unorm' },
    depthFormat: { type: Types.String, default: 'depth24plus' },
    sampleCount: { type: Types.Number, default: 1 },
  };

  get adapter() {
    return this.device.adapter;
  }
}

export class WebGPUSwapChain extends Component {
  static schema = {
    context: { type: Types.Ref },
    swapChain: { type: Types.Ref },
    multisampleColorTarget: { type: Types.Ref },
    depthStencilTarget: { type: Types.Ref }
  };

  get canvas() {
    return this.context.canvas;
  }
}
