import { World } from 'ecs';

import { InputSystem } from './input.js';
import { EntityGroupSystem } from './entity-group.js';
import { AnimationSystem } from './animation.js';

export class RenderWorld extends World {
  #canvas;
  #rendererInitialized;

  constructor(canvas) {
    super();

    this.#canvas = canvas || document.createElement('canvas');

    this.#rendererInitialized = this.intializeRenderer();

    this.registerSystem(InputSystem);
    this.registerSystem(EntityGroupSystem);
    this.registerSystem(AnimationSystem);
  }

  get canvas() {
    return this.#canvas;
  }

  registerRenderSystem(systemType, ...initArgs) {
    this.#rendererInitialized.then((renderer) => {
      this.registerSystem(systemType, renderer, ...initArgs);
    });
    return this;
  }

  async intializeRenderer() {
    throw new Error('intializeRenderer must be overriden in an extended class.');
  }

  async renderer() {
    return await this.#rendererInitialized;
  }

  get textureLoader() {
    throw new Error('textureLoader getter must be overriden in an extended class.');
  }

  createStaticBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    throw new Error('createStaticBuffer must be overriden in an extended class.');
  }

  createDynamicBuffer(sizeOrArrayBuffer, usage = 'vertex') {
    throw new Error('createDynamicBuffer must be overriden in an extended class.');
  }
}