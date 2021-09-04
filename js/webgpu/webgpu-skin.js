import { WebGPUSystem } from './webgpu-system.js';
import { Skin } from '../core/skin.js';
import { Geometry, Attribute } from '../core/geometry.js';
import { Transform } from '../core/transform.js';
import { WebGPUMesh, WebGPUMeshPrimitive } from './webgpu-mesh.js';
import { WebGPUMaterialPipeline, RenderOrder, WebGPUMaterialBindGroups } from './materials/webgpu-materials.js';
import { WebGPURenderBatch } from './webgpu-instancing.js';
import { BoneVertexSource, BoneFragmentSource } from './wgsl/debug.js';

export class WebGPUSkin {
  id;
  jointBuffer;
  bindGroup;
  mesh;
}

const BONE_VERTS = new Float32Array([
   0.0,  0.0, -0.1,
   0.1,  0.0,  0.0,
   0.0,  0.1,  0.0,
  -0.1,  0.0,  0.0,
   0.0, -0.1,  0.0,
   0.0,  0.0,  0.1,
]);

const BONE_INDICES = new Uint16Array([
  0, 1, 0, 2, 0, 3, 0, 4,
  1, 2, 2, 3, 3, 4, 4, 1,
  1, 5, 2, 5, 3, 5, 4, 5,
]);

export class WebGPUSkinSystem extends WebGPUSystem {
  init(gpu) {
    const vertexModule = gpu.device.createShaderModule({
      code: BoneVertexSource,
      label: 'Bone Vertex'
    });
    const fragmentModule = gpu.device.createShaderModule({
      code: BoneFragmentSource,
      label: 'Bone Fragment'
    });

    // Setup a render pipeline for drawing the skybox
    this.pipeline = gpu.device.createRenderPipeline({
      label: `Bone Render Pipeline`,
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          gpu.bindGroupLayouts.frame,
          gpu.bindGroupLayout.skin,
        ]
      }),
      vertex: {
        module: vertexModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
          attributes: [{
            shaderLocation: 0,
            format: 'float32x3',
            offset: 0,
          }]
        }]
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format
        }],
      },
      depthStencil: {
        format: gpu.depthFormat,
      },
      primitive: {
        topology: 'line-list',
      },
      multisample: {
        count: gpu.sampleCount,
      }
    });

    const vertexBuffer = gpu.createStaticBuffer(BONE_VERTS, 'vertex');
    const indexBuffer = gpu.createStaticBuffer(BONE_INDICES, 'index');

    this.gpuPipeline = new WebGPUMaterialPipeline({
      pipeline: this.pipeline,
      renderOrder: RenderOrder.Last
    });

    this.geometry = new Geometry({
      drawCount: BONE_INDICES.length,
      attributes: [ new Attribute('position', vertexBuffer) ],
      indices: { buffer: indexBuffer, format: 'uint16' }
    });

    this.skinQuery = this.query(Skin);
  }

  execute(delta, time) {
    const gpu = this.world;

    const renderBatch = this.singleton.get(WebGPURenderBatch);

    this.skinQuery.forEach(async (entity, skin) => {
      let gpuSkin = entity.get(WebGPUSkin);
      if (!gpuSkin) {
        gpuSkin = new WebGPUSkin();
        gpuSkin.id = skin.id;
        gpuSkin.jointBuffer = gpu.createDynamicBuffer(skin.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT, 'joint');
        gpuSkin.bindGroup = gpu.device.createBindGroup({
          label: `Skin[${skin.id}] BindGroup`,
          layout: gpu.bindGroupLayout.skin,
          entries: [{
            binding: 0,
            resource: { buffer: gpuSkin.jointBuffer.gpuBuffer },
          }, {
            binding: 1,
            resource: { buffer: skin.ibmBuffer.gpuBuffer },
          }]
        });
        gpuSkin.debugMesh = new WebGPUMesh(
          new WebGPUMeshPrimitive(
            this.geometry,
            this.gpuPipeline,
            new WebGPUMaterialBindGroups(gpuSkin.bindGroup)
          )
        );
        entity.add(gpuSkin);
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

      // TODO: IF VISUALIZE BONES or something
      //renderBatch.addMesh(gpuSkin.debugMesh, undefined, skin.joints.length);
    });
  }
}