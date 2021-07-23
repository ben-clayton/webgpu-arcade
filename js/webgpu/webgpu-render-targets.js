// Singleton class which holds render targets which need to be shared between render passes.

export class WebGPURenderTargets extends EventTarget {
  msaaColorTexture;
  depthTexture;

  constructor(gpu) {
    super();
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target != gpu.canvas) { continue; }

        if (entry.devicePixelContentBoxSize) {
          // Should give exact pixel dimensions, but only works on Chrome.
          const devicePixelSize = entry.devicePixelContentBoxSize[0];
          this.onCanvasResized(gpu, devicePixelSize.inlineSize, devicePixelSize.blockSize);
        } else if (entry.contentBoxSize) {
          // Firefox implements `contentBoxSize` as a single content rect, rather than an array
          const contentBoxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
          this.onCanvasResized(gpu, contentBoxSize.inlineSize, contentBoxSize.blockSize);
        } else {
          this.onCanvasResized(gpu, entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    this.resizeObserver.observe(gpu.canvas);
    this.onCanvasResized(gpu, gpu.canvas.width, gpu.canvas.height);
  }

  onCanvasResized(gpu, pixelWidth, pixelHeight) {
    gpu.size.width = pixelWidth;
    gpu.size.height = pixelHeight;
    gpu.context.configure(gpu);

    if (gpu.sampleCount > 1) {
      this.msaaColorTexture = gpu.device.createTexture({
        size: gpu.size,
        sampleCount: gpu.sampleCount,
        format: gpu.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    if (gpu.depthFormat) {
      this.depthTexture = gpu.device.createTexture({
        size: gpu.size,
        sampleCount: gpu.sampleCount,
        format: gpu.depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
    }

    this.dispatchEvent(new Event('reconfigured'));
  }
}