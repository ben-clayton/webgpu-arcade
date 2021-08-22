import { System } from 'ecs';
import { Mesh } from '../core/geometry.js';
import { WebGPUMaterialFactory, WebGPUMaterialBindGroups } from './materials/webgpu-materials.js';

export class WebGPUMeshPrimitive {
  constructor(geometry, pipeline, bindGroups) {
    this.geometry = geometry;
    this.pipeline = pipeline;
    this.bindGroups = bindGroups || new WebGPUMaterialBindGroups();
  }
}

export class WebGPUMesh {
  primitives = [];

  constructor(...gpuPrimitives) {
    this.primitives.push(...gpuPrimitives);
  }
}

export class WebGPUMeshSystem extends System {
  #factories = new Map();

  async init(gpu) {
    this.needsGpuMeshQuery = this.query(Mesh).not(WebGPUMesh);

    const materialFactories = WebGPUMaterialFactory.getFactories();
    for (const [material, factoryConstructor] of materialFactories) {
      const factory = new factoryConstructor();
      this.#factories.set(material, factory);
      factory.init(gpu);
    }
  }

  execute(delta, time) {
    const gpu = this.world;

    this.needsGpuMeshQuery.forEach((entity, mesh) => {
      const gpuPrimitives = [];
      for (const primitive of mesh.primitives) {
        const layout = primitive.geometry.layout;
        const material = primitive.material;
        const factory = this.#factories.get(material.constructor);
        if (!factory) {
          throw new Error(`No WebGPUMaterialFactory registered for ${material.constructor.name}`);
        }

        gpuPrimitives.push(new WebGPUMeshPrimitive(
          primitive.geometry,
          factory.getPipeline(gpu, layout, material),
          factory.getBindGroup(gpu, material)
        ));
      }
      entity.add(new WebGPUMesh(...gpuPrimitives));
    });
  }
}
