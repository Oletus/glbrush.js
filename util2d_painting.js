/*
 * Copyright Olli Etuaho 2012-2014.
 */

// This file augments the 2d utilities to add functions that are useful for
// bitmap painting applications.

'use strict';

import {
    Rect
} from "./util2d.js";

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
