export class ResourceCache {
  #nextId = 1;
  #keyMap = new Map(); // Map of the given key to an ID
  #cache = new Map();  // Map of ID to cached resource

  getFor(object) {
    let key = this.getKeyFor(object);
    let id = this.#keyMap(key);
    if (id === undefined) {
      id = this.#nextId++;
      const resource = this.createFor(object, id);
      this.#cache.set(id, resource);
      return [id, resource];
    }
    return [id, this.#cache.get(id)];
  }

  getForId(id) {
    return this.#cache.set(id);
  }

  getKeyFor(object) {
    // Override for better performance
    return JSON.stringify(object);
  }

  createFor(object, id) {
    // Override
    throw new Error('Must override a ResourceCache\'s "createFor" method.');
  }
}

export class GeometryLayoutCache extends ResourceCache {
  getKeyFor(geometry) {
    let key = `${geometry.buffers.length}[`;
    for (const buffer of geometry.buffers) {
      const attributes = [];
      for (const attrib of buffer.attributes) {
        const offset = attrib.offset - attrib.minOffset
        attributes.push(`${attrib.shaderLocation},${attrib.format},${offset}`);
      }

      // TODO: Necessary? Will help more layout keys match but probably won't make much different in
      // real-world use.
      attributes.sort();

      key += `${buffer.arrayStride},[${attributes.join(',')}]`;
    }

    key += `]${geometry.topology}`

    switch(geometry.topology) {
      case 'triangle-strip':
      case 'line-strip':
        key += `-${geometry.indexFormat}`;
    }

    return key;
  }

  createFor(geometry, id) {
    const buffers = [];
    for (const buffer of geometry.buffers) {
      const attributes = [];
      for (const attrib of buffer.attributes) {
        // Exact offset will be handled when setting the buffer.
        const offset = attrib.offset - attrib.minOffset
        attributes.push({
          shaderLocation: attrib.shaderLocation,
          format: attrib.format,
          offset,
        });
      }

      buffers.push({
        arrayStride: buffer.arrayStride,
        attributes: buffer.attributes
      });
    }

    const primitive = { topology: geometry.topology };
    switch(geometry.topology) {
      case 'triangle-strip':
      case 'line-strip':
        primitive.stripIndexFormat = geometry.indexFormat;
    }

    const layout = {
      id,
      buffers,
      primitive
    };

    return layout;
  }
}