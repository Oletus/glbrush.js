/*
 * Copyright Olli Etuaho 2012-2014.
 */

// This file contains following utilities:
// colorUtil: Utilities for working with RGB colors represented as arrays of numbers, including blending
// AffineTransform: A scale/translate transform.
// Rect: A class for storing a two-dimensional rectangle.

'use strict';

import { hslToRgb, rgbToHsl } from './lib/hsl.js';

import { Vec2 } from './vec2.js';

import { clamp } from './math_util.js';

var colorUtil = {
    unpremultiply: null,
    premultiply: null,
    blend: null,
    serializeRGB: null,
    differentColor: null,
    blendWithFunction: null,
    blendMultiply: null,
    blendScreen: null,
    blendDarken: null,
    blendLighten: null,
    blendDifference: null,
    blendExclusion: null,
    blendOverlay: null,
    blendHardLight: null,
    blendSoftLight: null,
    blendColorBurn: null,
    blendLinearBurn: null,
    blendVividLight: null,
    blendLinearLight: null,
    blendPinLight: null,
    blendColorDodge: null,
    blendLinearDodge: null
};

/**
 * Unpremultiply a color value.
 * @param {Array.<number>|Uint8Array} premultRGBA Premultiplied color value.
 * Channel values should be 0-255.
 * @return {Array.<number>|Uint8Array} The input array, if the result is
 * identical, or a new array with unpremultiplied color. Channel values 0-255.
 */
colorUtil.unpremultiply = function(premultRGBA) {
    if (premultRGBA[3] === 255) {
        return premultRGBA;
    }
    var buffer = new ArrayBuffer(4);
    var unmultRGBA = new Uint8Array(buffer);
    var alpha = premultRGBA[3] / 255.0;
    if (alpha > 0) {
        for (var i = 0; i < 3; ++i) {
            unmultRGBA[i] = premultRGBA[i] / alpha;
        }
        unmultRGBA[3] = premultRGBA[3];
    } else {
        for (var i = 0; i < 4; ++i) {
            unmultRGBA[i] = 0;
        }
    }
    return unmultRGBA;
};

/**
 * Premultiply a color value.
 * @param {Array.<number>|Uint8Array} unpremultRGBA Unpremultiplied color value.
 * Channel values should be 0-255.
 * @return {Array.<number>|Uint8Array} The input array, if the result is
 * identical, or a new array with premultiplied color. Channel values 0-255.
 */
colorUtil.premultiply = function(unpremultRGBA) {
    if (unpremultRGBA[3] === 255) {
        return unpremultRGBA;
    }
    var buffer = new ArrayBuffer(4);
    var premultRGBA = new Uint8Array(buffer);
    var alpha = unpremultRGBA[3] / 255.0;
    if (alpha > 0) {
        for (var i = 0; i < 3; ++i) {
            premultRGBA[i] = unpremultRGBA[i] * alpha;
        }
        premultRGBA[3] = unpremultRGBA[3];
    } else {
        for (var i = 0; i < 4; ++i) {
            premultRGBA[i] = 0;
        }
    }
    return premultRGBA;
};

/**
 * Blend two unpremultiplied color values.
 * @param {Array.<number>|Uint8Array} dstRGBA Destination RGBA value.
 * @param {Array.<number>|Uint8Array} srcRGBA Source RGBA value.
 * @return {Uint8Array} Resulting RGBA color value.
 */
colorUtil.blend = function(dstRGBA, srcRGBA) {
    var srcAlpha = srcRGBA[3] / 255.0;
    var dstAlpha = dstRGBA[3] / 255.0;
    var alpha = srcAlpha + dstAlpha * (1.0 - srcAlpha);
    var buffer = new ArrayBuffer(4);
    var resultRGBA = new Uint8Array(buffer);
    for (var i = 0; i < 3; ++i) {
        resultRGBA[i] = (dstRGBA[i] * dstAlpha * (1.0 - srcAlpha) +
                         srcRGBA[i] * srcAlpha) / alpha + 0.5;
    }
    resultRGBA[3] = alpha * 255 + 0.5;
    return resultRGBA;
};

/**
 * Serialize an RGB value.
 * @param {Array.<number>|Uint8Array} RGB RGB value.
 * @return {Array} Copy of the value suitable for adding to JSON.
 */
colorUtil.serializeRGB = function(RGB) {
    return [RGB[0], RGB[1], RGB[2]];
};

/**
 * Return a color that is visually distinct from the given color. The hue is
 * inverted and the lightness is inverted, unless the lightness is close to
 * 0.5, when the lightness is simply increased.
 * @param {Array.<number>|Uint8Array} color An RGB value.
 * @return {Array.<number>} A different RGB value.
 */
