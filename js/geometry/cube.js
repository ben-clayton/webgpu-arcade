import { Geometry, InterleavedAttributes } from '../core/geometry.js';

export class CubeGeometry extends Geometry {
  constructor(gpu, width = 1, height = 1, depth = 1) {
    const w = width * 0.5;
    const h = height * 0.5;
    const d = depth * 0.5;

    const cubeVerts = new Float32Array([
      //position,  normal,    uv,
      w, -h, d,    0, -1, 0,  1, 1,
      -w, -h, d,   0, -1, 0,  0, 1,
      -w, -h, -d,  0, -1, 0,  0, 0,
      w, -h, -d,   0, -1, 0,  1, 0,
      w, -h, d,    0, -1, 0,  1, 1,
      -w, -h, -d,  0, -1, 0,  0, 0,

      w, h, d,     1, 0, 0,   1, 1,
      w, -h, d,    1, 0, 0,   0, 1,
      w, -h, -d,   1, 0, 0,   0, 0,
      w, h, -d,    1, 0, 0,   1, 0,
      w, h, d,     1, 0, 0,   1, 1,
      w, -h, -d,   1, 0, 0,   0, 0,

      -w, h, d,    0, 1, 0,   1, 1,
      w, h, d,     0, 1, 0,   0, 1,
      w, h, -d,    0, 1, 0,   0, 0,
      -w, h, -d,   0, 1, 0,   1, 0,
      -w, h, d,    0, 1, 0,   1, 1,
      w, h, -d,    0, 1, 0,   0, 0,

      -w, -h, d,   -1, 0, 0,  1, 1,
      -w, h, d,    -1, 0, 0,  0, 1,
      -w, h, -d,   -1, 0, 0,  0, 0,
      -w, -h, -d,  -1, 0, 0,  1, 0,
      -w, -h, d,   -1, 0, 0,  1, 1,
      -w, h, -d,   -1, 0, 0,  0, 0,

      w, h, d,     0, 0, 1,   1, 1,
      -w, h, d,    0, 0, 1,   0, 1,
      -w, -h, d,   0, 0, 1,   0, 0,
      -w, -h, d,   0, 0, 1,   0, 0,
      w, -h, d,    0, 0, 1,   1, 0,
      w, h, d,     0, 0, 1,   1, 1,

      w, -h, -d,   0, 0, -1,  1, 1,
      -w, -h, -d,  0, 0, -1,  0, 1,
      -w, h, -d,   0, 0, -1,  0, 0,
      w, h, -d,    0, 0, -1,  1, 0,
      w, -h, -d,   0, 0, -1,  1, 1,
      -w, h, -d,   0, 0, -1,  0, 0,
    ]);

    const vertBuffer = gpu.createStaticBuffer(cubeVerts);
    const attributes = new InterleavedAttributes(vertBuffer, 32)
        .addAttribute('position', 0)
        .addAttribute('normal', 12)
        .addAttribute('texcoord', 24);

    super({
      attributes: [attributes],
      drawCount: 36
    });
  }
}
