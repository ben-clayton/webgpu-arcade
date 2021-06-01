import { Component, System, Types } from 'ecs';

export class OutputCanvas extends Component {
  static schema = {
    canvas: { type: Types.Ref },
    width: { type: Types.Number },
    height: { type: Types.Number },
  };
}

export class OutputCanvasSystem extends System {
  static queries = {
    canvases: { components: [OutputCanvas], listen: { added: true, removed: true } },
  };

  init() {
    this.resizeEntities = new WeakMap();
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const entity = this.resizeEntities.get(entry.target);
        if (!entity) { continue; }

        if (entry.devicePixelContentBoxSize) {
          // Should give exact pixel dimensions, but only works on Chrome
          this.canvasResized(entity,
            entry.devicePixelContentBoxSize[0].inlineSize,
            entry.devicePixelContentBoxSize[0].blockSize);
        } else if(entry.contentBoxSize) {
          // Firefox implements `contentBoxSize` as a single content rect, rather than an array
          const contentBoxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
          this.canvasResized(entity,
            contentBoxSize.inlineSize,
            contentBoxSize.blockSize);
        } else {
          this.canvasResized(entity, entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
  }

  canvasResized(entity, pixelWidth, pixelHeight) {
    const output = entity.modify(OutputCanvas);
    output.canvas.width = pixelWidth;
    output.canvas.height = pixelHeight;
    output.width = pixelWidth;
    output.height = pixelHeight;
  }

  execute() {
    this.queries.canvases.added.forEach(entity => {
      const output = entity.read(OutputCanvas);
      this.resizeObserver.observe(output.canvas);
      this.resizeEntities.set(output.canvas, entity);
    });

    this.queries.canvases.removed.forEach(entity => {
      const output = entity.read(OutputCanvas);
      this.resizeObserver.unobserve(output.canvas);
      this.resizeEntities.delete(output.canvas);
    });
  }
}