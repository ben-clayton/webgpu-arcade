export class PointLight {
  color = new Float32Array(3);
  intensity = 1;
  range = -1;

  constructor(r = 1, g = 1, b = 1) {
    this.color[0] = r;
    this.color[1] = g;
    this.color[2] = b;
  }

  get computedRange() {
    const lightRadius = 0.05;
    const illuminationThreshold = 0.001;
    return lightRadius * (Math.sqrt(this.intensity/illuminationThreshold) - 1);
  }
}

export class AmbientLight {
  color = new Float32Array(3);

  constructor(r = 0.1, g = 0.1, b = 0.1) {
    this.color[0] = r;
    this.color[1] = g;
    this.color[2] = b;
  }
}
