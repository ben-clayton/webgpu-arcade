import { World } from 'ecs';

import { InputSystem } from './input.js';
import { EntityGroupSystem } from './entity-group.js';
import { AnimationSystem } from './animation.js';
import { MeshSystem } from './geometry.js';
import { SkinSystem } from './skin.js';

export class RenderWorld extends World {
  #canvas;
  #rendererInitialized;
  #renderMeshInstances = new Map();

  constructor(canvas) {
    super();

    this.#canvas = canvas || document.createElement('canvas');

    this.#rendererInitialized = this.intializeRenderer();

    this.registerSystem(InputSystem);
    this.registerSystem(EntityGroupSystem);
    this.registerSystem(AnimationSystem);
    this.registerSystem(MeshSystem);
    this.registerSystem(SkinSystem);
  }

  get canvas() {
    return this.#canvas;
  }

  execute(delta, time) {
    this.#renderMeshInstances.clear();
    super.execute(delta, time);
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

  addFrameMeshInstances(mesh, ...transforms) {
    let meshInstances = this.#renderMeshInstances.get(mesh);
    if (!meshInstances) {
      meshInstances = new Array();
      this.#renderMeshInstances.set(mesh, meshInstances);
    }
    meshInstances.push(...transforms);
  }

  getFrameMeshInstances() {
    return this.#renderMeshInstances;
  }
}