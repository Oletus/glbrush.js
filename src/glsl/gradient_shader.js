/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

import { GLAlphaPackingFormat } from '../gl/gl_alpha_packing_format.js';

import { ShaderGenerator } from './shader_generator.js';

/**
 * A shader program for drawing a gradient.
 * @constructor
 * @param {GLAlphaPackingFormat} format Format of the rasterizer's backing.
 * Affects whether to blend with a UINT8 source texture or a floating point
 * framebuffer.
 */
var GradientShaderGenerator = function(format) {
    this.format = format;
};

GradientShaderGenerator.prototype = new ShaderGenerator();


/**
 * Computes the uniforms used in the shader program.
 * @param {number=} width Width of the canvas in pixels. Defaults to 1.
 * @param {number=} height Height of the canvas in pixels. Defaults to 1.
 * @return {Array.<Object>} An array of uniforms with name, type, shortType
 * (postfix to gl.uniform*), inVertex (whether it's used in vertex shader),
 * inFragment (whether it's used in fragment shader), defaultValue, arraySize
 * (how many items in the uniform array).
 */
GradientShaderGenerator.prototype.uniforms = function(width, height) {
    var i;
    if (width === undefined || height === undefined) {
        width = 1.0;
        height = 1.0;
    }
    var us = [];
    us.push({name: 'uCoords0', type: 'vec2', shortType: '2fv',
             inFragment: false, inVertex: true, defaultValue: [0, 0],
             comment: 'in absolute pixels'});
    us.push({name: 'uCoords1', type: 'vec2', shortType: '2fv',
             inFragment: false, inVertex: true, defaultValue: [width, height],
             comment: 'in absolute pixels, y increases towards the top'});
    us.push({name: 'uPixels', type: 'vec2', shortType: '2fv',
             inFragment: false, inVertex: true,
             defaultValue: [width * 0.5, height * 0.5],
             comment: 'half of the dimensions in absolute pixels'});
    return us;
};

/**
 * Computes the varying definition code for both vertex and fragment shader.
 * @return {Array<string>} Shader source code lines.
 */
GradientShaderGenerator.prototype.varyingSource = function() {
    return 'varying float vGradientValue;';
};

/**
 * @return {string} Vertex shader source.
 */
GradientShaderGenerator.prototype.vertexSource = function() {
    return `
    attribute vec2 aVertexPosition; // expecting a vertex array with corners at -1 and 1 x and y coordinates
    ${ this.varyingSource() }
    ${ this.vertexUniformSource().join('\n') }
    void main(void) {
      vec2 projected = (aVertexPosition + vec2(1.0, 1.0)) * uPixels;
      vec2 projectionTarget = (uCoords1 - uCoords0);
      projected -= uCoords0;
      float projectionLength = dot(projected, normalize(projectionTarget));
      vGradientValue = projectionLength / length(projectionTarget);
      gl_Position = vec4(aVertexPosition, 0.0, 1.0);
    }`;
};

/**
 * @return {string} Fragment shader source.
 */
GradientShaderGenerator.prototype.fragmentSource = function() {
    var src = `
    precision highp float;
    ${ ShaderGenerator.commonGLSLHelpers }
    ${ this.varyingSource() }
    ${ this.vertexUniformSource().join('\n') }
    void main(void) {
`;
    if (this.format === GLAlphaPackingFormat.redGreen) {
        // NOTE: No blending done here.
        src += '      gl_FragColor = packNormFloatToRG(clamp(vGradientValue, 0.0, 1.0));\n';
    } else {
        src += '      gl_FragColor = vec4(0, 0, 0, clamp(vGradientValue, 0.0, 1.0));\n';
    }
    src += '}';  // void main(void)
    return src;
};

export { GradientShaderGenerator };