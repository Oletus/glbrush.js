/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

/**
 * A compositor for buffers that have canvas backing.
 * @param {CanvasRenderingContext2D} ctx Target rendering context.
 * @constructor
 */
var CanvasCompositor = function(ctx) {
    this.ctx = ctx;
    this.width = this.ctx.canvas.width;
    this.height = this.ctx.canvas.height;
    this.compositingCanvas = document.createElement('canvas');
    this.compositingCanvas.width = this.width;
    this.compositingCanvas.height = this.height;
    this.compositingCtx = this.compositingCanvas.getContext('2d');

    this.prepare();
};

/**
 * Type of composited element
 * @enum
 */
CanvasCompositor.Element = {
    buffer: 0,
    rasterizer: 1
};

/**
 * Prepare for another round of compositing.
 * @protected
 */
CanvasCompositor.prototype.prepare = function() {
    this.pending = [];
    this.needsClear = true;
};

/**
 * Add a buffer to composit to the target context.
 * @param {CanvasBuffer} buffer Buffer to composit.
 */
CanvasCompositor.prototype.pushBuffer = function(buffer) {
    // TODO: assert(buffer.visible);
    if (buffer.isOpaque()) {
        this.needsClear = false;
        this.pending = [];
    }
    this.pending.push({type: CanvasCompositor.Element.buffer, buffer: buffer});
};

/**
 * Add a rasterizer to composit to the target context.
 * @param {Rasterizer} rasterizer Rasterizer to merge to the last pushed buffer.
 * @param {Uint8Array|Array.<number>} color Color to color the rasterizer with.
 * @param {number} opacity Opacity to use for blending the rasterizer.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 * @param {Rect} boundingBox Bounding box for the rasterizer.
 */
CanvasCompositor.prototype.pushRasterizer = function(rasterizer, color, opacity,
                                                     mode, boundingBox) {
    if (opacity === 0 || boundingBox === null) {
        return;
    }
    this.pending.push({type: CanvasCompositor.Element.rasterizer,
                       rasterizer: rasterizer, color: color, opacity: opacity,
                       mode: mode, boundingBox: boundingBox});
};

/**
 * Ensure that results of all queued draw operations are written into the target
 * context.
 */
CanvasCompositor.prototype.flush = function() {
    if (this.needsClear) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.needsClear = false;
    }
    var i = 0;
    while (i < this.pending.length) {
        if (i + 1 === this.pending.length ||
            this.pending[i + 1].type === CanvasCompositor.Element.buffer) {
            this.ctx.globalAlpha = this.pending[i].buffer.opacity();
            this.ctx.drawImage(this.pending[i].buffer.canvas, 0, 0);
            ++i;
        } else {
            if (this.pending[i].buffer.hasAlpha) {
                this.compositingCtx.clearRect(0, 0, this.width, this.height);
            }
            var opacity = this.pending[i].buffer.opacity();
            this.compositingCtx.drawImage(this.pending[i].buffer.canvas, 0, 0);
            var sourceCtx = this.pending[i].buffer.ctx;
            ++i;
            while (i < this.pending.length &&
                 this.pending[i].type === CanvasCompositor.Element.rasterizer) {
                var clipRect = new Rect(0, this.width, 0, this.height);
                clipRect.intersectRect(this.pending[i].boundingBox);
                CanvasBuffer.drawRasterizer(sourceCtx,
                                            this.compositingCtx,
                                            this.pending[i].rasterizer,
                                            clipRect,
                                            false,
                                            this.pending[i].color,
                                            this.pending[i].opacity,
                                            this.pending[i].mode);
                ++i;
                sourceCtx = this.compositingCtx;
            }
            this.ctx.globalAlpha = opacity;
            this.ctx.drawImage(this.compositingCanvas, 0, 0);
        }
    }
    this.prepare();
};

/**
 * A compositor for buffers that have WebGL texture backing.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {number} multitexturingLimit Maximum number of textures to access in
 * one fragment shader pass.
 * @constructor
 */
var GLCompositor = function(glManager, gl, multitexturingLimit) {
    this.glManager = glManager;
    this.gl = gl;
    this.currentBufferRasterizers = 0;
    this.multitexturingLimit = multitexturingLimit;

    this.prepare();
};

/**
 * Prepare for another round of compositing.
 * @protected
 */
GLCompositor.prototype.prepare = CanvasCompositor.prototype.prepare;

