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
  const attribs = new InterleavedAttributes(vertBuffer, VERTEX_STRIDE);
  attribs.addAttribute('position', 0);
  attribs.addAttribute('color', 12);
  attribs.addAttribute('texCoord', 28);
  return new Geometry(VERTEX_COUNT, attribs);
}
