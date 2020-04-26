/*
 * Copyright Olli Etuaho 2012-2019.
 */


import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

/**
 * A base object for a rasterizer that can blend together monochrome circles and
 * draw gradients. Do not instance this directly.
 * Inheriting objects are expected to implement fillCircle(x, y, radius, flowAlpha, rotation),
 * getPixel(coords), clear(), linearGradient(coords1, coords0) and if need be,
 * flushCircles() and free().
 * @constructor
 */
var BaseRasterizer = function() {};

/**
 * Initialize the generic rasterizer data.
 * @param {number} width Width of the rasterizer bitmap in pixels.
 * @param {number} height Height of the rasterizer bitmap in pixels.
 * @param {GLBrushTextures|CanvasBrushTextures} brushTextures Collection of brush tip textures to use.
 */
BaseRasterizer.prototype.initBaseRasterizer = function(width, height, brushTextures) {
    this.clipRect = new Rect(0, width, 0, height);
    this.width = width;
    this.height = height;
    this.brushTextures = brushTextures;
    this.soft = false;
    this.texturized = false;
    this.flowAlpha = 0; // range [0, 1]
    this.prevX = null;
    this.prevY = null;
    this.prevR = null;
    this.t = 0;
    this.drawEvent = null;
    this.drawEventState = null;
    this.drawEventGeneration = -1;
    this.drawEventTransform = null;
    this.drawEventTransformGeneration = -1;
    this.drawEventClipRect = new Rect(0, this.width, 0, this.height);
    this.dirtyArea = new Rect();
};

/**
 * Set the clipping rectangle.
 * @param {Rect} rect The new clipping rectangle.
 */
BaseRasterizer.prototype.setClip = function(rect) {
    this.clipRect.set(0, this.width, 0, this.height);
    this.clipRect.intersectRect(rect);
};

/**
 * Reset the clipping rectangle.
 */
BaseRasterizer.prototype.resetClip = function() {
    this.clipRect.set(0, this.width, 0, this.height);
};

/**
 * Clear all the pixels that have been touched by draw operations, disregarding
 * current clipping rectangle.
 */
BaseRasterizer.prototype.clearDirty = function() {
    if (!this.dirtyArea.isEmpty()) {
        var restoreClip = new Rect();
        restoreClip.setRect(this.clipRect);
        this.setClip(this.dirtyArea);
        this.clear();
        this.setClip(restoreClip);
        this.dirtyArea.makeEmpty();
    }
    this.drawEvent = null;
};

/**
 * Get draw event state for the given event. The draw event state represents
 * what parts of the event have been rasterized to this rasterizer's bitmap.
 * Assumes that the intention is to rasterize the given event, and clears any
 * previous events from the rasterizer.
 * @param {PictureEvent} event The event to be rasterized.
 * @param {AffineTransform} transform The transform to check to determine whether a
 * clear needs to be performed. Does not affect the rasterizer's operation.
 * @param {function()} stateConstructor Constructor for creating a new draw
 * event state object unless the event already has been rasterized to this
 * rasterizer's bitmap.
 * @return {Object} Draw event state for the given event.
 */
BaseRasterizer.prototype.getDrawEventState = function(event, transform, stateConstructor) {
    if (event !== this.drawEvent || event.generation !== this.drawEventGeneration ||
        !this.drawEventClipRect.containsRect(this.clipRect) || transform !== this.drawEventTransform ||
        transform.generation !== this.drawEventTransformGeneration) {
        this.clearDirty();
        this.drawEvent = event;
        this.drawEventState = new stateConstructor();
        this.drawEventGeneration = event.generation;
        this.drawEventTransform = transform;
        this.drawEventTransformGeneration = transform.generation;
    }
    this.drawEventClipRect.setRect(this.clipRect);
    return this.drawEventState;
};

/**
 * Initialize drawing circles with the given parameters.
 * @param {boolean} soft Use soft edged circles.
 * @param {number} textureId Id of the brush tip texture to use. 0 means to draw only circles.
 */
BaseRasterizer.prototype.beginCircles = function(soft, textureId) {
    this.soft = soft;
    this.texturized = textureId > 0 && this.brushTextures !== null;
    if (this.texturized) {
        this.brushTex = this.brushTextures.getTexture(textureId - 1);
    }
    this.minRadius = this.soft ? 1.0 : 0.5;
};

/**
 * Get the actual radius of the drawn circle when the appearance of the given
 * radius is desired. Very small circles get drawn with the minimum radius with
 * reduced alpha to avoid aliasing.
 * @param {number} radius The radius of the circle.
 * @return {number} The actual draw radius to use.
 */
BaseRasterizer.prototype.drawRadius = function(radius) {
    return Math.max(radius, this.minRadius);
};

/**
 * Get the bounding radius for drawing a circle of the given radius. This covers
 * the antialiasing boundaries of the circle.
 * @param {number} radius The radius of the circle.
 * @return {number} The draw radius for the purposes of antialiasing.
 */
BaseRasterizer.prototype.drawBoundingRadius = function(radius) {
    return Math.max(radius, this.minRadius) + 1.0;
};

/**
 * Get the alpha multiplier for the drawn circle when the appearance of the given
 * radius is desired. Very small circles get drawn with the minimum radius with
 * reduced alpha to avoid aliasing.
 * @param {number} radius The radius of the circle.
 * @return {number} The alpha multiplier to use.
 */
BaseRasterizer.prototype.circleAlpha = function(radius) {
    return Math.pow(Math.min(radius / this.minRadius, 1.0), 2.0);
};

/**
 * Flush all circle drawing commands that have been given to the bitmap.
 */
BaseRasterizer.prototype.flushCircles = function() {
};

/**
 * Clean up any allocated resources. The rasterizer is not usable after this.
 */
BaseRasterizer.prototype.free = function() {
};

/** Minimum width or height for performing the sanity check. */
BaseRasterizer.minSize = 10;

/**
 * Do a basic sanity check by drawing things and reading back the pixels,
 * checking that they're roughly within the expected boundaries.
 * @return {boolean} The test showed expected results.
 */
BaseRasterizer.prototype.checkSanity = function() {
    var i, pix;
    this.drawEvent = null;
    this.resetClip();
    this.clear();
    this.beginCircles(false, 0);
    for (var i = 0; i < 4; ++i) {
        this.fillCircle(1.5 + i, 1.5 + i, 2.0, 1.0, 0);
    }
    this.flushCircles();
    for (i = 1; i <= 4; ++i) {
        pix = this.getPixel(new Vec2(i, i));
        if (this.getPixel(new Vec2(i, i)) < 0.995) {
            console.log('Pixel rendered with flow 1.0 was ' + pix);
            return false;
        }
    }
    this.clear();
    this.beginCircles(false, 0);
    for (var i = 0; i < 11; ++i) {
        this.fillCircle(i + 3.5, i + 3.5, 2.0, 0.5, 0);
    }
    this.flushCircles();
    var lastPix = -1.0;
    for (i = 3; i <= 9; ++i) {
        pix = this.getPixel(new Vec2(i, i));
        if (pix < 0.6 || pix > 0.95) {
            console.log('Pixel rendered with flow 0.5 was ' + pix);
            return false;
        }
        if (pix < lastPix - 0.05) {
            console.log('Pixel rendered with flow 0.5 changed from ' +
                        lastPix + ' to ' + pix +
                        ' when progressing along the brush stroke');
            return false;
        }
        lastPix = pix;
    }
    this.clear();
    return true;
};

export {
    BaseRasterizer
};
