import { Component } from '../ecs/Component.js';
import { TagComponent } from '../ecs/TagComponent.js';
import { Types } from '../ecs/Types.js';

export const AttributeLocation = {
  position: 0,
  normal: 1,
  tangent: 2,
  texcoord: 3,
  color: 5
};

const DefaultAttributeType = {
  position: 'float3',
  normal: 'float3',
  tangent: 'float3',
  texcoord: 'float2',
  color: 'float4'
};

const DefaultStride = {
  uchar2: 2,
  uchar4: 4,
  char2: 2,
  char4: 4,
  uchar2norm: 2,
  uchar4norm: 4,
  char2norm: 2,
  char4norm: 4,
  ushort2: 4,
  ushort4: 8,
  short2: 4,
  short4: 8,
  ushort2norm: 4,
  ushort4norm: 8,
  short2norm: 4,
  short4norm: 8,
  half2: 4,
  half4: 8,
  float: 4,
  float2: 8,
  float3: 12,
  float4: 16,
  uint: 4,
  uint2: 8,
  uint3: 12,
  uint4: 16,
  int: 4,
  int2: 8,
  int3: 12,
  int4: 16,
};

export class VertexInterleavedAttributes {
  constructor(values, stride) {
    this.values = values;
    this.stride = stride;
    this.attributes = [];
    this.maxVertexCount = Math.floor(values.length * values.BYTES_PER_ELEMENT) / stride;
    this.minAttributeLocation = Number.MAX_SAFE_INTEGER;
  }

  addAttribute(location, offset = 0, format) {
    if (!format) {
      format = DefaultAttributeType[location];
    }
    if (typeof location == 'string') {
      location = AttributeLocation[location];
    }
    this.minAttributeLocation = Math.min(this.minAttributeLocation, location);
    this.attributes.push({location, offset, format});
    return this;
  }
};

export class VertexAttribute extends VertexInterleavedAttributes {
  constructor(location, values, format, stride) {
    if (!format) {
      format = DefaultAttributeType[location];
    }
    if (!stride) {
      stride = DefaultStride[format];
    }
    super(values, stride);
    super.addAttribute(location, 0, format);
  }

  addAttribute() {
    throw new Error('Cannot add attributes to a VertexAttribute. Use VertexInterleavedAttributes instead.');
  }
};

export class Geometry extends Component {
  static schema = {
    indices: { type: Types.Ref },
    vertices: { type: Types.Array },
    drawCount: { type: Types.Number },
    topology: { type: Types.String, default: 'triangle-list' }
  };
}

export class GeometryError extends Component {
  static schema = {
    message: { type: Types.String }
  };
}

export class RenderGeometry extends TagComponent {}
