/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { BaseRasterizer } from './base_rasterizer.js';

import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import { glUtils } from '../gl/utilgl.js';

import { glStateManager } from '../gl/gl_state_manager.js';

import { GLAlphaPackingFormat } from '../gl/gl_alpha_packing_format.js';

import {
    GLBrushTextures
} from '../brush_textures.js';

import { blitShader } from '../glsl/blit_shader.js';

import { GradientShaderGenerator } from '../glsl/gradient_shader.js';

import { RasterizeShaderGenerator } from '../glsl/rasterize_shader.js';

/**
 * A WebGL rasterizer using two RGB Uint8 buffers as backing for its bitmap.
 * Floating point support in the WebGL implementation is not required.
 * @constructor
 * @extends {BaseRasterizer}
 */
var GLDoubleBufferedRasterizer = function() {};

GLDoubleBufferedRasterizer.prototype = new BaseRasterizer();

/**
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {number} width Width of the rasterizer bitmap in pixels.
 * @param {number} height Height of the rasterizer bitmap in pixels.
 * @param {GLBrushTextures} brushTextures Collection of brush tip textures to use.
 * @return {GLDoubleBufferedRasterizer}
 */
GLDoubleBufferedRasterizer.create = function(gl, glManager, width, height, brushTextures) {
    var rast = new GLDoubleBufferedRasterizer();
    rast.init(gl, glManager, width, height, brushTextures);
    return rast;
};

var doubleBufferedLinearGradientShaderGenerator = new GradientShaderGenerator(GLAlphaPackingFormat.redGreen);

/**
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {number} width Width of the rasterizer bitmap in pixels.
 * @param {number} height Height of the rasterizer bitmap in pixels.
 * @param {GLBrushTextures} brushTextures Collection of brush tip textures to use.
 */
GLDoubleBufferedRasterizer.prototype.init = function(gl, glManager, width, height, brushTextures) {
    this.initBaseRasterizer(width, height, brushTextures);
    this.initGLRasterizer(gl, glManager, GLAlphaPackingFormat.redGreen,
                          GLDoubleBufferedRasterizer.maxCircles);
    // TODO: Move to gl.RG if EXT_texture_RG becomes available in WebGL
    this.tex0 = glUtils.createTexture(gl, width, height, gl.RGB);
    this.tex1 = glUtils.createTexture(gl, width, height, gl.RGB);
    this.tex0Inval = new Rect();
    this.tex1Inval = new Rect();
    this.currentTex = 0;

    var shaderGen = new RasterizeShaderGenerator(GLAlphaPackingFormat.redGreen, false, true);
    this.generateCircleShaderPrograms(shaderGen, GLDoubleBufferedRasterizer.maxCircles);

    this.linearGradientProgram =
        this.glManager.shaderProgram(doubleBufferedLinearGradientShaderGenerator.programParameters());
    this.gradientUniformParameters = doubleBufferedLinearGradientShaderGenerator.uniformParameters(this.width, this.height);

    this.convUniformParameters = new blitShader.ConversionUniformParameters();
    this.conversionProgram = this.glManager.shaderProgram({
        fragmentSource: blitShader.convertRedGreenSrc,
        vertexSource: blitShader.blitVertSrc,
        uniformTypes: {'uSrcTex': 'tex2d', 'uColor': '4fv'},
        attributeLocations: { 'aVertexPosition': 0 }
    });
};

/** @const */
GLDoubleBufferedRasterizer.maxCircles = 7;

/**
 * @return {number} The GPU memory usage of this rasterizer in bytes.
 */
GLDoubleBufferedRasterizer.prototype.getMemoryBytes = function() {
    return this.width * this.height * 6;
};

/**
 * Initialize the WebGL-based rasterizer.
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {GLAlphaPackingFormat} format Format of the rasterizers texture.
 * @param {number} maxCircles The maximum amount of circles to render in one
 * pass. Must be an integer > 0.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.initGLRasterizer = function(gl, glManager, format, maxCircles) {
    this.gl = gl;
    this.glManager = glManager;
    this.format = format;

    this.paramsStride = 4;
    this.maxCircles = maxCircles;

    // 4 bytes per float

    // 1st params buffer contains x, y, radius and alpha of each circle (set in fillCircle).
    var paramBuffer = new ArrayBuffer(this.maxCircles *
                                      this.paramsStride * 4);
    this.params = new Float32Array(paramBuffer);

    // 2nd params buffer contains angle of each circle (set in fillCircle).
    var paramBufferB = new ArrayBuffer(this.maxCircles *
                                       this.paramsStride * 4);
    this.paramsB = new Float32Array(paramBufferB);
    this.circleRect = new Rect();
    this.circleInd = 0;

    this.brushTex = null;
};

/**
 * Generate shader programs for a WebGL-based rasterizer.
 * @param {number} numPrograms Number of shader programs to generate for different circle counts.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.generateCircleShaderPrograms = function(shaderGen, maxCircles) {
    shaderGen.dynamicCircles = false;
    shaderGen.unroll = true;

    this.nFillCircleProgram = [];
    this.nSoftCircleProgram = [];
    this.nTexCircleProgram = [];
    this.fillUniformParameters = [];
    this.texUniformParameters = [];

    for (var i = 1; i <= maxCircles; ++i) {
        shaderGen.circles = i;
        shaderGen.soft = false;
        shaderGen.texturized = false;
        this.nFillCircleProgram.push(this.glManager.shaderProgram(shaderGen.programParameters()));
        shaderGen.soft = true;
        this.nSoftCircleProgram.push(this.glManager.shaderProgram(shaderGen.programParameters()));

        // The uniforms are the same for the soft and fill shaders
        this.fillUniformParameters.push(shaderGen.uniformParameters(this.width, this.height));

        shaderGen.soft = false;
        shaderGen.texturized = true;
        this.nTexCircleProgram.push(this.glManager.shaderProgram(shaderGen.programParameters()));
        this.texUniformParameters.push(shaderGen.uniformParameters(this.width, this.height));
    }
};

/**
 * Clean up any allocated resources. The rasterizer is not usable after this.
 */
