/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { BaseRasterizer } from './base_rasterizer.js';

import { GLDoubleBufferedRasterizer } from './gl_double_buffered_rasterizer.js';

import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import { glUtils } from '../gl/utilgl.js';

import { GLAlphaPackingFormat } from '../gl/gl_alpha_packing_format.js';

import {
    GLBrushTextures
} from '../brush_textures.js';

import { blitShader } from '../glsl/blit_shader.js';

import { GradientShaderGenerator } from '../glsl/gradient_shader.js';

import { RasterizeShaderGenerator } from '../glsl/rasterize_shader.js';

/**
 * A WebGL rasterizer using one RGBA Float32 buffer as backing for its bitmap.
 * In dynamic mode, uses a single uniform array to pass parameters to shaders,
 * and determines the amount of circles at shader run time. Floating point texture
 * support in the WebGL implementation is required.
 * @constructor
 * @extends {GLDoubleBufferedRasterizer}
 */
var GLFloatRasterizer = function() {};

GLFloatRasterizer.prototype = new GLDoubleBufferedRasterizer();

/**
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {GLStateManager} glManager
 * @param {number} width Width of the rasterizer bitmap in pixels.
 * @param {number} height Height of the rasterizer bitmap in pixels.
 * @param {GLBrushTextures} brushTextures Collection of brush tip textures to use.
 * @param {boolean} dynamic Whether to determine amount of circles to draw in a
 * single pass based on an uniform at shader run time.
 * @return {GLFloatRasterizer}
 */
GLFloatRasterizer.create = function(gl, glManager, width, height, brushTextures, dynamic) {
    var rast = new GLFloatRasterizer();
    rast.init(gl, glManager, width, height, brushTextures, dynamic);
    return rast;
};

var floatLinearGradientShaderGenerator = new GradientShaderGenerator(GLAlphaPackingFormat.alpha);

/**
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {GLStateManager} glManager
 * @param {number} width Width of the rasterizer bitmap in pixels.
 * @param {number} height Height of the rasterizer bitmap in pixels.
 * @param {GLBrushTextures} brushTextures Collection of brush tip textures to use.
 * @param {boolean} dynamic Whether to determine amount of circles to draw in a
 * single pass based on an uniform at shader run time.
 */
GLFloatRasterizer.prototype.init = function(gl, glManager, width, height, brushTextures, dynamic) {
    if (dynamic === undefined) {
        dynamic = false;
    }

    this.initBaseRasterizer(width, height, brushTextures);

    this.dynamic = dynamic;

    var maxCircles = GLFloatRasterizer.maxCircles;
    if (this.dynamic) {
        maxCircles = GLFloatRasterizer.dynamicMaxCircles;
    }
    this.initGLRasterizer(gl, glManager, GLAlphaPackingFormat.alpha, maxCircles);
    this.tex = glUtils.createTexture(gl, width, height, this.gl.RGBA, this.gl.FLOAT);

    if (this.dynamic) {
        var shaderGen = new RasterizeShaderGenerator(GLAlphaPackingFormat.alpha, true, false);
        shaderGen.circles = GLFloatRasterizer.dynamicMaxCircles;

        shaderGen.soft = false;
        shaderGen.texturized = false;
        this.fillCircleProgram = this.glManager.shaderProgram(shaderGen.programParameters());

        shaderGen.soft = true;
        this.softCircleProgram = this.glManager.shaderProgram(shaderGen.programParameters());

        // The uniforms are the same for the soft and fill shaders
        this.fillUniformParameters = shaderGen.uniformParameters(width, height);

        shaderGen.soft = false;
        shaderGen.texturized = true;
        this.texCircleProgram = this.glManager.shaderProgram(shaderGen.programParameters());

        this.texUniformParameters = shaderGen.uniformParameters(width, height);
        this.fillUniformParameters['uCircle'] = this.params;
        // Note: paramsB not needed for fill shader at the moment, might be needed if more parameters are added.
        //this.fillUniformParameters['uCircleB'] = this.paramsB;
        this.texUniformParameters['uCircle'] = this.params;
        this.texUniformParameters['uCircleB'] = this.paramsB;
    } else {
        var shaderGen = new RasterizeShaderGenerator(GLAlphaPackingFormat.alpha, false, true);
        this.generateCircleShaderPrograms(shaderGen, GLFloatRasterizer.maxCircles);
    }

    this.linearGradientProgram = this.glManager.shaderProgram(floatLinearGradientShaderGenerator.programParameters());
    this.gradientUniformParameters = floatLinearGradientShaderGenerator.uniformParameters(this.width, this.height);

    this.convUniformParameters = new blitShader.ConversionUniformParameters();
    this.conversionProgram =
        this.glManager.shaderProgram({
            fragmentSource: blitShader.convertSimpleSrc,
            vertexSource: blitShader.blitVertSrc,
            uniformTypes: {'uSrcTex': 'tex2d', 'uColor': '4fv'},
            attributeLocations: { 'aVertexPosition': 0 }
        });
};


