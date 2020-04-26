/*
 * Copyright Olli Etuaho 2012-2013.
 */


import { BaseRasterizer } from './base_rasterizer.js';

import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import * as colorUtil from '../util/color_util.js';

/**
 * A javascript-based rasterizer.
 * @constructor
 * @param {number} width Width of the rasterizer bitmap in pixels.
 * @param {number} height Height of the rasterizer bitmap in pixels.
 * @param {CanvasBrushTextures} brushTextures Collection of brush tip textures to use.
 * @extends {BaseRasterizer}
 */
var Rasterizer = function(width, height, brushTextures) {
    this.initBaseRasterizer(width, height, brushTextures);
    this.buffer = new ArrayBuffer(width * height * 4);
    this.data = new Float32Array(this.buffer);
    this.clear();
};

Rasterizer.prototype = new BaseRasterizer();

/**
 * @return {number} The GPU memory usage of this rasterizer in bytes.
 */
Rasterizer.prototype.getMemoryBytes = function() {
    return 0;
};

/**
 * Draw the rasterizer's contents to the given bitmap.
 * @param {ImageData} targetData The buffer to draw to.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {number} x Left edge of the rasterizer area to copy to targetData. Must be an
 * integer.
 * @param {number} y Top edge of the rasterizer area to copy to targetData. Must be an
 * integer.
 * @param {number} w Width of the targetData buffer and the rasterizer area to copy there.
 * Must be an integer.
 * @param {number} h Height of the targetData buffer and the rasterizer area to copy there.
 * Must be an integer.
 */
Rasterizer.prototype.drawWithColor = function(targetData, color, opacity,
                                              x, y, w, h) {
    var tData = targetData.data;
    for (var yi = 0; yi < h; ++yi) {
        var ind = yi * w * 4;
        var sind = x + (y + yi) * this.width;
        for (var xi = 0; xi < w; ++xi) {
            var alphaT = tData[ind + 3] / 255;
            var alphaS = this.data[sind] * opacity;
            var tMult = alphaT * (1.0 - alphaS);
            var alpha = alphaS + tMult;
            tData[ind] = (tData[ind] * tMult + color[0] * alphaS) / alpha;
            tData[ind + 1] = (tData[ind + 1] * tMult + color[1] * alphaS) /
                             alpha;
            tData[ind + 2] = (tData[ind + 2] * tMult + color[2] * alphaS) /
                             alpha;
            tData[ind + 3] = 255 * alpha;
            ind += 4;
            ++sind;
        }
    }
};

/**
 * Erase the rasterizer's contents from the given bitmap.
 * @param {ImageData} targetData The buffer to erase from.
 * @param {number} opacity Opacity to use when erasing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {number} x Left edge of the area to copy to targetData. Must be an
 * integer.
 * @param {number} y Top edge of the area to copy to targetData. Must be an
 * integer.
 * @param {number} w Width of the targetData buffer and the area to copy there.
 * Must be an integer.
 * @param {number} h Height of the targetData buffer and the area to copy there.
 * Must be an integer.
 */
Rasterizer.prototype.erase = function(targetData, opacity, x, y, w, h) {
    var tData = targetData.data;
    for (var yi = 0; yi < h; ++yi) {
        var ind = yi * w * 4;
        var sind = x + (y + yi) * this.width;
        for (var xi = 0; xi < w; ++xi) {
            var alphaT = tData[ind + 3] / 255;
            var alphaS = this.data[sind] * opacity;
            tData[ind + 3] = 255 * alphaT * (1.0 - alphaS);
            ind += 4;
            ++sind;
        }
    }
};

/**
 * Draw the rasterizer's contents to the given bitmap with given blend function, applied per channel.
 * @param {ImageData} targetData The buffer to draw to.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {number} x Left edge of the area to copy to targetData. Must be an
 * integer.
 * @param {number} y Top edge of the area to copy to targetData. Must be an
 * integer.
 * @param {number} w Width of the targetData buffer and the area to copy there.
 * Must be an integer.
 * @param {number} h Height of the targetData buffer and the area to copy there.
 * Must be an integer.
 * @param {function()} blendFunction Blend function that takes inputs three inputs; base color, top color and returns
 * the resulting color.
 */
Rasterizer.prototype.blendPerChannel = function(targetData, color, opacity, x, y, w, h, blendFunction) {
    var tData = targetData.data;
    for (var yi = 0; yi < h; ++yi) {
        var ind = yi * w * 4;
        var sind = x + (y + yi) * this.width;
        for (var xi = 0; xi < w; ++xi) {
            var alphaT = tData[ind + 3] / 255;
            var alphaS = this.data[sind] * opacity;
            var alpha = alphaS + alphaT * (1.0 - alphaS);
            for (var c = 0; c < 3; c++) {
                tData[ind + c] = colorUtil.blendWithFunction(blendFunction, tData[ind + c], color[c], alphaT, alphaS);
            }
            tData[ind + 3] = 255 * alpha;
            ind += 4;
            ++sind;
        }
    }
};

