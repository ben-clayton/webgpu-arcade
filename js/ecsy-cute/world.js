import { SystemManager } from "./system-manager.js";
import { EntityManager } from "./entity-manager.js";
import { ComponentManager } from "./component-manager.js";
import { Version } from "./version.js";
import { hasWindow, now } from "./utils.js";
import { Entity } from "./entity.js";

const DEFAULT_OPTIONS = {
  entityPoolSize: 0,
  entityClass: Entity,
};

export class World {
  constructor(options = {}) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);

    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

    this.eventQueues = {};

    if (hasWindow && typeof CustomEvent !== "undefined") {
      var event = new CustomEvent("ecsy-world-created", {
        detail: { world: this, version: Version },
      });
      window.dispatchEvent(event);
    }

    this._singletonEntity = this.entityManager.createEntity();
    this._singletonEntity._isSingletonEntity = true;

    this.lastTime = now() / 1000;
  }

  registerComponent(Component, objectPool) {
    this.componentsManager.registerComponent(Component, objectPool);
    return this;
  }

  registerSingletonComponent(Component, values) {
    Component.isSingleton = true;
    this.componentsManager.registerComponent(Component, false);
    this._singletonEntity.add(Component, values);
    return this;
  }

  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
  }

  hasRegisteredComponent(Component) {
    return this.componentsManager.hasComponent(Component);
  }

  unregisterSystem(System) {
    this.systemManager.unregisterSystem(System);
    return this;
  }

  getSystem(SystemClass) {
    return this.systemManager.getSystem(SystemClass);
  }

  getSystems() {
    return this.systemManager.getSystems();
  }

  readSingleton(T) {
    return this._singletonEntity.read(T);
  }

  modifySingleton(T) {
    return this._singletonEntity.modify(T);
  }

  execute(delta, time) {
    if (!delta) {
      time = now() / 1000;
      delta = time - this.lastTime;
      this.lastTime = time;
    }

    if (this.enabled) {
      this.systemManager.execute(delta, time);
      this.entityManager.processDeferredRemoval();
    }
  }

  stop() {
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  create(components = null, name) {
    const entity = this.entityManager.createEntity(name);
    if (components) {
      entity.add(components);
    }
    return entity;
  }

  stats() {
    var stats = {
      entities: this.entityManager.stats(),
      system: this.systemManager.stats(),
      // TODO: Add FPS, maybe?
    };

    return stats;
  }
}
