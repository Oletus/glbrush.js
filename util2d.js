/*
 * Copyright Olli Etuaho 2012-2013.
 */

cssUtil = {
    rgbString: null,
    rgbaString: null
};

/**
 * Create a CSS RGB color based on the input array.
 * @param {Array.<number>|Uint8Array} rgbArray Unpremultiplied color value.
 * Channel values should be 0-255.
 * @return {string} CSS color.
 */
cssUtil.rgbString = function(rgbArray) {
    return 'rgb(' + Math.floor(rgbArray[0]) + ',' + Math.floor(rgbArray[1]) +
    ',' + Math.floor(rgbArray[2]) + ')';
};

/**
 * Create a CSS RGBA color based on the input array.
 * @param {Array.<number>|Uint8Array} rgbaArray Unpremultiplied color value.
 * Channel values should be 0-255.
 * @return {string} CSS color.
 */
cssUtil.rgbaString = function(rgbaArray) {
    return 'rgba(' + Math.floor(rgbaArray[0]) + ',' + Math.floor(rgbaArray[1]) +
    ',' + Math.floor(rgbaArray[2]) + ',' + (rgbaArray[3] / 255) + ')';
};

color = {
    unpremultiply: null,
    premultiply: null,
    blend: null,
    serializeRGB: null,
    nBlends: null,
    alphaForNBlends: null
};

/**
 * Unpremultiply a color value.
 * @param {Array.<number>|Uint8Array} premultRGBA Premultiplied color value.
 * Channel values should be 0-255.
 * @return {Array.<number>|Uint8Array} The input array, if the result is
 * identical, or a new array with unpremultiplied color. Channel values 0-255.
 */
