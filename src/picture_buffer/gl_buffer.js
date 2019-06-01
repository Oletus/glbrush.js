/*
 * Copyright Olli Etuaho 2019.
 */

import { PictureBuffer } from './picture_buffer.js';

import { glUtils } from '../gl/utilgl.js';

import { BlendingMode } from '../util/blending_mode.js';

import { GLUndoState } from './gl_undo_state.js';

/**
 * A PictureBuffer implementation with a GL texture backing for the bitmap.
 * @constructor
 * @extends {PictureBuffer}
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {GLCompositor} compositor The compositor to use for blends that are
 * not supported by blendFunc and merge operations.
 * @param {ShaderProgram} texBlitProgram Shader program to use for blits. Must
 * have uniform sampler uSrcTex for the source texture.
 * @param {ShaderProgram} rectBlitProgram Shader program to use for blits. Must
 * have uniform sampler uSrcTex for the source texture, and uScale and
 * uTranslate to control the positioning.
 * @param {BufferAddEvent} createEvent Event that initializes the buffer.
 * @param {number} width Width of the buffer in pixels. Must be an integer.
 * @param {number} height Height of the buffer in pixels. Must be an integer.
 * @param {AffineTransform} transform Transform to apply to all event coordinates.
 * @param {boolean} hasUndoStates Does this buffer store undo states?
 * @param {boolean} freed Should this buffer be left without bitmaps?
 */
var GLBuffer = function(gl, glManager, compositor, texBlitProgram, rectBlitProgram, createEvent,
                        width, height, transform, hasUndoStates, freed) {
    this.texBlitProgram = texBlitProgram;
    this.texBlitUniforms = texBlitProgram.uniformParameters();
    this.rectBlitProgram = rectBlitProgram;
    this.rectBlitUniforms = rectBlitProgram.uniformParameters();
    this.initializePictureBuffer(createEvent, width, height, transform, hasUndoStates, freed);
    // Add undo states less often than the default, since drawing is cheap.
    this.undoStateInterval = 32;
    this.gl = gl;
    this.glManager = glManager;
    this.compositor = compositor;

    this.tex = null;
    if (!this.freed) {
        this.createTex();
    }

    this.insertEvent(createEvent, null); // will clear the buffer
};

GLBuffer.prototype = new PictureBuffer();

/**
 * Create a texture for storing this buffer's current state.
 * @protected
 */
GLBuffer.prototype.createTex = function() {
    // TODO: assert(!this.tex);
    var format = this.hasAlpha ? this.gl.RGBA : this.gl.RGB;
    this.tex = glUtils.createTexture(this.gl, this.width(), this.height(),
                                     format);
};

/**
 * Clean up any allocated resources. To make the buffer usable again after this,
 * call regenerate.
 */
GLBuffer.prototype.free = function() {
    this.freed = true;
    this.gl.deleteTexture(this.tex);
    this.tex = null;
    if (this.undoStates !== null) {
        for (var i = 0; i < this.undoStates.length; ++i) {
            this.undoStates[i].free();
        }
    }
};

/**
 * Call after freeing to restore bitmaps.
 * @param {boolean} regenerateUndoStates Whether to regenerate undo states.
 * @param {BaseRasterizer} rasterizer Rasterizer to use.
 */
GLBuffer.prototype.regenerate = function(regenerateUndoStates, rasterizer) {
    this.freed = false;
    this.createTex();
    if (!regenerateUndoStates) {
        this.undoStates = [];
    }
    this.playbackAll(rasterizer);
};

/**
 * Clear the bitmap. Subject to the current clipping rectangle.
 * @param {Uint8Array|Array.<number>} unPremulClearColor The RGB(A) color to use
 * when clearing the buffer. Unpremultiplied and channel values are between
 * 0-255.
 * @protected
 */
GLBuffer.prototype.clear = function(unPremulClearColor) {
    this.updateClip();
    this.glManager.useFboTex(this.tex);
    if (unPremulClearColor.length === 3) {
        this.gl.clearColor(unPremulClearColor[0] / 255.0,
                           unPremulClearColor[1] / 255.0,
                           unPremulClearColor[2] / 255.0,
                           1.0);
    } else {
        this.gl.clearColor(unPremulClearColor[0] / 255.0,
                           unPremulClearColor[1] / 255.0,
                           unPremulClearColor[2] / 255.0,
                           unPremulClearColor[3] / 255.0);
    }
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
};

/**
 * Set the current clipping rectangle as a scissor rectangle for GL.
 * @protected
 */
GLBuffer.prototype.updateClip = function() {
    glUtils.updateClip(this.gl, this.getCurrentClipRect(), this.height());
};

