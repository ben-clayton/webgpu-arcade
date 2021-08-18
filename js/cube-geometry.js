import { Geometry, InterleavedAttributes } from './core/geometry.js';

const CUBE_VERTS = new Float32Array([
//position,    color,       uv,
  1, -1, 1,    1, 0, 1, 1,  1, 1,
  -1, -1, 1,   0, 0, 1, 1,  0, 1,
  -1, -1, -1,  0, 0, 0, 1,  0, 0,
  1, -1, -1,   1, 0, 0, 1,  1, 0,
  1, -1, 1,    1, 0, 1, 1,  1, 1,
  -1, -1, -1,  0, 0, 0, 1,  0, 0,

  1, 1, 1,     1, 1, 1, 1,  1, 1,
  1, -1, 1,    1, 0, 1, 1,  0, 1,
  1, -1, -1,   1, 0, 0, 1,  0, 0,
  1, 1, -1,    1, 1, 0, 1,  1, 0,
  1, 1, 1,     1, 1, 1, 1,  1, 1,
  1, -1, -1,   1, 0, 0, 1,  0, 0,

  -1, 1, 1,    0, 1, 1, 1,  1, 1,
  1, 1, 1,     1, 1, 1, 1,  0, 1,
  1, 1, -1,    1, 1, 0, 1,  0, 0,
  -1, 1, -1,   0, 1, 0, 1,  1, 0,
  -1, 1, 1,    0, 1, 1, 1,  1, 1,
  1, 1, -1,    1, 1, 0, 1,  0, 0,

  -1, -1, 1,   0, 0, 1, 1,  1, 1,
  -1, 1, 1,    0, 1, 1, 1,  0, 1,
  -1, 1, -1,   0, 1, 0, 1,  0, 0,
  -1, -1, -1,  0, 0, 0, 1,  1, 0,
  -1, -1, 1,   0, 0, 1, 1,  1, 1,
  -1, 1, -1,   0, 1, 0, 1,  0, 0,

  1, 1, 1,     1, 1, 1, 1,  1, 1,
  -1, 1, 1,    0, 1, 1, 1,  0, 1,
  -1, -1, 1,   0, 0, 1, 1,  0, 0,
  -1, -1, 1,   0, 0, 1, 1,  0, 0,
  1, -1, 1,    1, 0, 1, 1,  1, 0,
  1, 1, 1,     1, 1, 1, 1,  1, 1,

  1, -1, -1,   1, 0, 0, 1,  1, 1,
  -1, -1, -1,  0, 0, 0, 1,  0, 1,
  -1, 1, -1,   0, 1, 0, 1,  0, 0,
  1, 1, -1,    1, 1, 0, 1,  1, 0,
  1, -1, -1,   1, 0, 0, 1,  1, 1,
  -1, 1, -1,   0, 1, 0, 1,  0, 0,
]);
const VERTEX_STRIDE = 36;
const VERTEX_COUNT = 36;

export function createCubeGeometry(world) {
  const vertBuffer = world.createStaticBuffer(CUBE_VERTS);
  const attributes = new InterleavedAttributes(vertBuffer, VERTEX_STRIDE);
  attributes.addAttribute('position', 0);
  attributes.addAttribute('color', 12);
  attributes.addAttribute('texCoord', 28);
  return new Geometry({
    attributes,
    drawCount: VERTEX_COUNT
  });
}
