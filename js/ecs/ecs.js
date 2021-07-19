class Entity {
  #worldData;
  #destroyed = false;

  constructor(worldData, entityId) {
    this.id = entityId;
    this.#worldData = worldData;
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
      component.addedToEntity?.(this.id);
    }

    return this;
  }

  remove(componentType) {
    const componentSet = this.#worldData.components[componentType];
    if (!componentSet) { return undefined; }
    const component = componentSet[this.id];
    delete componentSet[this.id];
    component.removedFromEntity?.(this.id);
    return component;
  }

  has(compomentType) {
    const componentSet = this.#worldData.components[compomentType];
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

class SingletonEntity extends Entity {
  destroy() {
    throw new Error('The singleton entity cannot be destroyed');
  }
}

function getComponentName(component) {
  return component.name ?? component.constructor.name;
}

class WorldData {
  entities = new Map();
  components = new Map();
  queries = new Map();
  systems = new Map();

  getQuery(componentTypes) {
    let componentNames = [];
    for(const type of componentTypes) {
      componentNames.push(getComponentName(type));
    }
    const queryName = componentNames.join(':');
    const cachedQuery = this.queries[queryName];
    if (cachedQuery !== undefined) { return cachedQuery; }
    return new Query(this, queryName, componentTypes);
  }
}

export class World {
  #worldData = new WorldData();
  #nextEntityId = 1;
  #singletonEntity;
  #lastTime = performance.now() / 1000;

  constructor() {
    // Singleton entity is not added to the global list of entities.
    this.#singletonEntity = new SingletonEntity(this.#worldData, 0);
  }

  get entities() {
    return this.#worldData.entities.values();
  }

  get singleton() {
    return this.#singletonEntity;
  }

  create(...components) {
    const id = this.#nextEntityId++;
    const entity = new Entity(this.#worldData, id);
    entity.add(...components);
    this.#worldData.entities.set(id, entity);
    return entity;
  }

  registerSystem(systemType, ...initArgs) {
    const system = new systemType(this, this.#worldData);
    this.#worldData.systems.set(systemType, system);
    if (system.init !== undefined) {
      system.init(...initArgs);
    }
    return this;
  }

  clear() {
    for (const entity of this.#worldData.entities.values()) {
      entity.destroy();
    }
  }

  query(...componentTypes) {
    return this.#worldData.getQuery(componentTypes);
  }

  execute(delta, time) {
    if (!delta) {
      time = performance.now() / 1000;
      delta = time - this.#lastTime;
      this.#lastTime = time;
    }

    for (const system of this.#worldData.systems.values()) {
      system.execute(delta, time);
    }
  }
}

export class System {
  #worldData;

  constructor(world, worldData) {
    this.world = world;
    this.#worldData = worldData;
  }

  query(...componentTypes) {
    return this.#worldData.getQuery(componentTypes);
  }

  get singleton() {
    return this.world.singleton;
  }

  execute(delta, time) {}
}

class Query {
  #worldData;

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
    return new Query(this.#worldData, queryName, this.include, this.exclude.concat(componentTypes));
  }

  forEach(callback) {
    const args = new Array(this.include.length);
    for (const entity of this.#worldData.entities.values()) {
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