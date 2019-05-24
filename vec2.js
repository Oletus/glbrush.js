/*
 * Copyright Olli Etuaho 2019.
 */

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
 * Copy vec2 coordinates from another vec2.
 * @param {Vec2} vec Another vector.
 */
Vec2.prototype.setVec2 = function(vec) {
    this.x = vec.x;
    this.y = vec.y;
};

/**
 * Round the coordinates of this vector to the closest integers.
 */
Vec2.prototype.round = function() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
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
 * Calculate the angle of this vector compared to the positive x axis, so that
 * the angle is < PI when y < 0 and > PI when y < 0.
 * @return {number} The angle.
 */
Vec2.prototype.angle = function() {
    var angle = Math.acos(this.x / this.length());
    if (this.y < 0) {
        angle = Math.PI * 2 - angle;
    }
    return angle;
};

/**
 * Calculate the angle difference between two vectors, with both vectors'
 * angles calculated from the positive x axis.
 * @param {Vec2} vec The other vector.
 * @return {number} The difference in angles.
 */
Vec2.prototype.angleFrom = function(vec) {
    return this.angle() - vec.angle();
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
    this.x -= perpVector.x * perpProjLength;
    this.y -= perpVector.y * perpProjLength;
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
 * Transform this vector with a 3x3 SVG matrix.
 * @param {SVGMatrix} svgMatrix Matrix to transform with.
 */
Vec2.prototype.transformSvg = function(svgMatrix) {
    var x = svgMatrix.a * this.x + svgMatrix.c * this.y + svgMatrix.e;
    this.y = svgMatrix.b * this.x + svgMatrix.d * this.y + svgMatrix.f;
    this.x = x;
};

/**
 * Translate this vector with another vector.
 * @param {Vec2} vec Vector to translate with.
 */
Vec2.prototype.translate = function(vec) {
    this.x += vec.x;
    this.y += vec.y;
};

/**
 * Rotate this vector with a given angle.
 * @param {number} angle Angle to rotate with.
 */
Vec2.prototype.rotate = function(angle) {
    var x = Math.cos(angle) * this.x - Math.sin(angle) * this.y;
    this.y = Math.sin(angle) * this.x + Math.cos(angle) * this.y;
    this.x = x;
};

export { Vec2 };