/** @const */
GLFloatRasterizer.maxCircles = 7;

/** @const */
GLFloatRasterizer.dynamicMaxCircles = 32;

/**
 * @return {number} The GPU memory usage of this rasterizer in bytes.
 */
GLFloatRasterizer.prototype.getMemoryBytes = function() {
    return this.width * this.height * 16;
};

/**
 * Clean up any allocated resources. The rasterizer is not usable after this.
 */
GLFloatRasterizer.prototype.free = function() {
    this.gl.deleteTexture(this.tex);
    this.tex = undefined;
};

/**
 * Get the source texture that contains the most up-to-date contents of the
 * rasterizer bitmap.
 * @return {WebGLTexture} The source texture.
 */
GLFloatRasterizer.prototype.getTex = function() {
    return this.tex;
};

/**
 * Get rectangular bounds for a draw pass.
 * @param {Rect} invalRect Rectangle containing the things to draw. This is
 * combined with the target texture's invalidated area and clipped by the
 * current clip rect. The function is allowed to mutate this Rect.
 * @return {Rect} The bounds for the draw pass.
 */
GLFloatRasterizer.prototype.getDrawRect = function(invalRect) {
    invalRect.intersectRectRoundedOut(this.clipRect);
    return invalRect;
};

/**
 * Set the framebuffer, flow alpha and brush texture for drawing.
 * @param {Object.<string, *>} uniformParameters Map from uniform names to
 * uniform values to set drawing parameters to.
 * @protected
 */
GLFloatRasterizer.prototype.preDraw = function(uniformParameters) {
    this.gl.viewport(0, 0, this.width, this.height);
    this.glManager.useFboTex(this.tex);
    if (uniformParameters !== null) {
        if (this.texturized) {
            uniformParameters['uBrushTex'] = this.brushTex;
        }
    }
};

/**
 * Post-draw callback required for using GLDoubleBufferedRasterizer's
 * linearGradient.
 * @param {Rect} invalRect The area that has been changed in the target texture.
 * @protected
 */
GLFloatRasterizer.prototype.postDraw = function(invalRect) {
};

/**
 * Clear the rasterizer's bitmap to all 0's.
 */
GLFloatRasterizer.prototype.clear = function() {
    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clearColor(0, 0, 0, 0);
    glUtils.updateClip(this.gl, this.clipRect, this.height);
    this.glManager.useFboTex(this.tex);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
};

/** @inheritDoc */
GLFloatRasterizer.prototype.flushCircles = function() {
    if (this.circleInd === 0) {
        return;
    }

    var uniformParameters = this.texturized ? this.texUniformParameters : this.fillUniformParameters;
    var circleCount = this.circleInd;
    this.circleRect.intersectRectRoundedOut(this.clipRect);
    glUtils.updateClip(this.gl, this.circleRect, this.height);
    if (this.dynamic) {
        this.preDraw(uniformParameters);
        // Circle parameters are already assigned to the array referenced in uniformParameters.
        uniformParameters['uCircleCount'] = this.circleInd;
        if (this.texturized) {
            this.glManager.drawFullscreenQuad(this.texCircleProgram, uniformParameters);
        } else if (this.soft) {
            this.glManager.drawFullscreenQuad(this.softCircleProgram, uniformParameters);
        } else {
            this.glManager.drawFullscreenQuad(this.fillCircleProgram, uniformParameters);
        }
    } else {
        this.preDraw(uniformParameters[circleCount - 1]);
        for (var i = 0; i < circleCount; ++i) {
            for (var j = 0; j < 4; ++j) {
                uniformParameters[circleCount - 1]['uCircle' + i][j] = this.params[i * this.paramsStride + j];
            }
            if (this.texturized) {
                uniformParameters[circleCount - 1]['uCircleB' + i][0] = this.paramsB[i * this.paramsStride];
            }
        }
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
    }

    this.dirtyArea.unionRect(this.circleRect);
    this.circleRect.makeEmpty();
    this.circleInd = 0;
};

/** @inheritDoc */
GLFloatRasterizer.prototype.getPixel = function(coords) {
    var left = Math.floor(coords.x);
    var top = Math.floor(coords.y);
    this.glManager.useFboTex(this.getTex());
    var pixel = new Float32Array([0, 0, 0, 0]);
    this.gl.readPixels(left, this.height - 1 - top, 1, 1, this.gl.RGBA, this.gl.FLOAT, pixel);
    return pixel[3];
};

export {
    GLFloatRasterizer
};
