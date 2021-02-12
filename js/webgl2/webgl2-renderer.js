import {System} from '../third-party/ecsy/src/System.js';
import {WebGL2, WebGL2RenderGeometry} from '../components/webgl2.js';

export class WebGPURenderer extends System {
  static queries = {
    renderable: { components: [WebGL2RenderGeometry] }
  };

  async init() {
    const gl2 = this.getMutableSingletonComponent(WebGL2);

    if (!gl2.canvas) {
      // Create a canvas if one is not available.
      gl2.canvas = document.createElement('canvas');
    }
    gl2.context = gpu.canvas.getContext('webgl2');

    gl2.canvas.width = gl2.canvas.offsetWidth * devicePixelRatio;
    gl2.canvas.height = gl2.canvas.offsetHeight * devicePixelRatio;

    this.updateRenderTargets();
  }

  checkResize(canvas) {
    // TODO: Monitor this better with events
    const canvasWidth = Math.floor(canvas.offsetWidth * devicePixelRatio);
    const canvasHeight = Math.floor(canvas.offsetWidth * devicePixelRatio);
    if (gl2.canvas.width != canvasWidth ||
        gl2.canvas.height != canvasHeight) {
      gl2.canvas.width = gl2.canvas.offsetWidth * devicePixelRatio;
      gl2.canvas.height = gl2.canvas.offsetHeight * devicePixelRatio;
      return true;
    }
    return false;
  }

  execute(delta, time) {
    const gl2 = this.getSingletonComponent(WebGL2);
    if (!gl2.context) { return; }

    this.checkResize(gl2.canvas);

    const gl = gl2.context;

    this.queries.renderable.results.forEach((entity) => {
      const geometry = entity.getComponent(WebGL2RenderGeometry);

      // TODO: Bind materials

      // Bind the geometry
      gl.bindVertexArray(geometry.vao);
      if (geometry.indexType) {
        gl.drawElements(geometry.mode, geometry.drawCount, geometry.indexType, 0);
      } else {
        gl.drawArrays(geometry.mode, 0, sgeometry.drawCount);
      }
    });

    passEncoder.endPass();
    gpu.device.defaultQueue.submit([commandEncoder.finish()]);
  }
}
