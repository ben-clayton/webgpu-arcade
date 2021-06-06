import { System } from 'ecs';

export class OutputCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = canvas.width = canvas.offsetWidth * devicePixelRatio;
    this.height = canvas.height = canvas.offsetHeight * devicePixelRatio;
  }
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
    const output = entity.get(OutputCanvas);
    output.width = output.canvas.width = pixelWidth;
    output.height = output.canvas.height = pixelHeight;
  }

  execute() {
    this.query(OutputCanvas).forEach((entity, output) => {
      if (!this.resizeEntities.has(entity)) {
        this.resizeObserver.observe(output.canvas);
        this.resizeEntities.set(output.canvas, entity);
      }
    });

    // TODO: Handle removing canvases from the observer
  }
}