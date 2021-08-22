import { System } from 'ecs';
import { Mesh } from '../core/geometry.js';
import { WebGPUMaterialFactory } from './materials/webgpu-materials.js';

export class WebGPUMeshMaterial {
  // One entry in each of these for each primitive in the original mesh.
  pipelines = [];
  bindGroups = [];
}

export class WebGPUMeshMaterialSystem extends System {
  #factories = new Map();

  async init(gpu) {
    this.needsMaterialQuery = this.query(Mesh).not(WebGPUMeshMaterial);

    const materialFactories = WebGPUMaterialFactory.getFactories();
    for (const [material, factoryConstructor] of materialFactories) {
      const factory = new factoryConstructor();
      this.#factories.set(material, factory);
      factory.init(gpu);
    }
  }

  execute(delta, time) {
    const gpu = this.world;

    this.needsMaterialQuery.forEach((entity, mesh) => {
      let meshMaterial = new WebGPUMeshMaterial();
      for (const primitive of mesh.primitives) {
        const layout = primitive.geometry.layout;
        const material = primitive.material;
        const factory = this.#factories.get(material.constructor);
        if (!factory) {
          throw new Error(`No WebGPUMaterialFactory registered for ${material.constructor.name}`);
        }
        meshMaterial.pipelines.push(factory.getPipeline(gpu, layout, material));
        meshMaterial.bindGroups.push(factory.getBindGroup(gpu, material));
      }
      entity.add(meshMaterial);
    });
  }
}
