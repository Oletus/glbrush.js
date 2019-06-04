/*
 * Copyright Olli Etuaho 2019.
 */

import { Rect } from '../math/rect.js';

import {
    rgbString,
    rgbaString
} from '../util/css_util.js';

import * as colorUtil from '../util/color_util.js';

import { BlendingMode } from '../util/blending_mode.js';

import * as blendFunctions from '../util/blend_functions.js';

/**
 * A bitmap stored in a 2D canvas.
 * @constructor
 * @param {number} width Width of the bitmap in pixels. Must be an integer.
 * @param {number} height Height of the bitmap in pixels. Must be an integer.
 * @param {boolean} hasAlpha Whether the bitmap has an alpha channel.
 * @param {Object} metadata Metadata about the contents of the bitmap, not managed by this class.
 */
var CanvasBitmap = function(width, height, hasAlpha, metadata) {
    this.canvas = null;
    this.ctx = null;
    this.width = width;
    this.height = height;
    this.hasAlpha = hasAlpha;
    this.metadata = metadata;

    this.ensureNotFreed();
};

/**
 * Copy the contents of the bitmap into a new bitmap with different metadata.
 * @param {PictureRenderer}
 * @param {Object} metadata Metadata about the contents of the newly created bitmap, not managed by this class.
 * @return {GLBitmap} The undo state.
 */
CanvasBitmap.prototype.copy = function(renderer, metadata) {
    var bitmap = new CanvasBitmap(this.width, this.height, this.hasAlpha, metadata);
    renderer.blitBitmap(new Rect(0, this.width, 0, this.height), this, bitmap);
    return bitmap;
};

/**
 * Create a canvas for storing this bitmap.
 */
CanvasBitmap.prototype.ensureNotFreed = function() {
    if (this.canvas !== null) {
        return;
    }
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
};

/**
 * Clean up any allocated resources. To make the bitmap usable again after this, call ensureNotFreed.
 */
CanvasBitmap.prototype.free = function() {
    this.ctx = null;
    this.canvas = null;
};

/**
 * Set the bitmap dimensions of the bitmap. Can only be done while the bitmap is freed.
 * @param {number} width The new width.
 * @param {number} height The new height.
 */
CanvasBitmap.prototype.setDimensions = function(width, height) {
    if (this.canvas !== null) {
        return;
    }
    this.width = width;
    this.height = height;
};

/**
 * Clear the bitmap. Subject to the current clipping rectangle.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {Uint8Array|Array.<number>} clearColor The RGB(A) color to use when
 * clearing the bitmap. Unpremultiplied and channel values are between 0-255.
 * @protected
 */
CanvasBitmap.prototype.clear = function(clipRect, clearColor) {
    var br = clipRect.getXYWHRoundedOut();
    if (this.hasAlpha && clearColor.length === 4) {
        if (clearColor[3] < 255) {
            this.ctx.clearRect(br.x, br.y, br.w, br.h);
        }
        if (clearColor[3] !== 0) {
            this.ctx.fillStyle = rgbaString(clearColor);
            this.ctx.fillRect(br.x, br.y, br.w, br.h);
        }
        return;
    }
    this.ctx.fillStyle = rgbString(clearColor);
    this.ctx.fillRect(br.x, br.y, br.w, br.h);
};

/**
 * Draw the given rasterizer's contents with the given color to the bitmap.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {Rasterizer} raster The rasterizer to draw.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {BlendingMode} mode Blending mode to use for drawing.
 * @protected
 */
CanvasBitmap.prototype.drawRasterizerWithColor = function(clipRect, raster, color,
                                                          opacity, mode) {
    CanvasBitmap.drawRasterizer(this.ctx, this.ctx, raster,
                                clipRect, !this.hasAlpha, color, opacity, mode);
};

