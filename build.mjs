import * as esbuild from "esbuild";
import * as importMap from "esbuild-plugin-import-map";

importMap.load({
    imports: {
      "gl-matrix": "../node_modules/gl-matrix/dist/esm/index.js",
      "webgpu-texture-loader": "../node_modules/web-texture-tool/build/webgpu-texture-loader.js",
      "dat.gui": "../node_modules/dat.gui/build/dat.gui.module.js",
      "stats.js": "../node_modules/stats.js/src/Stats.js",
      "ecs": "../js/ecs/ecs.js"
    }
});

esbuild.build({
    entryPoints: ['js/main.js'],
    bundle: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    plugins: [importMap.plugin()],
    outfile: 'build/toro.js',
}).catch(() => process.exit(1))