color.unpremultiply = function(premultRGBA) {
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
color.premultiply = function(unpremultRGBA) {
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
color.blend = function(dstRGBA, srcRGBA) {
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
 * @return {string} Serialized representation of the value.
 */
color.serializeRGB = function(RGB) {
    return RGB[0] + ' ' + RGB[1] + ' ' + RGB[2];
};

/**
 * Serialize an RGBA value.
 * @param {Array.<number>|Uint8Array} RGBA RGBA value.
 * @return {string} Serialized representation of the value.
 */
color.serializeRGBA = function(RGBA) {
    return RGBA[0] + ' ' + RGBA[1] + ' ' + RGBA[2] + ' ' + RGBA[3];
};

/**
 * Calculate the resulting alpha value from blending a given alpha value with
 * itself n times.
 * @param {number} alpha The alpha value to blend with itself, between 0 and 1.
 * @param {number} n Amount of times to blend. Must be an integer.
 * @return {number} The resulting alpha value.
 */
color.nBlends = function(alpha, n) {
    if (alpha === 1.0) {
        return 1.0;
    }
    var result = 0;
    for (var i = 0; i < n; ++i) {
        result = result + alpha * (1.0 - result);
    }
    return result;
};

/**
 * Calculate an alpha value so that blending a sample with that alpha n times
 * results in the given flow value.
 * @param {number} flow The flow value, between 0 and 1.
 * @param {number} n The number of times to blend.
 * @return {number} Such alpha value that blending it with itself n times
 * results in the given flow value.
 */
color.alphaForNBlends = function(flow, n) {
    if (flow < 1.0) {
        // Solved from alpha blending differential equation:
        // flow'(n) = (1.0 - flow(n)) * adjustedFlow
        var guess = Math.min(-Math.log(1.0 - flow) / n, 1.0);
        var resultDiff = 1.0;
        var low = 0;
        var high = flow;
        // Bisect until result is close enough
        while (true) {
            var blended = color.nBlends(guess, n);
            if (blended < flow) {
                low = guess;
            } else {
                high = guess;
            }
            resultDiff = Math.abs(blended - flow);
            if (resultDiff < 0.0005) {
                return guess;
            }
            guess = (low + high) * 0.5;
        }
    } else {
        return 1.0;
    }
};

/**
 * @constructor
 * @param {number} x Horizontal component of the vector.
 * @param {number} y Vertical component of the vector.
 */
var Vec2 = function(x, y) {
    this.x = x;
    this.y = y;
};

/**
 * Normalize this vector.
 */
Vec2.prototype.normalize = function() {
    var len = this.length();
    this.x /= len;
    this.y /= len;
};

/**
 * Calculate this vector's distance from another vector.
 * @param {Vec2} vec The other vector.
 * @return {number} The distance.
 */
Vec2.prototype.distance = function(vec) {
    return Math.sqrt(Math.pow(this.x - vec.x, 2) + Math.pow(this.y - vec.y, 2));
};

/**
 * Calculate length.
 * @return {number} The length of the vector.
 */
Vec2.prototype.length = function() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
};

/**
 * Scale this vector by scalar mult.
 * @param {number} mult Multiplier to scale with.
 */
Vec2.prototype.scale = function(mult) {
    this.x *= mult;
    this.y *= mult;
};

/**
 * Dot product with another Vec2.
 * @param {Vec2} vec Vector to calculate the dot product with.
 * @return {number} The dot product.
 */
Vec2.prototype.dotProduct = function(vec) {
    return this.x * vec.x + this.y * vec.y;
};

/**
 * Calculate slope from this vector to another vector i.e. delta Y / delta X.
 * Does not check for division by zero.
 * @param {Vec2} vec The other vector.
 * @return {number} The slope.
 */
Vec2.prototype.slope = function(vec) {
    return (vec.y - this.y) / (vec.x - this.x);
};

/**
 * Projects this vector to the nearest point on the line defined by two points.
 * @param {Vec2} lineA One point on the line to project to.
 * @param {Vec2} lineB Another point on the line to project to.
 */
Vec2.prototype.projectToLine = function(lineA, lineB) {
    if (lineA.x === lineB.x) {
        this.x = lineA.x;
        return;
    } else if (lineA.y === lineB.y) {
        this.y = lineA.y;
        return;
    }

    // The line's equation: y = lineSlope * x + lineYAtZero
    var lineSlope = lineA.slope(lineB);
    var lineYAtZero = lineA.y - lineSlope * lineA.x;

    var perpVector = new Vec2(1.0, -1.0 / lineSlope);
    perpVector.normalize();
    // perpVector's dot product with a vector that goes from line to this Vec2
    var perpProjLength = perpVector.y *
                         (this.y - (lineSlope * this.x + lineYAtZero));
    perpVector.scale(perpProjLength);
    this.x -= perpVector.x;
    this.y -= perpVector.y;
};

/**
 * Projects this vector to the nearest point on the given circle.
 * @param {number} x The x coordinate of the center of the circle.
 * @param {number} y The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 */
Vec2.prototype.projectToCircle = function(x, y, radius) {
    var angle = Math.atan2(this.y - y, this.x - x);
    this.x = x + Math.cos(angle) * radius;
    this.y = y + Math.sin(angle) * radius;
};

/**
 * Calculate this vector's distance to the line defined by two points.
 * @param {Vec2} lineA One point on the line.
 * @param {Vec2} lineB Another point on the line.
 * @return {number} This vector's distance to the nearest point on the line.
 */
Vec2.prototype.distanceToLine = function(lineA, lineB) {
    var projection = new Vec2(this.x, this.y);
    projection.projectToLine(lineA, lineB);
    return this.distance(projection);
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
 * @return {Object} This rectangle rounded out to integer coordinates. The
 * return value includes numbers x (left edge), y (top edge), w (width) and h
 * (height).
 */
Rect.prototype.getXYWH = function() {
    return {
        x: Math.floor(this.left),
        y: Math.floor(this.top),
        w: Math.ceil(this.right) - Math.floor(this.left),
        h: Math.ceil(this.bottom) - Math.floor(this.top)
    };
};

/**
 * Set this rectangle to the bounding box of this rectangle and the given
 * circle.
 * @param {number} x The x coordinate of the center of the circle.
 * @param {number} y The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 */
Rect.prototype.unionCircle = function(x, y, radius) {
    this.unionCoords(x - radius, x + radius, y - radius, y + radius);
};

/**
 * Set this rectangle to the bounding box of this rectangle and the given
 * rectangle.
 * @param {number} left Left edge of the rectangle.
 * @param {number} right Right edge of the rectangle.
 * @param {number} top Top edge of the rectangle.
 * @param {number} bottom Bottom edge of the rectangle.
 */
Rect.prototype.unionCoords = function(left, right, top, bottom) {
    if (left === right || top === bottom) {
        return;
    }
    if (this.left === this.right || this.top === this.bottom) {
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
    } else {
        this.left = Math.min(this.left, left);
        this.right = Math.max(this.right, right);
        this.top = Math.min(this.top, top);
        this.bottom = Math.max(this.bottom, bottom);
    }
};

/**
 * Set this rectangle to the bounding box of this rectangle and the given
 * rectangle.
 * @param {Rect} rect Another rectangle.
 */
Rect.prototype.unionRect = function(rect) {
    this.unionCoords(rect.left, rect.right, rect.top, rect.bottom);
};

/**
 * Set this rectangle to the intersection of this this rectangle and the given
 * rectangle.
 * @param {Rect} rect Another rectangle.
 */
Rect.prototype.intersectRect = function(rect) {
    if (rect.left === rect.right || rect.top === rect.bottom) {
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
 * Create a rectangle that's the bounding box of the given circle.
 * @param {number} x The x coordinate of the center of the circle.
 * @param {number} y The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @return {Rect} A new rectangle.
 */
Rect.fromCircle = function(x, y, radius) {
    return new Rect(x - radius, x + radius, y - radius, y + radius);
};


var canvasUtil = {};

/**
 * Draw an outlined stroke using the current path.
 * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
 */
canvasUtil.dualStroke = function(ctx) {
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
};
