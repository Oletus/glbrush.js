/*
 * Copyright Olli Etuaho 2019.
 */

/**
 * Linear interpolation of a and b by weight f
 * @param {number} a Value a, if f == 0.0, a is returned
 * @param {number} b Value b, if f == 1.0, b is returned
 * @param {number} f Interpolation weight
 * @return {number} Interpolated value between a and b
 */
var mix = function(a, b, f) {
    return a + f * (b - a);
};

/**
 * Modulus for floating point numbers.
 * @param {number} a Dividend
 * @param {number} b Divisor
 * @return {number} Float remainder of a / b
 */
var fmod = function(a, b) {
    return Number((a - (Math.floor(a / b) * b)).toPrecision(8));
};

/**
 * Mix numbers by weight a and b, wrapping back to 0 at w.
 * @param {number} a Number a, if f == 0.0, a + n * w is returned.
 * @param {number} b Number b, if f == 1.0, b + n * w is returned.
 * @param {number} f Interpolation weight.
 * @param {number} w Number to wrap around at.
 * @return {number} Interpolated value between a and b.
 */
var mixWithWrap = function(a, b, f, w) {
    a = fmod(a, w);
    b = fmod(b, w);
    if (Math.abs(a - b) > w * 0.5) {
        if (a > b) {
            b += w;
        } else {
            a += w;
        }
    }
    return fmod(mix(a, b, f), w);
};

var mixSmooth = function(a, b, f) {
    var f2 = (1 - Math.cos(f * Math.PI)) / 2;
    return mix(a, b, f2);
};

/**
 * Linear interpolation of angles a and b in radians by weight f
 * @param {number} a Angle a, if f == 0.0, a + n * PI * 2 is returned.
 * @param {number} b Angle b, if f == 1.0, b + n * PI * 2 is returned.
 * @param {number} f Interpolation weight.
 * @return {number} Interpolated value between a and b.
 */
var mixAngles = function(a, b, f) {
    return mixWithWrap(a, b, f, 2 * Math.PI);
};

/**
 * @param {number} a Angle a.
 * @param {number} b Angle b.
 * @return {number} Smallest difference of the angles a + n * PI * 2 and b in radians.
 */
var angleDifference = function(a, b) {
    a = fmod(a, Math.PI * 2);
    b = fmod(b, Math.PI * 2);
    if (Math.abs(a - b) > Math.PI) {
        if (a > b) {
            b += Math.PI * 2;
        } else {
            a += Math.PI * 2;
        }
    }
    return Math.abs(a - b);
};

/**
 * @param {number} a Angle a.
 * @param {number} b Angle b.
 * @return {boolean} True if the angle a + n * PI * 2 that is closest to b is greater than b.
 */
var angleGreater = function(a, b) {
    a = fmod(a, Math.PI * 2);
    b = fmod(b, Math.PI * 2);
    if (Math.abs(a - b) > Math.PI) {
        if (a > b) {
            return false;
        } else {
            return true;
        }
    }
    return (a > b);
};

/**
 * Smooth interpolation of a and b by transition value f. Starts off quickly but eases towards the end.
 * @param {number} a Value a, if f == 0.0, a is returned
 * @param {number} b Value b, if f == 1.0, b is returned
 * @param {number} f Interpolation transition value
 * @return {number} Interpolated value between a and b
 */
var ease = function(a, b, f) {
    return a + Math.sin(f * Math.PI * 0.5) * (b - a);
};

/**
 * Clamps value to range.
 * @param {number} min Minimum bound
 * @param {number} max Maximum bound
 * @param {number} value Value to be clamped
 * @return {number} Clamped value
 */
var clamp = function(min, max, value) {
    return value < min ? min : (value > max ? max : value);
};

/**
 * @param {number} x0 Start point x.
 * @param {number} y0 Start point y.
 * @param {number} x1 Control point x.
 * @param {number} y1 Control point y.
 * @param {number} x2 End point x.
 * @param {number} y2 End point y.
 * @param {number} steps How many segments to split the bezier curve to.
 * @return {number} Approximate length of the quadratic bezier curve.
 */
var bezierLength = function(x0, y0, x1, y1, x2, y2, steps) {
    var len = 0;
    var prevX = x0;
    var prevY = y0;
    var t = 0;
    var xd, yd;
    for (var i = 0; i < steps; ++i) {
        t += 1.0 / steps;
        xd = x0 * Math.pow(1.0 - t, 2) + x1 * t * (1.0 - t) * 2 + x2 * Math.pow(t, 2);
        yd = y0 * Math.pow(1.0 - t, 2) + y1 * t * (1.0 - t) * 2 + y2 * Math.pow(t, 2);
        len += Math.sqrt(Math.pow(xd - prevX, 2) + Math.pow(yd - prevY, 2));
        prevX = xd;
        prevY = yd;
    }
    return len;
};

/**
 * @return {number} Binomial coefficient n over k (can be interpreted as number of unique combinations of k elements
 * taken from a set of n elements)
 */
var binomialCoefficient = function(n, k) {
    // Use recursive method - don't need to worry about overflow.
    if (k === 0) {
        return 1;
    }
    if (n === k) {
        return 1;
    }
    return binomialCoefficient(n - 1, k - 1) + binomialCoefficient(n - 1, k);
};

/**
 * @param {number} n Positive integer.
 * @return {number} Factorial of n.
 */
var factorial = function(n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
};

export {
    angleDifference,
    angleGreater,
    bezierLength,
    binomialCoefficient,
    clamp,
    ease,
    factorial,
    fmod,
    mix,
    mixAngles,
    mixSmooth,
    mixWithWrap
};
