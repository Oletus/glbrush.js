/*
 * Copyright Olli Etuaho 2012-2014.
 */

// This file augments the 2d utilities to add functions that are useful for
// bitmap painting applications.

'use strict';

/**
 * Calculate the resulting alpha value from blending a given alpha value with
 * itself n times.
 * @param {number} alpha The alpha value to blend with itself, between 0 and 1.
 * @param {number} n Amount of times to blend.
 * @return {number} The resulting alpha value.
 */
colorUtil.nBlends = function(alpha, n) {
    if (n < 1) {
        return alpha * n;
    }
    if (alpha === 1.0) {
        return 1.0;
    }
    var i = 1;
    var result = alpha;
    while (i * 2 <= Math.floor(n)) {
        result = result + result * (1.0 - result);
        i *= 2;
    }
    while (i < Math.floor(n)) {
        result = result + alpha * (1.0 - result);
        ++i;
    }
    if (n > i) {
        var remainder = n - i;
        result = result + alpha * (1.0 - result) * remainder; // Rough linear approximation
    }
    return result;
};

/**
 * Calculate an alpha value so that blending a sample with that alpha n times
 * results approximately in the given flow value.
 * @param {number} flow The flow value, between 0 and 1.
 * @param {number} n The number of times to blend.
 * @return {number} Such alpha value that blending it with itself n times
 * results in the given flow value.
 */
colorUtil.approximateAlphaForNBlends = function(flow, n) {
    // Solved from alpha blending differential equation:
    // flow'(n) = (1.0 - flow(n)) * singleBlendAlpha
    //return Math.min(-Math.log(1.0 - flow) / n, 1.0);

    // Above solution with an ad-hoc tweak:
    return Math.min(-Math.log(1.0 - flow) / (n + Math.pow(flow, 2) * 1.5), 1.0);
};

/**
 * Calculate an alpha value so that blending a sample with that alpha n times
 * results in the given flow value.
 * @param {number} flow The flow value, between 0 and 1.
 * @param {number} n The number of times to blend.
 * @return {number} Such alpha value that blending it with itself n times
 * results in the given flow value.
 */
colorUtil.alphaForNBlends = function(flow, n) {
    if (n < 1.0) {
        return Math.min(flow / n, 1.0);
    }
    if (flow < 1.0) {
        var guess = colorUtil.approximateAlphaForNBlends(flow, n);
        var low = 0;
        var high = flow;
        // Bisect until result is close enough
        while (true) {
            var blended = colorUtil.nBlends(guess, n);
            if (Math.abs(blended - flow) < 0.0005) {
                return guess;
            }
            if (blended < flow) {
                low = guess;
            } else {
                high = guess;
            }
            guess = (low + high) * 0.5;
        }
    } else {
        return 1.0;
    }
};

/**
 * Set this rectangle to the bounding box of this rectangle and the given
 * circle.
 * @param {number} x The x coordinate of the center of the circle.
 * @param {number} y The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 */
Rect.prototype.unionCircle = function(x, y, radius) {
    this.unionRect(new Rect(x - radius, x + radius, y - radius, y + radius));
};

/**
 * Set this rectangle to the intersection of this this rectangle and the given
 * rectangle, first rounding out both rectangles to integer coordinates.
 * @param {Rect} rect Another rectangle.
 */
Rect.prototype.intersectRectRoundedOut = function(rect) {
    if (rect.left === rect.right || rect.top === rect.bottom ||
        !this.intersectsRectRoundedOut(rect)) {
        this.makeEmpty();
    } else {
        this.left = Math.max(Math.floor(this.left), Math.floor(rect.left));
        this.right = Math.min(Math.ceil(this.right), Math.ceil(rect.right));
        this.top = Math.max(Math.floor(this.top), Math.floor(rect.top));
        this.bottom = Math.min(Math.ceil(this.bottom), Math.ceil(rect.bottom));
    }
};

/**
 * Determine if this rectangle intersects with the bounding box of the given
 * circle, when they are both rounded out to integer coordinates.
 * @param {number} x The x coordinate of the center of the circle.
 * @param {number} y The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @return {boolean} Does this rectangle intersect the bounding box of the
 * circle?
 */
Rect.prototype.mightIntersectCircleRoundedOut = function(x, y, radius) {
    return this.intersectsCoordsRoundedOut(x - radius, x + radius,
                                           y - radius, y + radius);
};

/**
 * Determine if this rectangle intersects with another rectangle, when both
 * rectangles have first been rounded out to integer coordinates.
 * @param {Rect} rect Another rectangle.
 * @return {boolean} Does this rectangle intersect the other rectangle?
 */
Rect.prototype.intersectsRectRoundedOut = function(rect) {
    return this.intersectsCoordsRoundedOut(rect.left, rect.right,
                                           rect.top, rect.bottom);
};

/**
 * Determine if this rectangle intersects with another rectangle defined by the
 * given coordinates, when both rectangles have first been rounded out to
 * integer coordinates.
 * @param {number} left Left edge of the rectangle.
 * @param {number} right Right edge of the rectangle.
 * @param {number} top Top edge of the rectangle.
 * @param {number} bottom Bottom edge of the rectangle.
 * @return {boolean} Does this rectangle intersect the other rectangle?
 */
Rect.prototype.intersectsCoordsRoundedOut = function(left, right, top, bottom) {
    return !(this.right <= Math.floor(left) || this.left >= Math.ceil(right) ||
             this.bottom <= Math.floor(top) || this.top >= Math.ceil(bottom));
};

/**
 * @param {Vec2} coords Coordinates to check.
 * @return {boolean} Does this rectangle contain the given coordinates?
 */
Rect.prototype.containsRoundedOut = function(coords) {
    return Math.floor(this.left) <= coords.x &&
           Math.ceil(this.right) >= coords.x &&
           Math.floor(this.top) <= coords.y &&
           Math.ceil(this.bottom) >= coords.y;
};
