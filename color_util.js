/*
 * Copyright Olli Etuaho 2019.
 */

import { hslToRgb, rgbToHsl } from './lib/hsl.js';

import * as blendFunctions from './blend_functions.js';

import { BlendingMode } from './blending_mode.js';

/**
 * Unpremultiply a color value.
 * @param {Array.<number>|Uint8Array} premultRGBA Premultiplied color value.
 * Channel values should be 0-255.
 * @return {Array.<number>|Uint8Array} The input array, if the result is
 * identical, or a new array with unpremultiplied color. Channel values 0-255.
 */
var unpremultiply = function(premultRGBA) {
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
var premultiply = function(unpremultRGBA) {
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
var blend = function(dstRGBA, srcRGBA) {
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
var serializeRGB = function(RGB) {
    return [RGB[0], RGB[1], RGB[2]];
};

/**
 * Return a color that is visually distinct from the given color. The hue is
 * inverted and the lightness is inverted, unless the lightness is close to
 * 0.5, when the lightness is simply increased.
 * @param {Array.<number>|Uint8Array} color An RGB value.
 * @return {Array.<number>} A different RGB value.
 */
var differentColor = function(color) {
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
 * @param {function} blendFunction The blend function to use, one of the functions from blend_functions module.
 * @param {number} target Single-channel color value of the bottom layer, 0 to 255.
 * @param {number} source Single-channel color value of the top layer, 0 to 255.
 * @param {number} targetAlpha Alpha value of the bottom layer, 0.0 to 1.0.
 * @param {number} sourceAlpha Alpha value of the top layer, 0.0 to 1.0.
 * @return {number} Blend result as an integer from 0 to 255.
 */
var blendWithFunction = function(blendFunction, target, source, targetAlpha, sourceAlpha) {
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
 * Calculate the resulting alpha value from blending a given alpha value with
 * itself n times.
 * @param {number} alpha The alpha value to blend with itself, between 0 and 1.
 * @param {number} n Amount of times to blend.
 * @return {number} The resulting alpha value.
 */
var nBlends = function(alpha, n) {
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
var approximateAlphaForNBlends = function(flow, n) {
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
var alphaForNBlends = function(flow, n) {
    if (n < 1.0) {
        return Math.min(flow / n, 1.0);
    }
    if (flow < 1.0) {
        var guess = approximateAlphaForNBlends(flow, n);
        var low = 0;
        var high = flow;
        // Bisect until result is close enough
        while (true) {
            var blended = nBlends(guess, n);
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
 * @param {} mode Blending mode to look up.
 * @return {function} Blend function from the blend_functions module that implements the given blending mode.
 */
var getBlendFunction = function(mode) {
    switch (mode) {
        case BlendingMode.multiply:
            return blendFunctions.multiply;
        case BlendingMode.screen:
            return blendFunctions.screen;
        case BlendingMode.overlay:
            return blendFunctions.overlay;
        case BlendingMode.darken:
            return blendFunctions.darken;
        case BlendingMode.lighten:
            return blendFunctions.lighten;
        case BlendingMode.difference:
            return blendFunctions.difference;
        case BlendingMode.exclusion:
            return blendFunctions.exclusion;
        case BlendingMode.hardlight:
            return blendFunctions.hardLight;
        case BlendingMode.softlight:
            return blendFunctions.softLight;
        case BlendingMode.colorburn:
            return blendFunctions.colorBurn;
        case BlendingMode.linearburn:
            return blendFunctions.linearBurn;
        case BlendingMode.vividlight:
            return blendFunctions.vividLight;
        case BlendingMode.linearlight:
            return blendFunctions.linearLight;
        case BlendingMode.pinlight:
            return blendFunctions.pinLight;
        case BlendingMode.colordodge:
            return blendFunctions.colorDodge;
        case BlendingMode.lineardodge:
            return blendFunctions.linearDodge;
    }
    return null;
};

export {
    unpremultiply,
    premultiply,
    blend,
    serializeRGB,
    differentColor,
    blendWithFunction,
    nBlends,
    approximateAlphaForNBlends,
    alphaForNBlends,
    getBlendFunction
};
