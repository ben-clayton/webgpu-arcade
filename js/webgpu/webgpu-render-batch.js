import { mat4 } from 'gl-matrix';

const IDENTITY_MATRIX = mat4.create();

export class WebGPURenderBatch {
  pipelineGeometries = new Map();
  sortedPipelines;
  instanceBuffer;

  clear() {
    this.pipelineGeometries = new Map();
    this.sortedPipelines = null;
    this.instanceBuffer = null;
  }

  addMesh(gpuMesh, transform, instanceCount = 1) {
    for (const gpuPrimitive of gpuMesh.primitives) {
      const geometry = gpuPrimitive.geometry;
      const pipeline = gpuPrimitive.pipeline;
      const material = gpuPrimitive.bindGroups;

      let geometryMaterials = this.pipelineGeometries.get(pipeline);
      if (!geometryMaterials) {
        geometryMaterials = new Map();
        this.pipelineGeometries.set(pipeline, geometryMaterials);
      }
      let materialInstances = geometryMaterials.get(geometry);
      if (!materialInstances) {
        materialInstances = new Map();
        geometryMaterials.set(geometry, materialInstances);
      }
      let instances = materialInstances.get(material);
      if (!instances) {
        instances = {instanceCount: 0, transforms: [], bufferOffset: 0};
        materialInstances.set(material, instances);
      }

      instances.instanceCount += instanceCount;
      instances.transforms.push(transform?.worldMatrix || IDENTITY_MATRIX);
    }
  }
}