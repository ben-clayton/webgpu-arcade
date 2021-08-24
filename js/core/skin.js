let nextSkinId = 1;

export class Skin {
  id = nextSkinId++;
  joints = [];
  ibmBuffer;
  ibmOffset;

  constructor(options) {
    this.joints.push(...options.joints);
    this.ibmBuffer = options.inverseBindMatrixBuffer;
    this.ibmOffset = options.inverseBindMatrixOffset || 0;

    const ibmLength = Math.floor((this.ibmBuffer.size - this.ibmOffset) / (16 * Float32Array.BYTES_PER_ELEMENT));

    if (this.joints.length > ibmLength) {
      throw new Error('Skin must have at least as many inverse bind matrices as joints');
    }
  }
}