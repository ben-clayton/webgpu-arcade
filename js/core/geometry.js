export const AttributeLocation = {
  position: 0,
  normal: 1,
  tangent: 2,
  texcoord: 3,
  texcoord2: 4,
  color: 5,
  joints: 6,
  weights: 7,
};

const DefaultAttributeFormat = {
  position: 'float32x3',
  normal: 'float32x3',
  tangent: 'float32x3',
  texcoord: 'float32x2',
  texcoord2: 'float32x2',
  color: 'float32x4',
  joints: 'uint16x4',
  weights: 'float32x4',
};

const DefaultStride = {
  uint8x2: 2,
  uint8x4: 4,
  sint8x2: 2,
  sint8x4: 4,
  unorm8x2: 2,
  unorm8x4: 4,
  snorm8x2: 2,
  snorm8x4: 4,
  uint16x2: 4,
  uint16x4: 8,
  sint16x2: 4,
  sint16x4: 8,
  unorm16x2: 4,
  unorm16x4: 8,
  snorm16x2: 4,
  snorm16x4: 8,
  float16x2: 4,
  float16x4: 8,
  float32: 4,
  float32x2: 8,
  float32x3: 12,
  float32x4: 16,
  uint32: 4,
  uint32x2: 8,
  uint32x3: 12,
  uint32x4: 16,
  sint32: 4,
  sint32x2: 8,
  sint32x3: 12,
  sint32x4: 16,
};

export class StaticBuffer {
  #size;
  #usage;

  constructor(size, usage) {
    this.#size = size;
    this.#usage = usage;
  }

  get size() {
    return this.#size;
  }

  get usage() {
    return this.#usage;
  }

  get arrayBuffer() {
    throw new Error('arrayBuffer getter must be overriden in an extended class');
  }

  finish() {
    throw new Error('finish() must be overriden in an extended class');
  }
}

export class DynamicBuffer extends StaticBuffer {
  beginUpdate() {
    throw new Error('beginUpdate() must be overriden in an extended class');
  }
}

export class InterleavedAttributes {
  constructor(buffer, stride) {
    this.buffer = buffer;
    this.arrayStride = stride;
    this.attributes = [];
    this.minOffset = Number.MAX_SAFE_INTEGER;
  }

  addAttribute(attribute, offset = 0, format) {
    const shaderLocation = AttributeLocation[attribute];
    if (format === undefined) {
      format = DefaultAttributeFormat[attribute];
      if (!format) {
        return;
        throw new Error(`Unable to determine attribute format for ${attribute}.`);
      }
    }
    this.minOffset = Math.min(this.minOffset, offset);
    this.attributes.push({attribute, shaderLocation, offset, format});
    return this;
  }
};

export class Attribute extends InterleavedAttributes {
  constructor(attribute, buffer, format, stride) {
    if (format === undefined) {
      format = DefaultAttributeFormat[attribute];
      if (!format) {
        throw new Error(`Unable to determine attribute format for ${attribute}.`);
      }
    }
    if (!stride) {
      stride = DefaultStride[format];
    }
    super(buffer, stride);
    super.addAttribute(attribute, 0, format);
  }

  addAttribute() {
    throw new Error('Cannot add attributes to a AttributeBuffer. Use InterleavedBuffer instead.');
  }
};

export class Geometry {
  indices = null;
  indexFormat = 'uint32';
  indexOffset = 0;
  buffers = [];
  drawCount = 0;
  topology = 'triangle-list';

  constructor(drawCount = 0, ...attributes) {
    this.drawCount = drawCount;
    this.buffers.push(...attributes);
  }
}