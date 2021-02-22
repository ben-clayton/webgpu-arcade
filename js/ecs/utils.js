/**
 * Return the name of a component
 * @param {Component} Component
 * @private
 */
export function getName(Component) {
  return Component.name;
}

/**
 * Return a valid property name for the Component
 * @param {Component} Component
 * @private
 */
export function componentPropertyName(Component) {
  return getName(Component);
}

/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 * @private
 */
export function queryKey(Components) {
  var ids = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];

    if (!componentRegistered(T)) {
      throw new Error(`Tried to create a query with an unregistered component`);
    }

    if (typeof T === "object") {
      let components = "";
      for (const c of T.Components) {
        components += `${c._typeId},`;
      }
      ids.push(`${T.operator}(${components})`);
    } else {
      ids.push(T._typeId);
    }
  }

  return ids.sort().join("-");
}

// Detector for browser's "window"
export const hasWindow = typeof window !== "undefined";

// performance.now() "polyfill"
export const now =
  hasWindow && typeof window.performance !== "undefined"
    ? performance.now.bind(performance)
    : Date.now.bind(Date);

export function componentRegistered(T) {
  if (typeof T === "object") {
    for (const c of T.Components) {
      if (c._typeId === undefined) {
        return false;
      }
    }
    return true;
  }
  return (T.isComponent && T._typeId !== undefined);
}
