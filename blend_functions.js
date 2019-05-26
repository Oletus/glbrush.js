/*
 * Copyright Olli Etuaho 2019.
 */

import { clamp } from './math_util.js';

/**
 * Multiply blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var multiply = function(a, b) {
    return a * b / 255.;
};

/**
 * Screen blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var screen = function(a, b) {
    return 255. - (1. - a / 255.) * (255. - b);
};

/**
 * Overlay blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var overlay = function(a, b) {
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
var hardLight = function(a, b) {
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
var softLight = function(a, b) {
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
var darken = function(a, b) {
    return a < b ? a : b;
};

/**
 * Lighten blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var lighten = function(a, b) {
    return a > b ? a : b;
};

/**
 * Difference blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var difference = function(a, b) {
    return Math.abs(a - b);
};

/**
 * Exclusion blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var exclusion = function(a, b) {
    return a + b - 2.0 / 255.0 * a * b;
};

/**
 * Color Burn blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var colorBurn = function(a, b) {
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
var linearBurn = function(a, b) {
    return clamp(0, 255, a + b - 255.);
};

/**
 * Vivid Light blend mode.
 * @param {number} a Value between/or 0 and 255
 * @param {number} b Value between/or 0 and 255
 * @return {number} Blended value between/or 0 and 255
 */
var vividLight = function(a, b) {
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
var linearLight = function(a, b) {
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
var pinLight = function(a, b) {
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
var colorDodge = function(a, b) {
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
var linearDodge = function(a, b) {
    return clamp(0, 255, a + b);
};

export {
    multiply,
    screen,
    overlay,
    hardLight,
    softLight,
    darken,
    lighten,
    difference,
    exclusion,
    colorBurn,
    linearBurn,
    vividLight,
    linearLight,
    pinLight,
    colorDodge,
    linearDodge
};
