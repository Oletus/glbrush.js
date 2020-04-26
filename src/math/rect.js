/*
 * Copyright Olli Etuaho 2012-2014.
 */

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

export {
    Rect
};