/**
 * Draw the rasterizer's contents to the given bitmap. The target bitmap must
 * be opaque i.e. contain only pixels with alpha 255.
 * @param {ImageData} targetData The buffer to draw to.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {number} x Left edge of the area to copy to targetData. Must be an
 * integer.
 * @param {number} y Top edge of the area to copy to targetData. Must be an
 * integer.
 * @param {number} w Width of the targetData buffer and the area to copy there.
 * Must be an integer.
 * @param {number} h Height of the targetData buffer and the area to copy there.
 * Must be an integer.
 */
Rasterizer.prototype.drawWithColorToOpaque = function(targetData, color,
                                                      opacity, x, y, w, h) {
    var tData = targetData.data;
    for (var yi = 0; yi < h; ++yi) {
        var ind = yi * w * 4;
        var sind = x + (y + yi) * this.width;
        for (var xi = 0; xi < w; ++xi) {
            var alphaS = this.data[sind] * opacity;
            var tMult = 1.0 - alphaS;
            tData[ind] = (tData[ind] * tMult + color[0] * alphaS);
            tData[ind + 1] = (tData[ind + 1] * tMult + color[1] * alphaS);
            tData[ind + 2] = (tData[ind + 2] * tMult + color[2] * alphaS);
            ind += 4;
            ++sind;
        }
    }
};

/**
 * Clear the rasterizer's bitmap to all 0's.
 */
Rasterizer.prototype.clear = function() {
    var br = this.clipRect.getXYWHRoundedOut();
    for (var y = 0; y < br.h; ++y) {
        for (var x = 0; x < br.w; ++x) {
            this.data[br.x + x + (br.y + y) * this.width] = 0;
        }
    }
};

/**
 * Return the pixel at the given coordinates.
 * @param {Vec2} coords The coordinates to query with.
 * @return {number} The pixel value, in the range 0-1.
 */
Rasterizer.prototype.getPixel = function(coords) {
    return this.data[Math.floor(coords.x) + Math.floor(coords.y) * this.width];
};

/**
 * Fill a circle to the rasterizer's bitmap at the given coordinates. Uses the
 * soft, textureId and flowAlpha values set using beginCircles, and clips the circle to
 * the current clipping rectangle.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} flowAlpha The alpha value for rasterizing the circle.
 * @param {number} rotation Rotation of the circle texture in radians.
 */
Rasterizer.prototype.fillCircle = function(centerX, centerY, radius, flowAlpha, rotation) {
    if (!this.clipRect.mightIntersectCircleRoundedOut(centerX, centerY,
                                             this.drawBoundingRadius(radius))) {
        return;
    }
    var circleRect = Rect.fromCircle(centerX, centerY,
                                     this.drawBoundingRadius(radius));
    circleRect.intersectRectRoundedOut(this.clipRect);
    this.dirtyArea.unionRect(circleRect);
    // integer x and y coordinates that we use here correspond to pixel corners.
    // instead of correcting the x and y by 0.5 on each iteration,
    // compensate by moving the center.
    centerX -= 0.5;
    centerY -= 0.5;
    if (this.texturized) {
        if (rotation !== 0) {
            this.fillTexturizedCircleBlendingRotated(circleRect, centerX, centerY,
                                                     this.drawRadius(radius), this.circleAlpha(radius) * flowAlpha,
                                                     rotation);
        } else {
            this.fillTexturizedCircleBlending(circleRect, centerX, centerY,
                                              this.drawRadius(radius), this.circleAlpha(radius) * flowAlpha);
        }
    } else if (this.soft) {
        this.fillSoftCircleBlending(circleRect, centerX, centerY,
                                    this.drawRadius(radius), this.circleAlpha(radius) * flowAlpha);
    } else {
        this.fillCircleBlending(circleRect, centerX, centerY,
                                this.drawRadius(radius), this.circleAlpha(radius) * flowAlpha);
    }
};

/**
 * @param {number} radius Radius to draw with.
 * @return {number} Suitable lod for sampling the brush texture.
 * @protected
 */
Rasterizer.prototype.lodFromRadius = function(radius) {
    // 0.3 negative lod bias to improve quality a bit (brush textures are assumed to be slightly blurred)
    var lod = Math.round(Math.log(this.brushTex.levelWidths[0] + 1) / Math.log(2) -
                         Math.log(radius * 2) / Math.log(2) - 0.3);
    if (lod <= 0) {
        lod = 0;
    } else if (lod >= this.brushTex.levels.length - 1) {
        lod = this.brushTex.levels.length - 1;
    }
    return lod;
};