/**
 * Draw the given rasterizer's contents with the given color to the buffer's
 * bitmap. If the event would erase from a buffer with no alpha channel, draws
 * with the background color instead.
 * @param {BaseRasterizer} raster The rasterizer to draw.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {BlendingMode} mode Blending mode to use for drawing.
 * @protected
 */
GLBuffer.prototype.drawRasterizerWithColor = function(raster, color, opacity,
                                                      mode) {
    this.gl.viewport(0, 0, this.width(), this.height());
    this.updateClip();
    if (!this.hasAlpha && mode === BlendingMode.erase) {
        mode = BlendingMode.normal;
        color = this.events[0].clearColor;
    }
    // Copy into helper texture from this.tex, then use compositor to render
    // that blended with the contents of the rasterizer back to this.tex.
    var helper = glUtils.createTexture(this.gl, this.width(),
                                       this.height());
    this.glManager.useFboTex(helper);
    this.texBlitUniforms['uSrcTex'] = this.tex;

    this.glManager.drawFullscreenQuad(this.texBlitProgram, this.texBlitUniforms);

    this.glManager.useFboTex(this.tex);
    this.compositor.setTargetDimensions(this.width(), this.height());
    this.compositor.pushBufferTex(helper, 1.0, false);
    this.compositor.pushRasterizer(raster, color, opacity, mode, null);
    this.compositor.flush();
    this.gl.deleteTexture(helper);
};

/**
 * Blend an image with this buffer.
 * @param {HTMLImageElement} img Image to draw.
 * @param {Rect} rect The extents of the image in this buffer's coordinates.
 */
GLBuffer.prototype.drawImage = function(img, rect) {
    this.gl.viewport(0, 0, this.width(), this.height());
    var imageTex = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, imageTex);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
    // TODO: Enlarge image so that dimensions are POT and add a mipmap.

    this.updateClip();
    this.glManager.useFboTex(this.tex);
    this.rectBlitUniforms['uSrcTex'] = imageTex;
    this.glManager.drawRect(this.rectBlitProgram, this.rectBlitUniforms, rect, this.bitmapRect);
    this.gl.deleteTexture(imageTex);
};

/**
 * Blend another buffer with this one.
 * @param {GLBuffer} buffer Buffer to blend.
 * @param {number} opacity Opacity to blend with.
 * @protected
 */
GLBuffer.prototype.drawBuffer = function(buffer, opacity) {
    this.gl.viewport(0, 0, this.width(), this.height());
    this.updateClip();
    // Copy into helper texture from this.tex, then use compositor to render
    // that blended with the contents of the buffer back to this.tex.
    var helper = glUtils.createTexture(this.gl, this.width(), this.height());
    this.glManager.useFboTex(helper);
    this.texBlitUniforms['uSrcTex'] = this.tex;
    this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                      this.texBlitUniforms);
    this.glManager.useFboTex(this.tex);
    this.compositor.setTargetDimensions(this.width(), this.height());
    this.compositor.pushBufferTex(helper, 1.0, false);
    this.compositor.pushBufferTex(buffer.tex, opacity, false);
    this.compositor.flush();
    this.gl.deleteTexture(helper);
};

/**
 * Save an undo state.
 * @param {number} cost Regeneration cost of the undo state.
 * @return {GLUndoState} The undo state.
 */
GLBuffer.prototype.saveUndoState = function(cost) {
    return new GLUndoState(this.events.length, cost, this.tex, this.gl,
                           this.glManager, this.texBlitProgram,
                           this.width(), this.height(), this.hasAlpha);
};

/**
 * Repair an undo state using the current bitmap and clip rect.
 * @param {GLUndoState} undoState The state to repair.
 */
GLBuffer.prototype.repairUndoState = function(undoState) {
    undoState.update(this.tex, this.getCurrentClipRect());
};

/**
 * Apply the given undo state to the bitmap. Must be a real undo state.
 * @param {GLUndoState} undoState The undo state to apply.
 * @protected
 */
GLBuffer.prototype.applyStateObject = function(undoState) {
    this.glManager.useFboTex(this.tex);
    undoState.draw(this.getCurrentClipRect());
};

/**
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8ClampedArray} Unpremultiplied RGBA value.
 */
GLBuffer.prototype.getPixelRGBA = function(coords) {
    this.glManager.useFboTex(this.tex);
    var buffer = new ArrayBuffer(4);
    var pixelData = new Uint8Array(buffer);
    var glX = Math.min(Math.floor(coords.x), this.width() - 1);
    var glY = Math.max(0, this.height() - 1 - Math.floor(coords.y));
    this.gl.readPixels(glX, glY, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixelData);
    return pixelData;
};

export { GLBuffer };