colorUtil.differentColor = function(color) {
    var hsl = rgbToHsl(color[0], color[1], color[2]);
    hsl[0] = (hsl[0] + 0.5) % 1;
    if (hsl[2] < 0.4 || hsl[2] > 0.6) {
        hsl[2] = 1.0 - hsl[2];
    } else {
        hsl[2] = (hsl[2] + 0.4) % 1;
    }
    return hslToRgb(hsl[0], hsl[1], hsl[2]);
};

/**
 * Blend the two single-channel values to each other, taking into account bottom and top layer alpha.
 * @param {function} blendFunction The blend function to use, one of colorUtil.blend*
 * @param {number} target Single-channel color value of the bottom layer, 0 to 255.
 * @param {number} source Single-channel color value of the top layer, 0 to 255.
 * @param {number} targetAlpha Alpha value of the bottom layer, 0.0 to 1.0.
 * @param {number} sourceAlpha Alpha value of the top layer, 0.0 to 1.0.
 * @return {number} Blend result as an integer from 0 to 255.
 */
colorUtil.blendWithFunction = function(blendFunction, target, source, targetAlpha, sourceAlpha) {
    var alpha = targetAlpha + sourceAlpha * (1.0 - targetAlpha);
    if (alpha > 0.0) {
        // First calculate the blending result without taking the transparency of the target into account.
        var rawResult = blendFunction(target, source);
        // Then mix according to weights.
        // See KHR_blend_equation_advanced specification for reference.
        return Math.round((rawResult * targetAlpha * sourceAlpha +
                           source * sourceAlpha * (1.0 - targetAlpha) +
                           target * targetAlpha * (1.0 - sourceAlpha)) / alpha);
    } else {
        return 0.0;
    }
};

/**
 * Multiply blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendMultiply = function(a, b) {
    return a * b / 255.;
};

/**
 * Screen blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendScreen = function(a, b) {
    return 255. - (1. - a / 255.) * (255. - b);
};

/**
 * Overlay blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendOverlay = function(a, b) {
    return a < 127.5 ?
            (2.0 / 255.0 * a * b) :
            (255.0 - 2.0 * (1.0 - b / 255.0) * (255.0 - a));
};

/**
 * Hard Light blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendHardLight = function(a, b) {
    return b < 127.5 ?
            (2.0 / 255.0 * a * b) :
            (255.0 - 2.0 * (1.0 - b / 255.0) * (255.0 - a));
};

/**
 * Soft Light blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendSoftLight = function(a, b) {
    a /= 255;
    b /= 255;
    return 255 * (b <= .5 ? a - (1 - 2 * b) * a * (1 - a) :
            b > 0.5 && a <= 0.25 ? a + (2 * b - 1) * a * ((16 * a - 12) * a + 3) :
            a + (2 * b - 1) * (Math.sqrt(a) - a));
};

/**
 * Darken blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendDarken = function(a, b) {
    return a < b ? a : b;
};

/**
 * Lighten blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendLighten = function(a, b) {
    return a > b ? a : b;
};

/**
 * Difference blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendDifference = function(a, b) {
    return Math.abs(a - b);
};

/**
 * Exclusion blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendExclusion = function(a, b) {
    return a + b - 2.0 / 255.0 * a * b;
};

/**
 * Color Burn blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendColorBurn = function(a, b) {
    if (a === 255)
        return 255;
    if (b === 0)
        return 0;
    return clamp(0, 255, 255 - (255 - a) / b * 255);
};

/**
 * Linear Burn blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendLinearBurn = function(a, b) {
    return clamp(0, 255, a + b - 255.);
};

/**
 * Vivid Light blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendVividLight = function(a, b) {
    if (b === 0)
        return 0;
    if (b === 255)
        return 255;
    a /= 255;
    b /= 255;
    return clamp(0, 255, 255 * (b <= .5 ?
            1 - (1 - a) / (2 * b) :
            a / (2 * (1 - b))));
};

/**
 * Linear Light blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendLinearLight = function(a, b) {
    a /= 255;
    b /= 255;
    return clamp(0, 255, 255 * (b <= .5 ?
            (a + 2 * b - 1) :
            (a + 2 * (b - 0.5))));
};

/**
 * Pin Light blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendPinLight = function(a, b) {
    a /= 255;
    b /= 255;
    return 255 * (b <= .5 ?
            (Math.min(a, 2 * b)) :
            (Math.max(a, 2 * (b - 0.5))));
};

/**
 * Color Dodge blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendColorDodge = function(a, b) {
    if (a === 0)
        return 0;
    if (b === 255)
        return 255;
    return clamp(0, 255, 255. * a / (255 - b));
};

/**
 * Linear Dodge blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
colorUtil.blendLinearDodge = function(a, b) {
    return clamp(0, 255, a + b);
};

/**
 * A 2D affine transform.
 * @constructor
 */
