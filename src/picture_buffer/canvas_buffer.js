/*
 * Copyright Olli Etuaho 2019.
 */

import { PictureBuffer } from './picture_buffer.js';

import {
    rgbString,
    rgbaString
} from '../util/css_util.js';

import * as colorUtil from '../util/color_util.js';

import { BlendingMode } from '../util/blending_mode.js';

import * as blendFunctions from '../util/blend_functions.js';

import { CanvasUndoState } from './canvas_undo_state.js';

/**
 * A PictureBuffer implementation with a canvas backing for the bitmap.
 * @constructor
 * @extends {PictureBuffer}
 * @param {BufferAddEvent} createEvent Event that initializes the buffer.
 * @param {number} width Width of the buffer in pixels. Must be an integer.
 * @param {number} height Height of the buffer in pixels. Must be an integer.
 * @param {AffineTransform} transform Transform to apply to all event coordinates.
 * @param {boolean} hasUndoStates Does this buffer store undo states?
 * @param {boolean} freed Should this buffer be left without bitmaps?
 */
var CanvasBuffer = function(createEvent, width, height, transform, hasUndoStates, freed) {
    this.initializePictureBuffer(createEvent, width, height, transform, hasUndoStates, freed);
    this.canvas = null;
    this.ctx = null;
    if (!this.freed) {
        this.createCanvas();
    }

    this.insertEvent(createEvent, null); // will clear the buffer
};

CanvasBuffer.prototype = new PictureBuffer();

/**
 * Create a canvas for storing this buffer's current state.
 * @protected
 */
CanvasBuffer.prototype.createCanvas = function() {
    // TODO: assert(!this.canvas);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width();
    this.canvas.height = this.height();
    this.ctx = this.canvas.getContext('2d');
};

/**
 * Clean up any allocated resources. To make the buffer usable again after this,
 * call regenerate.
 */
CanvasBuffer.prototype.free = function() {
    this.freed = true;
    this.ctx = null;
    this.canvas = null;
    if (this.undoStates !== null) {
        for (var i = 0; i < this.undoStates.length; ++i) {
            this.undoStates[i].free();
        }
    }
};

/**
 * Call after freeing to restore bitmaps.
 * @param {boolean} regenerateUndoStates Whether to regenerate undo states.
 * @param {Rasterizer} rasterizer Rasterizer to use.
 */
CanvasBuffer.prototype.regenerate = function(regenerateUndoStates, rasterizer) {
    this.freed = false;
    this.createCanvas();
    if (!regenerateUndoStates) {
        this.undoStates = [];
    }
    this.playbackAll(rasterizer);
};

/**
 * Save an undo state.
 * @param {number} cost Regeneration cost of the undo state.
 * @return {CanvasUndoState} The undo state.
 */
CanvasBuffer.prototype.saveUndoState = function(cost) {
    return new CanvasUndoState(this.events.length, cost, this.width(),
                               this.height(), this.canvas);
};

/**
 * Repair an undo state using the current bitmap and clip rect.
 * @param {CanvasUndoState} undoState The state to repair.
 */
CanvasBuffer.prototype.repairUndoState = function(undoState) {
    undoState.update(this.canvas, this.getCurrentClipRect());
};

/**
 * Apply the given undo state to the bitmap. Must be a real undo state.
 * @param {CanvasUndoState} undoState The undo state to apply.
 * @protected
 */
CanvasBuffer.prototype.applyStateObject = function(undoState) {
    undoState.draw(this.ctx, this.getCurrentClipRect());
};

/**
 * Clear the bitmap. Subject to the current clipping rectangle.
 * @param {Uint8Array|Array.<number>} clearColor The RGB(A) color to use when
 * clearing the buffer. Unpremultiplied and channel values are between 0-255.
 * @protected
 */
CanvasBuffer.prototype.clear = function(clearColor) {
    var br = this.getCurrentClipRect().getXYWHRoundedOut();
    if (clearColor.length === 4 && clearColor[3] < 255) {
        this.ctx.clearRect(br.x, br.y, br.w, br.h);
    }
    if (clearColor.length === 4) {
        if (clearColor[3] !== 0) {
            this.ctx.fillStyle = rgbaString(clearColor);
            this.ctx.fillRect(br.x, br.y, br.w, br.h);
        }
    } else {
        this.ctx.fillStyle = rgbString(clearColor);
        this.ctx.fillRect(br.x, br.y, br.w, br.h);
    }
};

/**
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8ClampedArray} Unpremultiplied RGBA value.
 */
CanvasBuffer.prototype.getPixelRGBA = function(coords) {
    var imageData = this.ctx.getImageData(coords.x, coords.y, 1, 1);
    return imageData.data;
};

/**
 * Draw the given rasterizer's contents with the given color to the buffer's
 * bitmap. If the event would erase from a buffer with no alpha channel, draws
 * with the background color instead.
 * @param {Rasterizer} raster The rasterizer to draw.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {BlendingMode} mode Blending mode to use for drawing.
 * @protected
 */
CanvasBuffer.prototype.drawRasterizerWithColor = function(raster, color,
                                                          opacity, mode) {
    if (mode === BlendingMode.erase && !this.hasAlpha) {
        mode = BlendingMode.normal;
        color = this.events[0].clearColor;
    }
    CanvasBuffer.drawRasterizer(this.ctx, this.ctx, raster,
                                this.getCurrentClipRect(),
                                !this.hasAlpha, color, opacity, mode);
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
 * @param {boolean} opaque Whether the target buffer should be treated as
 * opaque.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {BlendingMode} mode Blending mode to use for drawing.
 */
CanvasBuffer.drawRasterizer = function(dataCtx, targetCtx, raster, clipRect,
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
 * Blend an image with this buffer.
 * @param {HTMLImageElement} img Image to draw.
 * @param {Rect} rect The extents of the image in this buffer's coordinates.
 */
CanvasBuffer.prototype.drawImage = function(img, rect) {
    var br = this.getCurrentClipRect().getXYWHRoundedOut();
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
 * Blend another buffer with this one.
 * @param {CanvasBuffer} buffer Buffer to blend.
 * @param {number} opacity Opacity to blend with.
 * @protected
 */
CanvasBuffer.prototype.drawBuffer = function(buffer, opacity) {
    // TODO: Should rather use the compositor for this, but it needs some API
    // changes.
    var br = this.getCurrentClipRect().getXYWHRoundedOut();
    if (br.w === 0 || br.h === 0) {
        return;
    }
    this.ctx.globalAlpha = opacity;
    this.ctx.drawImage(buffer.canvas, br.x, br.y, br.w, br.h,
                       br.x, br.y, br.w, br.h);
    this.ctx.globalAlpha = 1.0;
};

/**
 * @return {number} Bytes per pixel used for storing the state of this buffer's
 * bitmap.
 * @protected
 */
CanvasBuffer.prototype.bytesPerPixel = function() {
    return 4;
};

export { CanvasBuffer };
