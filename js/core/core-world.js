import { World } from '../ecs/world.js';
import { Geometry, GeometryError, RenderGeometry } from './components/geometry.js';
import { Position, Rotation, Scale, TransformMatrix,
         LocalTransform, WorldTransform, Parent } from './components/transform.js';
import { TransformSystem } from './systems/transform-system.js';

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
  }
}