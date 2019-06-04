/*
 * Copyright Olli Etuaho 2019.
 */

/**
 * Create a CSS RGB color based on the input array.
 * @param {Array.<number>|Uint8Array} rgbArray Unpremultiplied color value.
 * Channel values should be 0-255. Must contain at least 3 values.
 * @return {string} CSS color.
 */
var rgbString = function(rgbArray) {
    return 'rgb(' + Math.floor(rgbArray[0]) + ',' + Math.floor(rgbArray[1]) +
    ',' + Math.floor(rgbArray[2]) + ')';
};

/**
 * Create a CSS RGBA color based on the input array.
 * @param {Array.<number>|Uint8Array} rgbaArray Unpremultiplied color value.
 * Channel values should be 0-255. Must contain 4 values.
 * @return {string} CSS color.
 */
var rgbaString = function(rgbaArray) {
    return 'rgba(' + Math.floor(rgbaArray[0]) + ',' + Math.floor(rgbaArray[1]) +
    ',' + Math.floor(rgbaArray[2]) + ',' + (rgbaArray[3] / 255) + ')';
};

export { rgbString, rgbaString };
