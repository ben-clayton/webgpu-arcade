class Entity {
  constructor(worldData, entityId) {
    this.#worldData = worldData;
    this.#destroyed = false;
    this.id = entityId;

    this.#worldData.entities.set(this.id, this);
  }

  add(...components) {
    if (this.#destroyed) {
      throw new Error(`Entity ${id} has been destroyed`);
    }

    for (const component of components) {
      let componentSet = this.#worldData.components[component.constructor];
      if (componentSet === undefined) {
        this.#worldData.components[component.constructor] = componentSet = new Map();
      }
      componentSet[this.id] = component;
    }
  }

  remove(componentType, destroyComponent = true) {
    const componentSet = this.#worldData.components[componentType];
    if (!componentSet) { return undefined; }
    const component = componentSet[this.id];
    delete componentSet[this.id];
    if (destroyComponent && component?.destroy !== undefined) {
      component.destroy();
    }
    return component;
  }

  has(compomentType) {
    const componentSet = this.#worldData.components[compnentType];
    return componentSet !== undefined && componentSet[this.id] !== undefined;
  }

  get(componentType) {
    const componentSet = this.#worldData.components[componentType];
    return componentSet !== undefined ? componentSet[this.id] : undefined;
  }

  destroy() {
    this.#worldData.entities.delete(this.id);
    this.#destroyed = true;
    for (const componentSet in this.#worldData.components.values()) {
      const component = componentSet[this.id];
      delete componentSet[this.id];
      if (component !== undefined && component.destroy !== undefined) {
        component.destroy();
      }
    }
  }
}

function getComponentName(component) {
  return component.constructor.name ?? component.name;
}

class WorldData {
  nextEntityId = 1;
  entities = new Map();
  components = new Map();
  queries = new Map();
}

export class World {
  #data = new WorldData();

  get entities() {
    return this.#data.entities.values();
  }

  create(...components) {
    const id = this.#data.nextEntityId++;
    const entity = new Entity(this.#data, id);
    entity.add(...components);
    return entity;
  }

  clear() {
    for (const entity of this.#worldData.entities.values()) {
      entity.destroy();
    }
  }

  query(...componentTypes) {
    let componentNames = [];
    for(const type of componentTypes) {
      componentNames.push(getComponentName(type));
    }
    const queryName = componentNames.join(':');
    const cachedQuery = this.#worldData.queries[queryName];
    if (cachedQuery !== undefined) { return cachedQuery; }
    return new WorldQueryResult(this.#worldData, queryName, componentTypes);
  }
}

class WorldQueryResult {
  constructor(worldData, queryName, includedTypes, excludedTypes = []) {
    this.#worldData = worldData;
    this.queryName = queryName;
    this.#worldData.queries[queryName] = this;

    this.include = includedTypes;
    this.exclude = excludedTypes;

    // Sanity check to ensure you don't end up with invalid queries
    for (const type of excludedTypes) {
      if (includedTypes.includes(type)) {
        throw new Error(`Component type "${getComponentName(type)}" cannot be both included and excluded in the same query.`);
      }
    }
  }

  not(...componentTypes) {
    let componentNames = [];
    for(const type of componentTypes) {
      componentNames.push(getComponentName(type));
    }
    const queryName = this.queryName + '!' + componentNames.join(':!');
    const cachedQuery = this.#worldData.queries[queryName];
    if (cachedQuery !== undefined) { return cachedQuery; }
    return new WorldQueryResult(this.#worldData, queryName, this.include, this.exclude.concat(componentTypes));
  }

  forEach(callback) {
    const args = new Array(this.include.length);
    for (const entity of this.world.entities) {
      let excluded = false;
      for (const componentId of this.exclude) {
        if (entity.has(componentId)) {
          excluded = true;
          break;
        }
      }
      if (excluded) { continue; }

      for (let i = 0; i < this.include.length; ++i) {
        const component = entity.get(this.include[i]);
        if (component === undefined) {
          excluded = true;
          break;
        }
        args[i] = component;
      }
      if (excluded) { continue; }

      const keepIterating = callback(entity, ...args);
      if (keepIterating === false) { return; }
    }
  }
}