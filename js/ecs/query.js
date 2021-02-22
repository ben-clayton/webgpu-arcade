import { EventDispatcher } from "./event-dispatcher.js";
import { queryKey } from "./utils.js";

export class Query {
  /**
   * @param {Array(Component)} Components List of types of components to query
   */
  constructor(Components, manager) {
    this.AllComponents = [];
    this.NotComponents = [];
    this.AnyComponents = [];

    this.Components = [];

    Components.forEach((component) => {
      if (typeof component === "object") {
        switch (component.operator) {
          case "not":
            this.NotComponents.push(...component.Components);
            break;
          case "any":
            this.AnyComponents.push(component.Components);
            this.Components.push(...component.Components);
            break;
          default:
            throw new Error(`Unknown operator: ${component.operator}`);
        }

      } else {
        this.AllComponents.push(component);
        this.Components.push(component);
      }
    });

    if (this.Components.length === 0) {
      throw new Error("Can't create a query without components");
    }

    this.entities = [];

    this.eventDispatcher = new EventDispatcher();

    // This query is being used by a reactive system
    this.reactive = false;

    this.key = queryKey(Components);

    // Fill the query with the existing entities
    for (var i = 0; i < manager._entities.length; i++) {
      var entity = manager._entities[i];
      if (this.match(entity)) {
        // @todo ??? this.addEntity(entity); => preventing the event to be generated
        entity.queries.push(this);
        this.entities.push(entity);
      }
    }
  }

  /**
   * Add entity to this query
   * @param {Entity} entity
   */
  addEntity(entity) {
    entity.queries.push(this);
    this.entities.push(entity);

    this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);
  }

  /**
   * Remove entity from this query
   * @param {Entity} entity
   */
  removeEntity(entity) {
    let index = this.entities.indexOf(entity);
    if (~index) {
      this.entities.splice(index, 1);

      index = entity.queries.indexOf(this);
      entity.queries.splice(index, 1);

      this.eventDispatcher.dispatchEvent(
        Query.prototype.ENTITY_REMOVED,
        entity
      );
    }
  }

  match(entity) {
    for (const any of this.AnyComponents) {
      if (!entity.hasAny(any)) {
        return false;
      }
    }
    return (
      entity.hasAll(this.AllComponents) &&
      !entity.hasAny(this.NotComponents)
    );
  }

  toJSON() {
    return {
      key: this.key,
      reactive: this.reactive,
      components: {
        included: this.AllComponents.map((C) => C.name),
        not: this.NotComponents.map((C) => C.name),
        // TODO: Reflect 'any' operators
      },
      numEntities: this.entities.length,
    };
  }

  /**
   * Return stats for this query
   */
  stats() {
    return {
      numComponents: this.Components.length,
      numEntities: this.entities.length,
    };
  }
}

Query.prototype.ENTITY_ADDED = "Query#ENTITY_ADDED";
Query.prototype.ENTITY_REMOVED = "Query#ENTITY_REMOVED";
Query.prototype.COMPONENT_CHANGED = "Query#COMPONENT_CHANGED";
