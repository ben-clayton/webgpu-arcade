
import { Query } from "./query.js";
import { Component } from "./component.js";
import { wrapImmutableComponent } from "./wrap-immutable-component.js";
import { IS_DEBUG } from "./config.js";

const readonlyProxyHandler = {
  set(target, prop) {
    throw new Error(`Tried to modify a readonly property.`);
  },
};

export class Entity {
  #parentEntity = null;
  #childEntities = [];
  #readonlyChildren = null;

  constructor(entityManager) {
    this._entityManager = entityManager || null;

    // Unique ID for this entity
    this.id = entityManager._nextEntityId++;

    // List of components types the entity has
    this._ComponentTypes = [];

    // Instance of the components
    this._components = {};

    this._componentsToRemove = {};

    // Queries where the entity is added
    this.queries = [];

    // Used for deferred removal
    this._ComponentTypesToRemove = [];

    this.alive = false;

    //if there are state components on a entity, it can't be removed completely
    this.numStateComponents = 0;
  }

  addChild(child) {
    if (child.#parentEntity) {
      child.#parentEntity.removeChild(child);
    }
    this.#childEntities.push(child);
    child.#parentEntity = this;
  }

  removeChild(child) {
    if (child.#parentEntity != this) return;

    // Should always get back a valid index. If you don't that means
    // #parentEntity was corrupted for this child.
    const childIndex = this.#childEntities.find(child);
    this.#childEntities.splice(childIndex, 1);
    child.#parentEntity = null;
  }

  traverse(callback, T) {
    if (!T || this.has(T)) { callback(this); }
    for (const child of this.#childEntities) {
      child.traverse(callback);
    }
  }

  traverseParents(callback, T) {
    if (this.#parentEntity) {
      if (!T || this.#parentEntity.has(T)) { callback(this.#parentEntity); }
      this.#parentEntity.traverseParents(callback);
    }
  }

  get parent() {
    return this.#parentEntity;
  }

  get children() {
    if (!this.#readonlyChildren) {
      this.#readonlyChildren = IS_DEBUG
      ? new Proxy(this.#childEntities, readonlyProxyHandler)
      : this.#childEntities;
    }
    return this.#readonlyChildren;
  }

  // COMPONENTS

  read(T, includeRemoved) {
    var component = this._components[T._typeId];

    if (!component && includeRemoved === true) {
      component = this._componentsToRemove[T._typeId];
    }

    return IS_DEBUG
      ? wrapImmutableComponent(component)
      : component;
  }

  modify(T) {
    var component = this._components[T._typeId];

    if (!component) {
      return;
    }

    for (var i = 0; i < this.queries.length; i++) {
      var query = this.queries[i];
      // @todo accelerate this check. Maybe having query._Components as an object
      // @todo add Not components
      if (query.reactive && query.Components.indexOf(T) !== -1) {
        query.eventDispatcher.dispatchEvent(
          Query.prototype.COMPONENT_CHANGED,
          this,
          component
        );
      }
    }
    return component;
  }

  add(component, values) {
    if (Component.isPrototypeOf(component)) {
      // Single component at a time
      this._entityManager.entityAddComponent(this, component, values);
    } else {
      // Dictionary of components
      for (const key in component) {
        this._entityManager.entityAddComponentByName(this, key, component[key]);
      }
    }
    return this;
  }

  remove(component, forceImmediate) {
    this._entityManager.entityRemoveComponent(this, component, forceImmediate);
    return this;
  }

  has(component, includeRemoved) {
    return (
      !!~this._ComponentTypes.indexOf(component) ||
      (includeRemoved === true && this.hasRemovedComponent(component))
    );
  }

  getRemovedComponent(component) {
    const c = this._componentsToRemove[component._typeId];

    return IS_DEBUG
      ? wrapImmutableComponent(component, c)
      : c;
  }

  getComponents() {
    return this._components;
  }

  getComponentsToRemove() {
    return this._componentsToRemove;
  }

  getComponentTypes() {
    return this._ComponentTypes;
  }

  hasRemoved(component) {
    return !!~this._ComponentTypesToRemove.indexOf(component);
  }

  hasAll(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.has(Components[i])) return false;
    }
    return true;
  }

  hasAny(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (this.has(Components[i])) return true;
    }
    return false;
  }

  removeAll(forceImmediate) {
    return this._entityManager.entityRemoveAllComponents(this, forceImmediate);
  }

  copy(src) {
    // TODO: This can definitely be optimized
    for (var ecsyComponentId in src._components) {
      var srcComponent = src._components[ecsyComponentId];
      this.addComponent(srcComponent.constructor);
      var component = this.getComponent(srcComponent.constructor);
      component.copy(srcComponent);
    }

    return this;
  }

  clone() {
    return new Entity(this._entityManager).copy(this);
  }

  reset() {
    this.id = this._entityManager._nextEntityId++;
    this._ComponentTypes.length = 0;
    this.queries.length = 0;

    for (var ecsyComponentId in this._components) {
      delete this._components[ecsyComponentId];
    }
  }

  delete(forceImmediate) {
    return this._entityManager.removeEntity(this, forceImmediate);
  }
}