/**
 * Add a buffer to composit to the framebuffer.
 * @param {GLBuffer} buffer Buffer to composit.
 */
GLCompositor.prototype.pushBuffer = function(buffer) {
    // TODO: assert(buffer.visible);
    this.pushBufferTex(buffer.tex, buffer.opacity(), buffer.isOpaque());
};

/**
 * Add a texture to composit to the framebuffer. The texture is treated the same
 * way as buffers are.
 * @param {WebGLTexture} tex The texture that has the buffer contents.
 * @param {number} opacity The buffer opacity.
 * @param {boolean} isOpaque True if the texture is completely opaque.
 */
GLCompositor.prototype.pushBufferTex = function(tex, opacity, isOpaque) {
    if (isOpaque) {
        this.needsClear = false;
        this.pending = [];
    }
    if (this.pending.length + 1 >= this.multitexturingLimit) {
        this.flushInternal(this.pending);
        this.pending = [];
    }
    this.pending.push({type: CanvasCompositor.Element.buffer, tex: tex,
                       opacity: opacity});
    this.currentBufferRasterizers = 0;
};

/**
 * Add a rasterizer to composit to the framebuffer.
 * @param {BaseRasterizer} rasterizer Rasterizer to merge to the last pushed
 * buffer.
 * @param {Uint8Array|Array.<number>} color Color to color the rasterizer with.
 * @param {number} opacity Opacity to use for blending the rasterizer.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 * @param {Rect} boundingBox Bounding box for the rasterizer.
 */
GLCompositor.prototype.pushRasterizer = function(rasterizer, color, opacity,
                                                 mode, boundingBox) {
    // TODO: assert(this.pending.length > 0);
    ++this.currentBufferRasterizers;
    if (this.currentBufferRasterizers + 1 >= this.multitexturingLimit) {
        // TODO: handle this case with a separate FBO
        console.log('Maximum rasterizer count exceeded in GLCompositor');
        return;
    }
    if (this.pending.length + 1 >= this.multitexturingLimit) {
        this.flushUntilLastBuffer();
    }
    // TODO: assert(this.stackToFlush.length < this.multiTexturingLimit);
    this.pending.push({type: CanvasCompositor.Element.rasterizer,
                       rasterizer: rasterizer, color: color, opacity: opacity,
                       mode: mode, boundingBox: boundingBox});
};

/**
 * Ensure that results of all queued draw operations are written into the
 * framebuffer.
 */
GLCompositor.prototype.flush = function() {
    this.flushInternal(this.pending);
    this.prepare();
};

/**
 * Flush rasterizers up to the latest buffer in the pending stack.
 * @protected
 */
GLCompositor.prototype.flushUntilLastBuffer = function() {
    var i = this.pending.length - 1;
    while (this.pending[i].type === CanvasCompositor.Element.rasterizer) {
        --i;
        // TODO: assert(i >= 0);
    }
    this.flushInternal(this.pending.splice(0, i));
};

/**
 * Flush a collection of elements into the framebuffer.
 * @param {Array.<Object>} flushed Array of pending elements to flush.
 * @protected
 */
GLCompositor.prototype.flushInternal = function(flushed) {
    // TODO: assert(flushed[0].type === CanvasCompositor.Element.buffer);
    var restoreBlendFunc = false;
    if (this.needsClear) {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.needsClear = false;
    } else {
        // To correctly blend unpremultiplied buffers together with GL
        this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA,
                                  this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        restoreBlendFunc = true;
    }

    var compositingProgram = compositingShader.getShaderProgram(
        this.glManager, flushed);

    var compositingUniforms = {};
    for (var i = 0; i < flushed.length; ++i) {
        if (flushed[i].type === CanvasCompositor.Element.buffer) {
            compositingUniforms['uLayer' + i] = flushed[i].tex;
            compositingUniforms['uOpacity' + i] = flushed[i].opacity;
        } else {
            compositingUniforms['uLayer' + i] = flushed[i].rasterizer.getTex();
            var color = flushed[i].color;
            compositingUniforms['uColor' + i] =
                        [color[0] / 255, color[1] / 255, color[2] / 255,
                        flushed[i].opacity];
        }
    }
    this.glManager.drawFullscreenQuad(compositingProgram, compositingUniforms);
    this.gl.flush();
    if (restoreBlendFunc) {
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    }
};
