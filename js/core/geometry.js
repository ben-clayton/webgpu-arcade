export const Attribute = {
  position: 0,
  normal: 1,
  tangent: 2,
  texCoord: 3,
  color: 4,
};

const DefaultAttributeFormat = {
  position: 'float32x3',
  normal: 'float32x3',
  tangent: 'float32x3',
  texCoord: 'float32x2',
  color: 'float32x4'
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

export class InterleavedBuffer {
  constructor(array, arrayStride) {
    this.array = array;
    this.arrayStride = arrayStride;
    this.attributes = [];
    this.maxVertexCount = Math.floor(array.length * array.BYTES_PER_ELEMENT) / arrayStride;
    this.minOffset = Number.MAX_SAFE_INTEGER;
  }

  addAttribute(attribute, offset = 0, format) {
    const shaderLocation = Attribute[attribute];
    if (format === undefined) {
      format = DefaultAttributeFormat[attribute];
      if (!format) {
        throw new Error(`Unable to determine attribute format for ${attribute}.`);
      }
    }
    this.minOffset = Math.min(this.minOffset, offset);
    this.attributes.push({attribute, shaderLocation, offset, format});
    return this;
  }
};

export class AttributeBuffer extends InterleavedBuffer {
  constructor(attribute, array, format, arrayStride) {
    if (format === undefined) {
      format = DefaultAttributeFormat[attribute];
      if (!format) {
        throw new Error(`Unable to determine attribute format for ${attribute}.`);
      }
    }
    if (!arrayStride) {
      arrayStride = DefaultStride[format];
    }
    super(array, arrayStride);
    super.addAttribute(attribute, 0, format);
  }

  addAttribute() {
    throw new Error('Cannot add attributes to a AttributeBuffer. Use InterleavedBuffer instead.');
  }
};

export class StaticGeometry {
  indexArray = null;
  buffers = [];
  drawCount = 0;
  topology = 'triangle-list';

  constructor(drawCount = 0, ...buffers) {
    this.drawCount = drawCount;
    this.buffers.push(...buffers);
  }

  get indexFormat() {
    return this.indexBuffer?.BYTES_PER_ELEMENT == 2 ? 'uint16' : 'uint32';
  }
}