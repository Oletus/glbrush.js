/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

/**
 * A shader program for drawing a gradient.
 * @constructor
 * @param {GLRasterizerFormat} format Format of the rasterizer's backing.
 * Affects whether to blend with a UINT8 source texture or a floating point
 * framebuffer.
 * @param {boolean} vertical Whether the shader draws only vertical gradients or
 * non-vertical gradients.
 */
var GradientShader = function(format, vertical) {
    this.format = format;
    this.vertical = vertical;
    this.initShaderGenerator();
};

GradientShader.prototype = new ShaderGenerator();


/**
 * Computes the uniforms used in the shader program.
 * @param {number=} width Width of the canvas in pixels. Defaults to 1.
 * @param {number=} height Height of the canvas in pixels. Defaults to 1.
 * @return {Array.<Object>} An array of uniforms with name, type, shortType
 * (postfix to gl.uniform*), inVertex (whether it's used in vertex shader),
 * inFragment (whether it's used in fragment shader), defaultValue, arraySize
 * (how many items in the uniform array).
 */
GradientShader.prototype.uniforms = function(width, height) {
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
GradientShader.prototype.varyingSource = function() {
    var src = [];
    /*if (this.format === GLRasterizerFormat.redGreen) {
        src.push('varying vec2 vSrcTexCoord;');
    }*/
    //src.push('varying vec2 vPixelCoords; // in pixels');
    src.push('varying float vGradientValue;');
    return src;
};

/**
 * @return {string} Vertex shader source.
 */
GradientShader.prototype.vertexSource = function() {
    var src = [];
    src.push('attribute vec2 aVertexPosition; ' +
             '// expecting a vertex array with corners at ' +
             '-1 and 1 x and y coordinates');
    src.push.apply(src, this.varyingSource());
    src.push.apply(src, this.vertexUniformSource());
    src.push('void main(void) {');
    if (this.vertical) {
        src.push('  vGradientValue = ((aVertexPosition.y + 1.0) * ' +
                 'uPixels.y - uCoords0.y) / (uCoords1.y - uCoords0.y);');
    } else {
        src.push('  vec2 projected = (aVertexPosition + vec2(1.0, 1.0)) * ' +
                 'uPixels;');
        src.push('  float lineSlope = (uCoords1.y - uCoords0.y) / ' +
                 '(uCoords1.x - uCoords0.x);');
        src.push('  float lineYAtZero = uCoords0.y - lineSlope * uCoords0.x;');
        src.push('  vec2 perpVector = vec2(1.0, -1.0 / lineSlope);');
        src.push('  perpVector = normalize(perpVector);');
        src.push('  float perpProjLength = perpVector.y * (projected.y - ' +
                 '(lineSlope * projected.x + lineYAtZero));');
        src.push('  projected.x -= perpVector.x * perpProjLength;');
        src.push('  vGradientValue = (projected.x - uCoords0.x) / ' +
                 '(uCoords1.x - uCoords0.x);');
    }
    src.push('  gl_Position = vec4(aVertexPosition, 0.0, 1.0);');
    src.push('}'); // void main(void)
    return src.join('\n');
};

/**
 * @return {string} Fragment shader source.
 */
GradientShader.prototype.fragmentSource = function() {
    var src = ['precision highp float;'];
    src.push.apply(src, this.varyingSource());
    src.push.apply(src, this.vertexUniformSource());
    src.push('void main(void) {');
    if (this.format === GLRasterizerFormat.redGreen) {
        // NOTE: No blending done here.
        src.push('  int bytes = int(clamp(vGradientValue, 0.0, 1.0) * ' +
                 '255.0 * 256.0);');
        src.push('  int highByte = bytes / 256;');
        src.push('  int lowByte = bytes - highByte * 256;');
        src.push('  gl_FragColor = vec4(float(highByte) / 255.0, ' +
                 'float(lowByte) / 255.0, 0.0, 1.0);');
    } else {
        src.push('  gl_FragColor = vec4(0, 0, 0, ' +
                 'clamp(vGradientValue, 0.0, 1.0));');
    }
    src.push('}'); // void main(void)
    return src.join('\n');
};