/**
 * Helper to rasterize a texturized circle.
 * @param {Rect} boundsRect The rect to rasterize to.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} alpha Alpha to draw with.
 * @protected
 */
Rasterizer.prototype.fillTexturizedCircleBlending = function(boundsRect, centerX, centerY, radius, alpha) {
    var rad2 = (radius + 1.0) * (radius + 1.0);
    var coordMult = 0.5 / radius;
    var lod = this.lodFromRadius(radius);
    var sIndStep = this.brushTex.getSIndStep(radius * 2, lod);
    for (var y = boundsRect.top; y < boundsRect.bottom; ++y) {
        var ind = boundsRect.left + y * this.width;
        var powy = Math.pow(y - centerY, 2);
        var t = (y - centerY) * coordMult + 0.5;
        var rowInd = this.brushTex.getRowInd(t, lod);
        var rowBelowWeight = this.brushTex.getRowBelowWeight(t, lod);
        var sInd = this.brushTex.getSInd((boundsRect.left - centerX) * coordMult + 0.5, lod);
        for (var x = boundsRect.left; x < boundsRect.right; ++x) {
            var dist2 = Math.pow(x - centerX, 2) + powy;
            if (dist2 < rad2) {
                // Trilinear interpolation is too expensive, so do bilinear.
                var texValue = this.brushTex.sampleUnsafe(sInd, rowInd, rowBelowWeight, lod);
                if (dist2 > (radius - 1.0) * (radius - 1.0)) {
                    // hacky antialias
                    var mult = (radius + 1.0 - Math.sqrt(dist2)) * 0.5;
                    this.data[ind] = alpha * mult * texValue + this.data[ind] *
                                     (1.0 - alpha * mult * texValue);
                } else {
                    this.data[ind] = alpha * texValue + this.data[ind] * (1.0 - alpha * texValue);
                }
            }
            ++ind;
            sInd += sIndStep;
        }
    }
};


/**
 * Helper to rasterize a rotated texturized circle.
 * @param {Rect} boundsRect The rect to rasterize to.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} alpha Alpha to draw with.
 * @param {number} rotation Angle in radians to rotate the texture.
 * @protected
 */
Rasterizer.prototype.fillTexturizedCircleBlendingRotated = function(boundsRect, centerX, centerY, radius, alpha,
                                                                    rotation) {
    var rad2 = (radius + 1.0) * (radius + 1.0);
    var coordMult = 0.5 / radius;
    var lod = this.lodFromRadius(radius);
    for (var y = boundsRect.top; y < boundsRect.bottom; ++y) {
        var ind = boundsRect.left + y * this.width;
        var ydiff = y - centerY;
        var powy = Math.pow(ydiff, 2);
        for (var x = boundsRect.left; x < boundsRect.right; ++x) {
            var xdiff = x - centerX;
            var dist2 = Math.pow(x - centerX, 2) + powy;
            if (dist2 < rad2) {
                // Trilinear interpolation is too expensive, so do bilinear.
                var s = Math.cos(rotation) * xdiff * coordMult + Math.sin(rotation) * ydiff * coordMult + 0.5;
                var t = -Math.sin(rotation) * xdiff * coordMult + Math.cos(rotation) * ydiff * coordMult + 0.5;
                var texValue = this.brushTex.sampleFromLevel(s, t, lod);
                if (dist2 > (radius - 1.0) * (radius - 1.0)) {
                    // hacky antialias
                    var mult = (radius + 1.0 - Math.sqrt(dist2)) * 0.5;
                    this.data[ind] = alpha * mult * texValue + this.data[ind] *
                                     (1.0 - alpha * mult * texValue);
                } else {
                    this.data[ind] = alpha * texValue + this.data[ind] * (1.0 - alpha * texValue);
                }
            }
            ++ind;
        }
    }
};

/**
 * Helper to rasterize a solid circle.
 * @param {Rect} boundsRect The rect to rasterize to.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} alpha Alpha to draw with.
 * @protected
 */
Rasterizer.prototype.fillCircleBlending = function(boundsRect, centerX, centerY, radius, alpha) {
    var rad2 = (radius + 1.0) * (radius + 1.0);
    for (var y = boundsRect.top; y < boundsRect.bottom; ++y) {
        var ind = boundsRect.left + y * this.width;
        var powy = Math.pow(y - centerY, 2);
        for (var x = boundsRect.left; x < boundsRect.right; ++x) {
            var dist2 = Math.pow(x - centerX, 2) + powy;
            if (dist2 < rad2) {
                if (dist2 > (radius - 1.0) * (radius - 1.0)) {
                    // hacky antialias
                    var mult = (radius + 1.0 - Math.sqrt(dist2)) * 0.5;
                    this.data[ind] = alpha * mult + this.data[ind] *
                                     (1.0 - alpha * mult);
                } else {
                    this.data[ind] = alpha + this.data[ind] * (1.0 - alpha);
                }
            }
            ++ind;
        }
    }
};

