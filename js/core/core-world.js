import { World } from '../ecs/world.js';
import { Geometry, GeometryError, RenderGeometry } from './geometry.js';
import { Position, Rotation, Scale, TransformMatrix,
         LocalTransform, WorldTransform, Parent, TransformSystem } from './transform.js';
import { PerspectiveCamera, OrthographicCamera, Projection, CameraSystem } from './camera.js';

export class CoreWorld extends World {
  constructor(options = {}) {
    super();

    // Geometry
    this.registerComponent(Geometry);
    this.registerComponent(GeometryError);
    this.registerComponent(RenderGeometry);

    // Transform
    this.registerComponent(Position);
    this.registerComponent(Rotation);
    this.registerComponent(Scale);
    this.registerComponent(TransformMatrix);
    this.registerComponent(LocalTransform);
    this.registerComponent(WorldTransform);
    this.registerComponent(Parent);
    this.registerSystem(TransformSystem);

    // Camera
    this.registerComponent(PerspectiveCamera);
    this.registerComponent(OrthographicCamera);
    this.registerComponent(Projection);
    this.registerSystem(CameraSystem);
  }
}