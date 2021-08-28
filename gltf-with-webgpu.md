# Rendering glTF files with WebGPU

This page assumes you have at least a passing familiarity with WebGL, and have at least done enough with WebGPU to put a triangle or two on the screen.

This page is NOT a tutorial for getting started with WebGPU, and instead is focused on showing how a well know existing model format maps to the API. If you want to learn this awesome new API, check out the following resources first (and be sure to come back when you've figured out the basics!)

 - [Raw WebGPU](https://alain.xyz/blog/raw-webgpu) - A beautifully presented tutorial
 - [WebGPU Samples](http://austin-eng.com/webgpu-samples) - Good for those that learn by example
 - [WebGPU Spec](https://gpuweb.github.io/gpuweb/) - Heavy reading, but a good reference

## Buffers

[glTF Buffers](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-buffer) are, fundamentally, just big chunks of binary data, with no particular structure. Their loading and handling isn't graphics API specific, since with either WebGL or WebGPU you want to work with these binary buffers as [ArrayBuffers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).

They can come from one of two places. First, the glTF JSON may have an array of `buffers` that give a URI the buffer should be loaded from, and the number of bytes that's expected to be in it.

```js
{
   "buffers": [
       {
           "byteLength": 102040,
           "uri": "duck.bin"
       }
   ]
}
```

The URI may either point at an external file or may be a base64 encoded [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs), but fortunately we don't have to worry much about the difference between those two since either way the [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) API will let us load the data as an `ArrayBuffer`:

```js
const buffers = [];
// Typically you don't want to do a bunch of awaits in a loop like this, but better handling of
// async code is going to be left as an exercise for the reader on this page.
for (let i = 0; i < json.buffers.length; ++i) {
  const buffer = json.buffers[i];
  const response = await fetch(buffer.uri);
  buffers[i] = await response.arrayBuffer();
}
```

_TODO: Talk about Binary .glb files_

## BufferView

The binary data in the buffers represents a bunch of different parts of the glTF model all smashed together into one big pile: Vertex and Index data, Textures, Animations, etc. In order to determine which parts of it are which, the buffers are divided into subsections called [BufferViews](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-bufferview). A buffer view is, at it's simplest, a `byteOffset` and `byteLength` into one of the buffers. If the subrange of the buffer contains vertex or index data it will also include a `target`, and for several types of data like vertices it will indicate a `byteStride`.

```js
{
    "bufferViews": [
        {
            "buffer": 0,
            "byteLength": 25272,
            "byteOffset": 0,
            "target": 34963
        },
        {
            "buffer": 0,
            "byteLength": 76768,
            "byteOffset": 25272,
            "byteStride": 32,
            "target": 34962
        }
    ]
}
```

If the `bufferView` has a `target`, then we know that we should upload the data that it points to to the GPU in the form of a vertex or index buffer, depending on the value in `target`.

As with many things in the glTF spec, the `target` is given as the numeric value of one of the WebGL enums. So, for example, if we look at the WebGL spec we'll find that WebGL's term for a vertex buffer, `ARRAY_BUFFER`, is defined as `0x8892` in hex, `34962` in decimal. `ELEMENT_ARRAY_BUFFER` (index buffer) is defined as `0x8893` in hex, `34963` in decimal. This means that if we were displaying the glTF file with WebGL we could have passed the `target` directly into a `gl.bufferData()` call. But since we're using WebGPU we have to do a very minor conversion. Fortunately it's not hard at all:

```js
function GLTargetToGPUUsage(target) {
  switch(target) {
    case WebGLRenderingContext.ARRAY_BUFFER: return GPUBufferUsage.VERTEX;
    case WebGLRenderingContext.ELEMENT_ARRAY_BUFFER: return GPUBufferUsage.INDEX;
  }
}
```

Switch statements converting from WebGL to WebGPU values is something you're going to see a lot of when loading glTF files. 😉

One other difference we need to account for when rendering with WebGPU is that it requires that buffer sizes are aligned on 4 byte boundaries. But glTF doesn't guarantee that, so we have to round the length it gives us up to the nearest multiple of 4 when creating the buffer.

Finally, while in WebGL you'd always use `gl.bufferData` or `gl.bufferSubData` to write data into a buffer, with WebGPU there's a lot more options. It can be a little intimidating at first, and frequently requires some more manual effort, but it's not hard once you get used to it. In the case that we're creating a vertex or index buffer, we don't expect the data to change over the lifetime of the app, so the most efficient way to set the data will be to create the buffers with the `mappedAtCreation` flag. This will let us immediately get an `ArrayBuffer` that represents the `GPUBuffer` contents and copy our `bufferView` data into it.

So given all that, creating `GPUBuffers` for glTF vertex and index value will look something like this:

```js
function createGPUBuffer(bufferView) {
  const buffer = buffers[bufferView.buffer];

  // Round the buffer length up to the nearest multiple of 4.
  const alignedLength = Math.ceil(bufferView.byteLength / 4) * 4;
  // Create the WebGPU buffer
  const gpuBuffer = device.createBuffer({
    size: alignedLength,
    usage: GLTargetToGPUUsage(bufferView.target),
    mappedAtCreation: true
  });

  // Get the mapped ArrayBuffer, and create a Uint8 view of it.
  // (Uint8 so we can specify ranges in bytes)
  const dstArray = new Uint8Array(gpuBuffer.getMappedRange());
  // Get the subsection of the buffer pointed to by the bufferView as a byte array as well.
  const srcArray = new Uint8Array(buffer, bufferView.byteOffset, bufferView.byteLength);
  // Copy the data from the bufferView to the GPUBuffer.
  dstArray.set(srcArray);
  // Indicate we are done setting the buffer's data.
  gpuBuffer.unmap();

  return gpuBuffer;
}

for (let i = 0; i < json.bufferViews.length; ++i) {
  const bufferView = json.bufferViews[i];
  if (bufferView.target) {
    bufferView.gpuBuffer = createGPUBuffer(bufferView);
  }
}
```

## Accessors

So `bufferViews` will define subsections of a `buffer`, and can broadly state that they're used for vertex or index data when applicable, but they don't actually give any insight into the structure of the data inside that chunk of binary data. That's what glTF's [`Accessors`](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-accessor) are for. An `accessor` tells you what type of data is in the `bufferView`, what offset it's at, etc.

```js
{
  "accessors": [
    {
      "bufferView": 0,
      "byteOffset": 0,
      "componentType": 5123,
      "count": 12636,
      "max": [
        4212
      ],
      "min": [
        0
      ],
      "type": "SCALAR"
    },
    {
      "bufferView": 1,
      "byteOffset": 0,
      "componentType": 5126,
      "count": 2399,
      "max": [
        0.961799,
        1.6397,
        0.539252
      ],
      "min": [
        -0.692985,
        0.0992937,
        -0.613282
      ],
      "type": "VEC3"
    }
  ]
}
```

The accessors are used for a lot of things in the glTF file, but the most common thing is defining the layout of a vertex attribute, or the format of the index data. Several `accessors` can all point at a single buffer view to represent [interleaved vertex data](https://blog.tojicode.com/2011/05/interleaved-array-basics.html). Basically, they contain all of the values you would need to pass to `gl.vertexAttribPointer()` if you were using WebGL.

In WebGPU, however, these values will instead make up the attributes of the [`GPUVertexBufferLayout`](https://gpuweb.github.io/gpuweb/#dictdef-gpuvertexbufferlayout) that is passed in when creating a [`GPURenderPipeline`](https://gpuweb.github.io/gpuweb/#gpurenderpipeline). We'll cover that more in-depth in the next section.

## Mesh

Rendering in any graphics API typically involves defining multple vertex attributes to be processed by the shader, so we need a way to connect the attributes defined by the `accessors` into the a renderable asset. The glTF spec uses [`Meshes`](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-mesh) to bring those pieces together.

Each `Mesh` is primarily a collection of [`Primitives`](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-primitive), which is effectively all the information required for a single draw call.

```js
{
  "meshes": [
    {
      "primitives": [
        {
          "attributes": {
            "NORMAL": 23,
            "POSITION": 22,
            "TANGENT": 24,
            "TEXCOORD_0": 25
          },
          "indices": 21,
          "material": 3,
          "mode": 4
        }
      ]
    }
  ]
}
```

## Image

A [glTF Image](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-image) is the source for what both WebGL and WebGPU call a Texture. The images may be either JPEG or PNG files, though with extensions it could also support [Basis compressed textures](https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_texture_basisu/README.md). (That's beyond the scope of this page, but I highly suggest looking into it! Basis compression can drastically reduce your textures size in terms of bandwidth and VRAM.)

Now, with WebGL one of the most common ways to get a JPEG or PNG image into a texture was to:
 - Create an `<img>` element
 - Set it's `src` attribute to the image URL
 - Wait for the `load` event to fire
 - Pass the `<img>` element to `gl.texImage2D()`

But if you go searching through the WebGPU spec, you'll notice very quickly that there's no mention of `HTMLImageElement` anywhere. So how do we use the images as textures?

Instead of taking an image element directly, WebGPU can take in an [`ImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) through the function [`device.queue.copyExternalImageToTexture()`](https://gpuweb.github.io/gpuweb/#dom-gpuqueue-copyexternalimagetotexture). This ends up being a lot more flexible, because you can get an `ImageBitmap` a lot of different ways. If you have an `<img>` element it's as simple as:

```js
  // Note the 'await'. This is an asynchronous function.
  const imgBitmap = await createImageBitmap(imgElement);
```

But in our case, loading from a glTF file, we can actually do better. The glTF spec says that images can come from:
 - An external URI
 - A data URI (base64 encoded)
 - A buffer and a mime type

Which sounds like a lot of different edge cases to handle, but it's not nearly as bad as you think! The trick is to realize that all of those different sources can fairly trivially be loaded as a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob), and that `Blob`s are one of the things that can be passed to `createImageBitmap()`. So, let's see how that all works in practice!

For external URIs and data URIs, we can pretty much just ignore the difference and toss it to `fetch()`, just like with the buffers. `fetch()` will helpfully download the image if the URL points to another location, and decode the image if it's given as a base 64 data URI and you, as the developer, don't really have to care which was which. Either way you'll get a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) that can then be used to get a `Blob` representing the image. If, on the other hand, your are given a bufferView and a MIME type, you can construct a `Blob` directly from that. All together it looks something like this:

```js
let blob;
if (image.uri) {
  // Image is given as a URI
  const response = await fetch(image.uri);
  blob = await response.blob();
} else {
  // Image is given as a bufferView
  const bufferView = bufferViews[image.bufferView];
  const buffer = buffers[bufferView.buffer];
  blob = new Blob(
    [new Uint8Array(buffer, bufferView.byteOffset, bufferView.byteLength)],
    { type: image.mimeType }
  );
}
```

Now that we have a `Blob` to work with either way, we can get the `ImageBitmap`, create the `GPUTexture`, and copy the image into it:

```js
const imageBitmap = await createImageBitmap(blob);

const textureDescriptor = {
  size: { width: imageBitmap.width, height: imageBitmap.height },
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
};

if (youWantMipmaps) {
  // Figures out how many mip levels you need for a full chain.
  textureDescriptor.mipLevelCount = Math.floor(Math.log2(Math.max(imageBitmap.width, imageBitmap.height))) + 1;
  // Needed if you are going to use render passes to generate your mipmaps (See note about mipmapping below)
  textureDescriptor.usage |= GPUTextureUsage.RENDER_ATTACHMENT;
}

const texture = this.device.createTexture(textureDescriptor);

device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture }, textureDescriptor.size);
```

### A very special note about mipmapping

In WebGL, once you loaded a texture if you wanted mipmaps (so your texture doesn't look like a shimmery mess from far away) you just called:

```js
gl.generateMipmap(GL.TEXTURE_2D);
```

And, done! Moving on! With WebGPU, on the other hand things are... significantly less simple.

WebGPU requires you to explicitly set every mipmap level of each texture. For some texture types, like compressed textures, it's common to store each mip level separately in the file itself, which makes it relatively easy to populate the full mip chain, but when you image source is a JPEG/PNG/etc you're stuck either not using mipmapping at all or generating the mipmaps yourself at runtime.

There's a myriad of ways that you can choose to generate mipmaps, with some of the fancier native libraries going so far as to do single-pass, compute shader-based, custom filtered downsampling. Chances are, though, if you simply want your textures to not sparkle when you move around your scene you'll be just fine with a much simpler solution.

[My solution](https://github.com/toji/web-texture-tool/blob/main/src/webgpu-mipmap-generator.js) is do a render-pass for each mip level: using it as the color attachment, sampling from the previous mip level, and letting the built-in linear minification filtering handle the resize. It's not the absolute fastest or most precise way of going about it, but it's definitely Good Enough™ for most use cases.

When used with the above texture creation code, you'd call it like this:

```js
// Somewhere during WebGPU initialization:
const mipmapGenerator = new WebGPUMipmapGenerator(device);

// After calling copyExternalImageToTexture above:
if (youWantMipmaps) {
  mipmapGenerator.generateMipmap(texture, textureDescriptor);
}
```

Feel free to use that library however you see fit!

## Sampler

A [glTF sampler](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-sampler) maps directly to a [WebGLSampler](https://developer.mozilla.org/en-US/docs/Web/API/WebGLSampler) objects from WebGL 2.0.

```js
{
  "samplers": [
    {
      "magFilter": 9729,
      "minFilter": 9987,
      "wrapS": 10497,
      "wrapT": 10497
    }
  ]
}
```

Fortunately WebGPU's concept of a [Sampler](https://gpuweb.github.io/gpuweb/#sampler-interface) in nearly identical. As with previous glTF definitions, the samplers make use of WebGL enums values directly, so we need a few more switch statements. The biggest difference that you need to be aware of is that while in WebGL you specified the filtering modes for minification and mipmapping with a single enum, while in WebGPU they're separate. And... that's about it!

```js
function createGPUSampler(gltfSampler) {
  function GLWrapToGPUAddressMode(wrap) {
    switch (wrap) {
      case GL.CLAMP_TO_EDGE: return 'clamp-to-edge';
      case GL.MIRRORED_REPEAT: return 'mirror-repeat';
      default: return 'repeat';
    }
  }

  const descriptor = {
    addressModeU: GLWrapToGPUAddressMode(gltfSampler.wrapS),
    addressModeV: GLWrapToGPUAddressMode(gltfSampler.wrapT),
  };

  if (!gltfSampler.magFilter || gltfSampler.magFilter == GL.LINEAR) {
    descriptor.magFilter = 'linear';
  }

  switch (gltfSampler.minFilter) {
    case GL.LINEAR:
    case GL.LINEAR_MIPMAP_NEAREST:
      descriptor.minFilter = 'linear';
      break;
    case GL.NEAREST_MIPMAP_LINEAR:
      descriptor.mipmapFilter = 'linear';
      break;
    case GL.LINEAR_MIPMAP_LINEAR:
    default:
      descriptor.minFilter = 'linear';
      descriptor.mipmapFilter = 'linear';
      break;
  }

  return gpuDevice.createSampler(descriptor);
}
```

## Texture

The [glTF textures](https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#reference-texture) array simply indicates which sampler should be used with which image.

```js
{
  "textures": [
    {
      "sampler": 0, // Index into the samplers array
      "source": 2 // Index into the images array
    }
  ]
}
```

Easy! This relationship needed to be handled more explicity with WebGL 1.0, but for WebGL 2.0 and WebGPU the textures and samplers are both separate objects, so all we actually need to do is make sure our shaders can use the right texture/sampler pairing. Which brings us to...

## Material


## Nodes