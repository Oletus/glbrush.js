/*
 * Copyright Olli Etuaho 2019.
 */

import { Vec2 } from './vec2.js';

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

export { AffineTransform };