GLDoubleBufferedRasterizer.prototype.free = function() {
    this.gl.deleteTexture(this.tex0);
    this.gl.deleteTexture(this.tex1);
    this.tex0 = undefined;
    this.tex1 = undefined;
};

/**
 * Switch between textures.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.switchTex = function() {
    this.currentTex = 1 - this.currentTex;
};

/**
 * Get the source texture that contains the most up-to-date contents of the
 * rasterizer bitmap.
 * @return {WebGLTexture} The source texture.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.getTex = function() {
    if (this.currentTex === 0) {
        return this.tex0;
    } else {
        return this.tex1;
    }
};

/**
 * Draw the rasterizer's contents to the current framebuffer. To be used for testing only.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 */
GLDoubleBufferedRasterizer.prototype.drawWithColor = function(color, opacity) {
    this.convUniformParameters['uSrcTex'] = this.getTex();
    for (var i = 0; i < 3; ++i) {
        this.convUniformParameters['uColor'][i] = color[i] / 255.0;
    }
    this.convUniformParameters['uColor'][3] = opacity;
    this.glManager.drawFullscreenQuad(this.conversionProgram,
                                      this.convUniformParameters);
};

/**
 * Get the target texture for rasterization.
 * @return {WebGLTexture} The target texture.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.getTargetTex = function() {
    if (this.currentTex === 0) {
        return this.tex1;
    } else {
        return this.tex0;
    }
};

/**
 * Clear the target texture's invalid area after drawing.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.clearTargetInval = function() {
    if (this.currentTex === 0) {
        this.tex1Inval.makeEmpty();
    } else {
        this.tex0Inval.makeEmpty();
    }
};

/**
 * Clear the rasterizer's bitmap (both textures) to all 0's.
 */
GLDoubleBufferedRasterizer.prototype.clear = function() {
    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clearColor(0, 0, 0, 0);
    glUtils.updateClip(this.gl, this.clipRect, this.height);
    for (var i = 0; i < 2; ++i) {
        this.glManager.useFboTex(this.getTargetTex());
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.clearTargetInval();
        this.switchTex();
    }
};

/**
 * Get rectangular bounds for a draw pass.
 * @param {Rect} invalRect Rectangle containing the things to draw. This is
 * combined with the target texture's invalidated area and clipped by the
 * current clip rect. The function is allowed to mutate this Rect.
 * @return {Rect} The bounds for the draw pass.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.getDrawRect = function(invalRect) {
    var drawRect = (this.currentTex === 0) ? this.tex1Inval : this.tex0Inval;
    drawRect.unionRect(invalRect);
    drawRect.intersectRectRoundedOut(this.clipRect);
    return drawRect;
};

/**
 * Set the framebuffer, flow alpha, source texture and brush texture for drawing.
 * @param {Object.<string, *>} uniformParameters Map from uniform names to
 * uniform values to set drawing parameters to.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.preDraw = function(uniformParameters) {
    this.gl.viewport(0, 0, this.width, this.height);
    this.glManager.useFboTex(this.getTargetTex());
    if (uniformParameters !== null) {
        uniformParameters['uSrcTex'] = this.getTex();
        if (this.texturized) {
            uniformParameters['uBrushTex'] = this.brushTex;
        }
    }
};

/**
 * Invalidate the area of the source texture which has now been updated in the
 * target texture, and switch textures.
 * @param {Rect} invalRect The area that has been changed in the target texture.
 * @protected
 */
GLDoubleBufferedRasterizer.prototype.postDraw = function(invalRect) {
    this.clearTargetInval();
    if (this.currentTex === 0) {
        this.tex0Inval.unionRect(invalRect);
    } else {
        this.tex1Inval.unionRect(invalRect);
    }
    this.switchTex();
};

