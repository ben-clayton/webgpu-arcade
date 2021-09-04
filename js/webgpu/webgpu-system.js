import { System } from 'ecs';
import { Stage } from '../core/stage.js';

export class WebGPUSystem extends System {
  stage = Stage.Render;
};