/**
 * Helper to rasterize a soft circle.
 * @param {Rect} boundsRect The rect to rasterize to.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} alpha Alpha to draw with.
 * @protected
 */
Rasterizer.prototype.fillSoftCircleBlending = function(boundsRect, centerX, centerY, radius, alpha) {
    var rad2 = radius * radius;
    for (var y = boundsRect.top; y < boundsRect.bottom; ++y) {
        var ind = boundsRect.left + y * this.width;
        var powy = Math.pow(y - centerY, 2);
        for (var x = boundsRect.left; x < boundsRect.right; ++x) {
            var dist2 = Math.pow(x - centerX, 2) + powy;
            if (dist2 < rad2) {
                var distalpha = (1.0 - Math.sqrt(dist2 / rad2)) * alpha;
                if (dist2 > (radius - 1.0) * (radius - 1.0)) {
                    // hacky antialias
                    distalpha *= (radius + 1.0 - Math.sqrt(dist2)) * 0.5;
                }
                this.data[ind] = distalpha + this.data[ind] * (1.0 - distalpha);
            }
            ++ind;
        }
    }
};

/**
 * Draw a linear gradient from coords1 to coords0. The pixel at coords1 will be
 * set to 1.0, and the pixel at coords0 will be set to 0.0. If the coordinates
 * are the same, does nothing.
 * @param {Vec2} coords1 Coordinates for the 1.0 end of the gradient.
 * @param {Vec2} coords0 Coordinates for the 0.0 end of the gradient.
 */
Rasterizer.prototype.linearGradient = function(coords1, coords0) {
    var br = this.clipRect.getXYWHRoundedOut();
    if (coords1.x === coords0.x) {
        if (coords1.y === coords0.y) {
            return;
        }
        this.dirtyArea.unionRect(this.clipRect);
        // Every horizontal line will be of one color
        var top = Math.min(coords1.y, coords0.y);
        var bottom = Math.max(coords1.y, coords0.y);
        var topFill = (coords0.y < coords1.y) ? 0.0 : 1.0;
        var bottomFill = 1.0 - topFill;
        var y = br.y;
        var ind = y * this.width + br.x;
        var right = ind + br.w;
        while (y + 0.5 <= top && y < br.y + br.h) {
            ind = y * this.width + br.x;
            right = ind + br.w;
            while (ind < right) {
                this.data[ind] = topFill;
                ++ind;
            }
            ++y;
        }
        while (y + 0.5 < bottom && y < br.y + br.h) {
            // Take the gradient color at the pixel center.
            // TODO: Integrate coverage along y instead to anti-alias this.
            // TODO: assert(y + 0.5 > top && y + 0.5 < bottom);
            ind = y * this.width + br.x;
            right = ind + br.w;
            var rowFill = (coords0.y < coords1.y ?
                           (y + 0.5 - top) : (bottom - y - 0.5)) /
                          (bottom - top);
            while (ind < right) {
                this.data[ind] = rowFill;
                ++ind;
            }
            ++y;
        }
        while (y < br.y + br.h) {
            ind = y * this.width + br.x;
            right = ind + br.w;
            while (ind < right) {
                this.data[ind] = bottomFill;
                ++ind;
            }
            ++y;
        }
        return;
    } else {
        this.dirtyArea.unionRect(this.clipRect);
        var lineStartCoords = new Vec2(0, 0);
        var lineEndCoords = new Vec2(0, 0);
        for (var y = br.y; y < br.y + br.h; ++y) {
            // TODO: Again, integrating coverage over the pixel would be nice.
            lineStartCoords.x = 0.5;
            lineStartCoords.y = y + 0.5;
            lineEndCoords.x = this.width - 0.5;
            lineEndCoords.y = y + 0.5;
            lineStartCoords.projectToLine(coords0, coords1);
            lineEndCoords.projectToLine(coords0, coords1);
            var lineStartValue = (lineStartCoords.x - coords0.x) /
                                 (coords1.x - coords0.x);
            var lineEndValue = (lineEndCoords.x - coords0.x) /
                               (coords1.x - coords0.x);
            var x = br.x;
            var ind = y * this.width + x;
            var right = ind + br.w;
            while (ind < right) {
                var mult = (x / this.width);
                var unclamped = mult * lineEndValue +
                                (1.0 - mult) * lineStartValue;
                this.data[ind] = Math.max(0.0, Math.min(1.0, unclamped));
                ++ind;
                ++x;
            }
        }
    }
};


export {
    Rasterizer
};