var AffineTransform = function() {
    this.scale = 1.0;
    this.translate = new Vec2(0, 0);
    this.generation = 0; // Id number that can be used to determine the transform's identity.
};

/**
 * Transform the given vector.
 * @param {Vec2} vec Vector to transform in-place.
 */
AffineTransform.prototype.transform = function(vec) {
    vec.x = vec.x * this.scale + this.translate.x;
    vec.y = vec.y * this.scale + this.translate.y;
};

/**
 * Inverse transform the given vector.
 * @param {Vec2} vec Vector to transform in-place.
 */
AffineTransform.prototype.inverseTransform = function(vec) {
    vec.x = (vec.x - this.translate.x) / this.scale;
    vec.y = (vec.y - this.translate.y) / this.scale;
};

/**
 * Transform the given coordinate.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @return {number} Transformed x coordinate.
 */
AffineTransform.prototype.transformX = function(x, y) {
    return x * this.scale + this.translate.x;
};

/**
 * Transform the given coordinate.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @return {number} Transformed y coordinate.
 */
AffineTransform.prototype.transformY = function(x, y) {
    return y * this.scale + this.translate.y;
};

/**
 * Scale the given coordinate.
 * @param {number} v Coordinate.
 * @return {number} Scaled coordinate.
 */
AffineTransform.prototype.scaleValue = function(v) {
    return v * this.scale;
};

/**
 * Inverse scale the given coordinate.
 * @param {number} v Coordinate.
 * @return {number} Scaled coordinate.
 */
AffineTransform.prototype.inverseScale = function(v) {
    return v / this.scale;
};

/**
 * Transform an axis-aligned rectangle.
 * @param {Rect} rect Rectangle to transform in-place.
 */
AffineTransform.prototype.transformRect = function(rect) {
    var left = rect.left;
    rect.left = this.transformX(rect.left, rect.top);
    rect.right = this.transformX(rect.right, rect.top);
    rect.top = this.transformY(left, rect.top);
    rect.bottom = this.transformY(left, rect.bottom);
};


/**
 * @constructor
 * @param {number} left Left edge of the rectangle.
 * @param {number} right Right edge of the rectangle.
 * @param {number} top Top edge of the rectangle.
 * @param {number} bottom Bottom edge of the rectangle.
 */
var Rect = function(left, right, top, bottom) {
    this.set(left, right, top, bottom);
};

/**
 * Set the rectangle's coordinates.
 * @param {number} left Left edge of the rectangle.
 * @param {number} right Right edge of the rectangle.
 * @param {number} top Top edge of the rectangle.
 * @param {number} bottom Bottom edge of the rectangle.
 */
Rect.prototype.set = function(left, right, top, bottom) {
    if (left === undefined || left === right || top === bottom) {
        this.makeEmpty();
        return;
    }
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
};

/**
 * Copy rectangle coordinates from another rectangle.
 * @param {Rect} rect Another rectangle.
 */
Rect.prototype.setRect = function(rect) {
    this.left = rect.left;
    this.right = rect.right;
    this.top = rect.top;
    this.bottom = rect.bottom;
};

/**
 * Make this rectangle empty.
 */
Rect.prototype.makeEmpty = function() {
    this.left = 0;
    this.right = 0;
    this.top = 0;
    this.bottom = 0;
};

/**
 * @return {boolean} Is the rectangle empty?
 */
Rect.prototype.isEmpty = function() {
    return this.left === this.right || this.top === this.bottom;
};

/**
 * @return {number} The width of the rectangle.
 */
Rect.prototype.width = function() {
    return this.right - this.left;
};

/**
 * @return {number} The height of the rectangle.
 */
Rect.prototype.height = function() {
    return this.bottom - this.top;
};

/**
 * @return {number} Area of the rectangle.
 */
Rect.prototype.area = function() {
    return this.width() * this.height();
};

/**
 * @return {Object} This rectangle in a different representation. The return
 * value includes numbers x (left edge), y (top edge), w (width) and h (height).
 */
Rect.prototype.getXYWH = function() {
    return {
        x: this.left,
        y: this.top,
        w: this.right - this.left,
        h: this.bottom - this.top
    };
};

/**
 * @return {Object} This rectangle rounded out to integer coordinates. The
 * return value includes numbers x (left edge), y (top edge), w (width) and h
 * (height).
 */
Rect.prototype.getXYWHRoundedOut = function() {
    return {
        x: Math.floor(this.left),
        y: Math.floor(this.top),
        w: Math.ceil(this.right) - Math.floor(this.left),
        h: Math.ceil(this.bottom) - Math.floor(this.top)
    };
};