/**
 * Draw the given rasterizer's contents blended with the image from dataCtx to
 * targetCtx.
 * @param {CanvasRenderingContext2D} dataCtx Context to get the source data to
 * blend with.
 * @param {CanvasRenderingContext2D} targetCtx Target context to place the
 * blending result. May be the same as dataCtx, which effectively blends the
 * raster to the dataCtx.
 * @param {Rasterizer} raster The rasterizer to draw.
 * @param {Rect} clipRect Clipping rectangle to use for both dataCtx and
 * targetCtx.
 * @param {boolean} opaque Whether the target bitmap should be treated as
 * opaque.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {BlendingMode} mode Blending mode to use for drawing.
 */
CanvasBitmap.drawRasterizer = function(dataCtx, targetCtx, raster, clipRect,
                                       opaque, color, opacity, mode) {
    var br = clipRect.getXYWHRoundedOut();
    if (br.w === 0 || br.h === 0) {
        return;
    }
    // TODO: assert(br.x >= 0 && br.y >= 0 && br.x + br.w <= this.width &&
    // br.y + br.h <= this.height);
    var targetData = dataCtx.getImageData(br.x, br.y, br.w, br.h);
    if (opaque &&
        (mode === BlendingMode.normal ||
         mode === BlendingMode.erase)) {
        raster.drawWithColorToOpaque(targetData, color, opacity,
                                     br.x, br.y, br.w, br.h);
    } else if (mode === BlendingMode.normal) {
        raster.drawWithColor(targetData, color, opacity,
                             br.x, br.y, br.w, br.h);
    } else if (mode === BlendingMode.erase) {
        raster.erase(targetData, opacity, br.x, br.y, br.w, br.h);
    } else {
        var blendFunction = colorUtil.getBlendFunction(mode);
        if (blendFunction !== null) {
            raster.blendPerChannel(targetData, color, opacity, br.x, br.y, br.w, br.h, blendFunction);
        }
    }
    targetCtx.putImageData(targetData, br.x, br.y);
};

/**
 * Blend an image with this bitmap.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {HTMLImageElement} img Image to draw.
 * @param {Rect} rect The extents of the image in this bitmap's coordinates.
 */
CanvasBitmap.prototype.drawImage = function(clipRect, img, rect) {
    var br = clipRect.getXYWHRoundedOut();
    if (br.w === 0 || br.h === 0) {
        return;
    }
    this.ctx.save(); // Clip
    this.ctx.beginPath();
    this.ctx.rect(br.x, br.y, br.w, br.h);
    this.ctx.clip();
    this.ctx.drawImage(img, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
    this.ctx.restore();
};

/**
 * Blend another bitmap with this one.
 * @param {Rect} clipRect Clipping rectangle.
 * @param {CanvasBitmap} bitmap Bitmap to blend.
 * @param {number} opacity Opacity to blend with.
 * @protected
 */
CanvasBitmap.prototype.drawBitmap = function(clipRect, bitmap, opacity) {
    // TODO: Should rather use the compositor for this, but it needs some API
    // changes.
    var br = clipRect.getXYWHRoundedOut();
    if (br.w === 0 || br.h === 0) {
        return;
    }
    this.ctx.globalAlpha = opacity;
    this.ctx.drawImage(bitmap.canvas, br.x, br.y, br.w, br.h,
                       br.x, br.y, br.w, br.h);
    this.ctx.globalAlpha = 1.0;
};

/**
 * @return {number} Bytes per pixel used for storing this bitmap.
 * @protected
 */
CanvasBitmap.prototype.bytesPerPixel = function() {
    return 4;
};

/**
 * @return {Uint8Array} Pixels.
 */
CanvasBitmap.prototype.readPixels = function() {
    var imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    return imageData.data;
};

/**
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8ClampedArray} Unpremultiplied RGBA value.
 */
CanvasBitmap.prototype.getPixelRGBA = function(coords) {
    var imageData = this.ctx.getImageData(coords.x, coords.y, 1, 1);
    return imageData.data;
};

export { CanvasBitmap };
