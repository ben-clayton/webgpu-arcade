import { System } from 'ecs';
import { Stage } from './stage.js';

let nextSkinId = 1;

export class Skin {
  id = nextSkinId++;
  joints = [];
  jointBuffer;
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

export class SkinSystem extends System {
  stage = Stage.PostFrameLogic;

  visualizeBones = true;

  execute() {
    const gpu = this.world;

    // Look through all of the meshes that will be rendered this frame and update any skins we find.
    const meshes = gpu.getFrameMeshInstances().keys();
    for (const mesh of meshes) {
      const skin = mesh.skin;
      if (skin) {
        if (!skin.jointBuffer) {
          skin.jointBuffer = gpu.createDynamicBuffer(skin.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT, 'joint');
        } else {
          skin.jointBuffer.beginUpdate();
        }

        // Push all of the current joint poses into the buffer.
        // TODO: Have a way to detect when joints are dirty and only push then.
        const buffer = new Float32Array(skin.jointBuffer.arrayBuffer);
        for (let i = 0; i < skin.joints.length; ++i) {
          buffer.set(skin.joints[i].worldMatrix, i * 16);
        }
        skin.jointBuffer.finish();
      }
    }
  }
}