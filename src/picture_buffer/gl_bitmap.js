/*
 * Copyright Olli Etuaho 2019.
 */

import { Rect } from '../math/rect.js';

import { glUtils } from '../gl/utilgl.js';

import { BlendingMode } from '../util/blending_mode.js';

/**
 * A bitmap stored in a GL texture.
 * @constructor
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
 * @param {number} width Width of the bitmap in pixels. Must be an integer.
 * @param {number} height Height of the bitmap in pixels. Must be an integer.
 * @param {boolean} hasAlpha Whether the bitmap has an alpha channel.
 * @param {Object} metadata Metadata about the contents of the bitmap, not managed by this class.
 */
var GLBitmap = function(gl, glManager, compositor, texBlitProgram, rectBlitProgram, width, height, hasAlpha, metadata) {
    this.texBlitProgram = texBlitProgram;
    this.texBlitUniforms = texBlitProgram.uniformParameters();
    this.rectBlitProgram = rectBlitProgram;
    this.rectBlitUniforms = rectBlitProgram.uniformParameters();
    this.gl = gl;
    this.glManager = glManager;
    this.compositor = compositor;
    this.width = width;
    this.height = height;
    this.hasAlpha = hasAlpha;
    this.metadata = metadata;

    this.tex = null;
    this.ensureNotFreed();
};

/**
 * Copy the contents of the bitmap into a new bitmap with different metadata.
 * @param {PictureRenderer}
 * @param {Object} metadata Metadata about the contents of the newly created bitmap, not managed by this class.
 * @return {GLBitmap} The undo state.
 */
GLBitmap.prototype.copy = function(renderer, metadata) {
    var bitmap = new GLBitmap(this.gl, this.glManager, this.compositor, this.texBlitProgram, this.rectBlitProgram, this.width, this.height, this.hasAlpha, metadata);
    renderer.blitBitmap(new Rect(0, this.width, 0, this.height), this, bitmap);
    return bitmap;
};

/**
 * Create a texture for storing this bitmap.
 */
GLBitmap.prototype.ensureNotFreed = function() {
    if (this.tex !== null) {
        return;
    }
    var format = this.hasAlpha ? this.gl.RGBA : this.gl.RGB;
    this.tex = glUtils.createTexture(this.gl, this.width, this.height, format);
};

/**
 * Clean up any allocated resources. To make the bitmap usable again after this, call ensureNotFreed.
 */
GLBitmap.prototype.free = function() {
    this.gl.deleteTexture(this.tex);
    this.tex = null;
};

/**
 * Set the bitmap dimensions of the bitmap. Can only be done while the bitmap is freed.
 * @param {number} width The new width.
 * @param {number} height The new height.
 */
GLBitmap.prototype.setDimensions = function(width, height) {
    if (this.tex !== null) {
        return;
    }
    this.width = width;
    this.height = height;
};

/**
 * Clear the bitmap. Subject to the current clipping rectangle.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {Uint8Array|Array.<number>} unPremulClearColor The RGB(A) color to use
 * when clearing the buffer. Unpremultiplied and channel values are between
 * 0-255.
 * @protected
 */
GLBitmap.prototype.clear = function(clipRect, unPremulClearColor) {
    this.updateClip(clipRect);
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
 * @param {Rect} clipRect Clipping rectangle.
 * @protected
 */
GLBitmap.prototype.updateClip = function(clipRect) {
    glUtils.updateClip(this.gl, clipRect, this.height);
};

/**
 * Draw the given rasterizer's contents with the given color to the bitmap.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {BaseRasterizer} raster The rasterizer to draw.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {BlendingMode} mode Blending mode to use for drawing.
 * @protected
 */
GLBitmap.prototype.drawRasterizerWithColor = function(clipRect, raster, color, opacity, mode) {
    this.gl.viewport(0, 0, this.width, this.height);
    this.updateClip(clipRect);
    // Copy into helper texture from this.tex, then use compositor to render
    // that blended with the contents of the rasterizer back to this.tex.
    // TODO: Recycle texture?
    var helper = glUtils.createTexture(this.gl, this.width, this.height);
    this.glManager.useFboTex(helper);
    this.texBlitUniforms['uSrcTex'] = this.tex;

    this.glManager.drawFullscreenQuad(this.texBlitProgram, this.texBlitUniforms);

    this.glManager.useFboTex(this.tex);
    this.compositor.setTargetDimensions(this.width, this.height);
    this.compositor.pushBufferTex(helper, 1.0, false);
    this.compositor.pushRasterizer(raster, color, opacity, mode, null);
    this.compositor.flush();
    this.gl.deleteTexture(helper);
};

/**
 * Blend an image with this bitmap.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {HTMLImageElement} img Image to draw.
 * @param {Rect} rect The extents of the image in this bitmap's coordinates.
 */
GLBitmap.prototype.drawImage = function(clipRect, img, rect) {
    this.gl.viewport(0, 0, this.width, this.height);
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

    this.updateClip(clipRect);
    this.glManager.useFboTex(this.tex);
    this.rectBlitUniforms['uSrcTex'] = imageTex;
    this.glManager.drawRect(this.rectBlitProgram, this.rectBlitUniforms, rect, this.width, this.height);
    this.gl.deleteTexture(imageTex);
};

/**
 * Blend another bitmap with this one.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {GLBitmap} bitmap Bitmap to blend.
 * @param {number} opacity Opacity to blend with.
 * @protected
 */
GLBitmap.prototype.drawBitmap = function(clipRect, bitmap, opacity) {
    this.gl.viewport(0, 0, this.width, this.height);
    this.updateClip(clipRect);
    // Copy into helper texture from this.tex, then use compositor to render
    // that blended with the contents of the bitmap back to this.tex.
    var helper = glUtils.createTexture(this.gl, this.width, this.height);
    this.glManager.useFboTex(helper);
    this.texBlitUniforms['uSrcTex'] = this.tex;
    this.glManager.drawFullscreenQuad(this.texBlitProgram, this.texBlitUniforms);
    this.glManager.useFboTex(this.tex);
    this.compositor.setTargetDimensions(this.width, this.height);
    this.compositor.pushBufferTex(helper, 1.0, false);
    this.compositor.pushBufferTex(bitmap.tex, opacity, false);
    this.compositor.flush();
    this.gl.deleteTexture(helper);
};

/**
 * @return {Uint8Array} Pixels.
 */
GLBitmap.prototype.readPixels = function() {
    var pixels = new Uint8Array(this.width * this.height * 4);
    this.glManager.useFboTex(this.tex);
    this.gl.readPixels(0, 0, this.width, this.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    return pixels;
};

/**
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8ClampedArray} Unpremultiplied RGBA value.
 */
GLBitmap.prototype.getPixelRGBA = function(coords) {
    this.glManager.useFboTex(this.tex);
    var buffer = new ArrayBuffer(4);
    var pixelData = new Uint8Array(buffer);
    var glX = Math.min(Math.floor(coords.x), this.width - 1);
    var glY = Math.max(0, this.height - 1 - Math.floor(coords.y));
    this.gl.readPixels(glX, glY, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixelData);
    return pixelData;
};

export { GLBitmap };
