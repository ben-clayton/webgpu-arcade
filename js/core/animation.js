export class AnimationSampler {
  constructor(times, values, gpuType, elementStride) {
    this.times = times;
    this.startTime = this.times[0];
    this.endTime = this.times[this.times.length - 1];

    this.values = values;
    this.gpuType = gpuType;
    this.elementStride = elementStride;
  }

  getTimeIndex(time) {
    // There's gotta be a better way!
    if (time < this.startTime) {
      return 0;
    }
    if (time >= this.endTime) {
      return this.times.length - 1;
    }
    for (let i = 0; i < this.times.length; ++i) {
      if (time < this.times[i]) {
        return i;
      }
    }
  }
}