/**
 * Fill a circle to the rasterizer's bitmap at the given coordinates. Uses the
 * soft, textureId and flowAlpha values set using beginCircles, and clips the circle to
 * the current clipping rectangle. The circle is added to the queue, which is
 * automatically flushed when it's full. Flushing manually should be done at the
 * end of drawing circles.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} flowAlpha The alpha value for rasterizing the circle.
 * @param {number} rotation Rotation of the circle texture in radians.
 */
GLDoubleBufferedRasterizer.prototype.fillCircle = function(centerX, centerY, radius, flowAlpha, rotation) {
    this.circleRect.unionCircle(centerX, centerY,
                                this.drawBoundingRadius(radius));
    this.params[this.circleInd * this.paramsStride] = centerX;
    this.params[this.circleInd * this.paramsStride + 1] = centerY;
    this.params[this.circleInd * this.paramsStride + 2] = radius;
    this.params[this.circleInd * this.paramsStride + 3] = flowAlpha;

    this.paramsB[this.circleInd * this.paramsStride] = rotation;
    this.circleInd++;
    if (this.circleInd >= this.maxCircles) {
        // TODO: assert(this.circleInd === this.maxCircles);
        this.flushCircles();
    }
};

/**
 * Flush all circle drawing commands that have been given to the bitmap.
 */
GLDoubleBufferedRasterizer.prototype.flushCircles = function() {
    if (this.circleInd === 0) {
        return;
    }
    var drawRect = this.getDrawRect(this.circleRect); // may change circleRect!
    var circleCount = this.circleInd;
    var uniformParameters = this.texturized ? this.texUniformParameters : this.fillUniformParameters;
    this.preDraw(uniformParameters[circleCount - 1]);
    for (var i = 0; i < circleCount; ++i) {
        for (var j = 0; j < 4; ++j) {
            uniformParameters[circleCount - 1]['uCircle' + i][j] = this.params[i * this.paramsStride + j];
        }
        if (this.texturized) {
            uniformParameters[circleCount - 1]['uCircleB' + i][0] = this.paramsB[i * this.paramsStride];
        }
    }
    glUtils.updateClip(this.gl, drawRect, this.height);
    if (this.texturized) {
        this.glManager.drawFullscreenQuad(this.nTexCircleProgram[circleCount - 1],
                                          uniformParameters[circleCount - 1]);
    } else if (this.soft) {
        this.glManager.drawFullscreenQuad(this.nSoftCircleProgram[circleCount - 1],
                                          uniformParameters[circleCount - 1]);
    } else {
        this.glManager.drawFullscreenQuad(this.nFillCircleProgram[circleCount - 1],
                                          uniformParameters[circleCount - 1]);
    }
    this.dirtyArea.unionRect(drawRect);
    this.postDraw(this.circleRect);
    this.circleRect.makeEmpty();
    this.circleInd = 0;
};

/**
 * Draw a linear gradient from coords1 to coords0. The pixel at coords1 will be
 * set to 1.0, and the pixel at coords0 will be set to 0.0. If the coordinates
 * are the same, does nothing.
 * @param {Vec2} coords1 Coordinates for the 1.0 end of the gradient.
 * @param {Vec2} coords0 Coordinates for the 0.0 end of the gradient.
 */
GLDoubleBufferedRasterizer.prototype.linearGradient = function(coords1,
                                                               coords0) {
    if (coords1.x === coords0.x && coords1.y === coords0.y) {
        return;
    }
    this.dirtyArea.unionRect(this.clipRect);
    this.preDraw(null);
    var drawRect = new Rect(0, this.width, 0, this.height);
    drawRect.intersectRectRoundedOut(this.clipRect);
    glUtils.updateClip(this.gl, drawRect, this.height);
    this.gradientUniformParameters['uCoords0'][0] = coords0.x;
    this.gradientUniformParameters['uCoords0'][1] = this.height - coords0.y;
    this.gradientUniformParameters['uCoords1'][0] = coords1.x;
    this.gradientUniformParameters['uCoords1'][1] = this.height - coords1.y;
    this.glManager.drawFullscreenQuad(this.linearGradientProgram, this.gradientUniformParameters);
    this.postDraw(drawRect);
};

/**
 * Return the pixel at the given coordinates.
 * @param {Vec2} coords The coordinates to query with.
 * @return {number} The pixel value, in the range 0-1.
 */
GLDoubleBufferedRasterizer.prototype.getPixel = function(coords) {
    var left = Math.floor(coords.x);
    var top = Math.floor(coords.y);
    this.glManager.useFboTex(this.getTex());
    var pixel = new Uint8Array([0, 0, 0, 0]);
    this.gl.readPixels(left, this.height - 1 - top, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel);
    return (pixel[0] + pixel[1] / 256.0) / 255.0;
};

export {
    GLDoubleBufferedRasterizer
};
