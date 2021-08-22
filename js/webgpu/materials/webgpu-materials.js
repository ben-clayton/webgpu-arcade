import { WebGPUMaterialFactory, RenderOrder } from './webgpu-material-factory.js';

// It's necessary to include these material files to register their factories,
// though we don't need to import anything from them explicitly.
import './webgpu-pbr-material.js';
import './webgpu-unlit-material.js';

export { WebGPUMaterialFactory, RenderOrder };
