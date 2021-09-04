import { System } from 'ecs';
import { Mesh } from '../core/geometry.js';
//import { WebGPUSkin } from './webgpu-skin.js';
import { WebGPUMaterialFactory, WebGPUMaterialBindGroups } from './materials/webgpu-materials.js';
import { WebGPURenderBatch } from './webgpu-render-batch.js';

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

export class WebGPUSkin {
  id;
  jointBuffer;
  bindGroup;
}

export class WebGPUMeshSystem extends System {
  #factories = new Map();
  #gpuMeshes = new WeakMap();
  #gpuSkins = new WeakMap();

  async init(gpu) {

    this.needsGpuMeshQuery = this.query(Mesh).not(WebGPUMesh);

    const materialFactories = WebGPUMaterialFactory.getFactories();
    for (const [material, factoryConstructor] of materialFactories) {
      const factory = new factoryConstructor();
      this.#factories.set(material, factory);
      factory.init(gpu);
    }
  }

  getOrUpdateWebGPUSkin(gpu, skin) {
    if (!skin) return null;

    let gpuSkin = this.#gpuSkins.get(skin);
    if (!gpuSkin) {
      gpuSkin = new WebGPUSkin();
      gpuSkin.id = skin.id;
      gpuSkin.jointBuffer = gpu.createDynamicBuffer(skin.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT, 'joint');
      gpuSkin.bindGroup = gpu.device.createBindGroup({
        label: `Skin[${skin.id}] BindGroup`,
        layout: gpu.bindGroupLayouts.skin,
        entries: [{
          binding: 0,
          resource: { buffer: gpuSkin.jointBuffer.gpuBuffer },
        }, {
          binding: 1,
          resource: { buffer: skin.ibmBuffer.gpuBuffer },
        }]
      });

      this.#gpuSkins.set(skin, gpuSkin);
    } else {
      gpuSkin.jointBuffer.beginUpdate();
    }

    // Push all of the current joint poses into the buffer.
    // TODO: Have a way to detect when joints are dirty and only push then.
    const buffer = new Float32Array(gpuSkin.jointBuffer.arrayBuffer);
    for (let i = 0; i < skin.joints.length; ++i) {
      buffer.set(skin.joints[i].worldMatrix, i * 16);
    }
    gpuSkin.jointBuffer.finish();

    return gpuSkin;
  }

  execute(delta, time) {
    const gpu = this.world;
    const renderBatch = this.singleton.get(WebGPURenderBatch);

    const meshInstances = gpu.getFrameMeshInstances();
    for (const mesh of meshInstances.keys()) {
      const skin = this.getOrUpdateWebGPUSkin(gpu, mesh.skin);
      let gpuMesh = this.#gpuMeshes.get(mesh);
      if (!gpuMesh) {
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
            factory.getPipeline(gpu, layout, material, !!skin),
            factory.getBindGroup(gpu, material, skin)
          ));
        }
        gpuMesh = new WebGPUMesh(...gpuPrimitives);
        this.#gpuMeshes.set(mesh, gpuMesh);
      }

      const instances = meshInstances.get(mesh);
      for (const transform of instances) {
        renderBatch.addMesh(gpuMesh, transform);
      }
    }

    /*this.needsGpuMeshQuery.forEach((entity, mesh) => {
      const gpuPrimitives = [];
      for (const primitive of mesh.primitives) {
        const layout = primitive.geometry.layout;
        const material = primitive.material;
        const factory = this.#factories.get(material.constructor);
        if (!factory) {
          throw new Error(`No WebGPUMaterialFactory registered for ${material.constructor.name}`);
        }

        const skin = this.getWebGPUSkin(gpu, mesh.skin);

        gpuPrimitives.push(new WebGPUMeshPrimitive(
          primitive.geometry,
          factory.getPipeline(gpu, layout, material, !!skin),
          factory.getBindGroup(gpu, material, skin)
        ));
      }
      entity.add(new WebGPUMesh(...gpuPrimitives));
    });*/
  }
}