/**
 * Set this rectangle to the bounding box of this rectangle and the given
 * rectangle.
 * @param {Rect} rect Another rectangle.
 */
Rect.prototype.unionRect = function(rect) {
    if (rect.isEmpty()) {
        return;
    }
    if (this.isEmpty()) {
        this.setRect(rect);
    } else {
        this.left = Math.min(this.left, rect.left);
        this.right = Math.max(this.right, rect.right);
        this.top = Math.min(this.top, rect.top);
        this.bottom = Math.max(this.bottom, rect.bottom);
    }
};

/**
 * @param {Rect} rect Another rectangle.
 * @return {Rect} A new rectangle containing the union of this rectangle and the
 * given rectangle.
 */
Rect.prototype.getUnion = function(rect) {
    var ret = new Rect(rect.left, rect.right, rect.top, rect.bottom);
    ret.unionRect(this);
    return ret;
};

/**
 * Set this rectangle to the intersection of this this rectangle and the given
 * rectangle.
 * @param {Rect} rect Another rectangle.
 */
Rect.prototype.intersectRect = function(rect) {
    if (this.isEmpty()) {
        return;
    }
    if (rect.isEmpty()) {
        this.makeEmpty();
    } else {
        this.left = Math.max(this.left, rect.left);
        this.right = Math.min(this.right, rect.right);
        this.top = Math.max(this.top, rect.top);
        this.bottom = Math.min(this.bottom, rect.bottom);
        if (this.left >= this.right || this.top >= this.bottom) {
            this.makeEmpty();
        }
    }
};

/**
 * @param {Rect} rect Another rectangle.
 * @return {Rect} A new rectangle containing the intersection of this rectangle
 * and the given rectangle.
 */
Rect.prototype.getIntersection = function(rect) {
    var ret = new Rect(rect.left, rect.right, rect.top, rect.bottom);
    ret.intersectRect(this);
    return ret;
};

/**
 * Clip the rectangle from the top.
 * @param {number} top Coordinate to clip with.
 */
Rect.prototype.limitTop = function(top) {
    this.top = Math.min(Math.max(top, this.top), this.bottom);
};

/**
 * Clip the rectangle from the bottom.
 * @param {number} bottom Coordinate to clip with.
 */
Rect.prototype.limitBottom = function(bottom) {
    this.bottom = Math.min(Math.max(bottom, this.top), this.bottom);
};

/**
 * Clip the rectangle from the left.
 * @param {number} left Coordinate to clip with.
 */
Rect.prototype.limitLeft = function(left) {
    this.left = Math.min(Math.max(left, this.left), this.right);
};

/**
 * Clip the rectangle from the right.
 * @param {number} right Coordinate to clip with.
 */
Rect.prototype.limitRight = function(right) {
    this.right = Math.min(Math.max(right, this.left), this.right);
};

/**
 * @param {Vec2} coords Coordinates to check.
 * @return {boolean} Does this rectangle contain the given coordinates?
 */
Rect.prototype.containsVec2 = function(coords) {
    return !this.isEmpty() &&
           this.left <= coords.x &&
           this.right >= coords.x &&
           this.top <= coords.y &&
           this.bottom >= coords.y;
};

/**
 * @param {Rect} rect Another rectangle.
 * @return {boolean} Does this rectangle contain the other rectangle? The edges
 * are allowed to touch.
 */
 Rect.prototype.containsRect = function(rect) {
    return this.left <= rect.left && this.right >= rect.right &&
           this.top <= rect.top && this.bottom >= rect.bottom;
};

/**
 * Test whether this rectangle is mostly inside another.
 * @param {Rect} rect Rectangle to check against.
 * @return {boolean} Whether most of this rectangle is inside the given one.
 */
Rect.prototype.isMostlyInside = function(rect) {
    return (this.getIntersection(rect).area() > 0.5 * this.area());
};

/**
 * Create a rectangle that's the bounding box of the given circle.
 * @param {number} x The x coordinate of the center of the circle.
 * @param {number} y The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @return {Rect} A new rectangle.
 */
Rect.fromCircle = function(x, y, radius) {
    return new Rect(x - radius, x + radius, y - radius, y + radius);
};

/**
 * Scale the rectangle with respect to the origin.
 * @param {number} scale Scaling factor.
 */
Rect.prototype.scale = function(scale) {
    this.left *= scale;
    this.right *= scale;
    this.top *= scale;
    this.bottom *= scale;
};

/**
 * Translate the rectangle with an offset.
 * @param {Vec2} offset The vector to translate with.
 */
Rect.prototype.translate = function(offset) {
    this.left += offset.x;
    this.right += offset.x;
    this.top += offset.y;
    this.bottom += offset.y;
};

export {
    AffineTransform,
    colorUtil,
    Rect
};
