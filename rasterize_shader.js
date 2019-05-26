/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

import { glUtils } from './utilgl.js';

import { GLRasterizerFormat } from './rasterize.js';

import { ShaderGenerator } from './shader_generator.js';

/**
 * A shader program for blending together a bunch of monochrome circles.
 * @constructor
 * @param {GLRasterizerFormat} format Format of the rasterizer's backing.
 * Affects whether to blend with a UINT8 source texture or a floating point
 * framebuffer.
 * @param {boolean} soft Use soft brush.
 * @param {boolean} texturized True if circles are texturized. Overrides the soft parameter.
 * @param {number} circles Amount of circles to draw in a single pass.
 * @param {boolean} dynamicCircles The amount of circles drawn in a single pass
 * can be set at run-time using an uniform.
 * @param {boolean=} unroll Unroll the loop. True by default.
 */
var RasterizeShaderGenerator = function(fbFormat, soft, texturized, circles, dynamicCircles, unroll) {
    if (unroll === undefined) {
        unroll = true;
    }
    if (circles + 4 > glUtils.maxUniformVectors) {
        console.log('Invalid RasterizeShaderGenerator requested! Too many circles.');
        return;
    }
    this.fbFormat = fbFormat;
    this.doubleBuffered = (fbFormat === GLRasterizerFormat.redGreen);
    this.soft = soft;
    this.circles = circles;
    this.dynamicCircles = dynamicCircles;
    this.texturized = texturized;
    this.unroll = unroll;
};

RasterizeShaderGenerator.prototype = new ShaderGenerator();

/**
 * Computes the uniforms used in the shader program.
 * @param {number=} width Width of the canvas in pixels. Defaults to 1.
 * @param {number=} height Height of the canvas in pixels. Defaults to 1.
 * @return {Array.<Object>} An array of uniforms with name, type, shortType
 * (postfix to gl.uniform*), inVertex (whether it's used in vertex shader),
 * inFragment (whether it's used in fragment shader), defaultValue, arraySize
 * (how many items in the uniform array).
 */
RasterizeShaderGenerator.prototype.uniforms = function(width, height) {
    var i;
    if (width === undefined || height === undefined) {
        width = 1.0;
        height = 1.0;
    }
    var us = [];
    if (this.doubleBuffered) {
        us.push({name: 'uSrcTex', type: 'sampler2D', shortType: 'tex2d',
                 inFragment: true, inVertex: false, defaultValue: null});
    }
    if (this.dynamicCircles) {
        us.push({name: 'uCircleCount', type: 'int', shortType: '1i',
                 inFragment: true, inVertex: true, defaultValue: 1});
    }
    if (this.unroll) {
        for (i = 0; i < this.circles; ++i) {
            us.push({name: 'uCircle' + i, type: 'vec4', shortType: '4fv',
                     inFragment: true, inVertex: false,
                     defaultValue: [0.0, 0.0, 1.0, 1.0],
                     comment: 'x, y coords in pixel space, radius in pixels, flowAlpha from 0 to 1'});
            if (this.texturized) {
                us.push({name: 'uCircleB' + i, type: 'vec4', shortType: '4fv',
                         inFragment: true, inVertex: false,
                         defaultValue: [0.0, 0.0, 0.0, 0.0],
                         comment: 'rotation in radians'});
            }
        }
    } else {
        var def = [];
        for (i = 0; i < this.circles; ++i) {
            def.push(0.0, 0.0, 1.0, 1.0);
        }
        us.push({name: 'uCircle', type: 'vec4', arraySize: this.circles,
                 shortType: '4fv', inFragment: true, inVertex: false,
                 defaultValue: def,
                 comment: 'x, y coords in pixel space, radius in pixels, flowAlpha from 0 to 1'});
        if (this.texturized) {
            us.push({name: 'uCircleB', type: 'vec4', arraySize: this.circles,
                     shortType: '4fv', inFragment: true, inVertex: false,
                     defaultValue: def,
                     comment: 'rotation in radians'});
        }
    }
    us.push({name: 'uPixelPitch', type: 'vec2', shortType: '2fv',
             inFragment: false, inVertex: true,
             defaultValue: [2.0 / width, 2.0 / height],
             comment: 'in gl viewport space'});
    if (this.texturized) {
        us.push({name: 'uBrushTex', type: 'sampler2D', shortType: 'tex2d',
                 inFragment: true, inVertex: false, defaultValue: null});
    }
    return us;
};

/**
 * Computes the varying definition code for both vertex and fragment shader.
 * @return {Array<string>} Shader source code lines.
 */
RasterizeShaderGenerator.prototype.varyingSource = function() {
    var src = 'varying vec2 vPixelCoords; // in pixels\n';
    if (this.doubleBuffered) {
        src += 'varying vec2 vSrcTexCoord;\n';
    }
    return src;
};

/**
 * Computes the minimum circle radius for rasterization purposes.
 * @return {number} Minimum circle radius.
 */
RasterizeShaderGenerator.prototype.minRadius = function() {
    return (!this.texturized && this.soft) ? 1.0 : 0.5;
};

/**
 * Generates fragment shader source that calculates alpha for a single circle.
 * @param {string} assignTo The variable name where the result is assigned.
 * @param {string} indent Prefix for each line, intended for indentation.
 * @return {Array<string>} Shader source code lines.
 */
RasterizeShaderGenerator.prototype.fragmentAlphaSource = function(assignTo, indent) {
    // Generated shader assumes that:
    // 1. circleRadius contains the intended perceived radius of the circle.
    // 1. circleFlowAlpha contains the intended perceived alpha of the circle.
    // 2. centerDist contains the fragment's distance from the circle center.
    var src = `
float radius = max(circleRadius, ${ this.minRadius().toFixed(1) });
float flowAlpha = (circleRadius < ${ this.minRadius().toFixed(1) }) ?
  circleFlowAlpha * circleRadius * circleRadius * ${ Math.pow(1.0 / this.minRadius(), 2).toFixed(1) } :
  circleFlowAlpha;
float antialiasMult = clamp((radius + 1.0 - centerDist) * 0.5, 0.0, 1.0);`;
    if (this.texturized) {
        src += `
mat2 texRotation = mat2(cos(circleRotation), -sin(circleRotation),
                        sin(circleRotation), cos(circleRotation));
vec2 texCoords = texRotation * centerDiff / radius * 0.5 + 0.5;
// Note: remember to keep the texture2D call outside non-uniform flow control.
// TODO: We could also use explicit texture LOD in here in case it is supported.
float texValue = texture2D(uBrushTex, texCoords).r;
// Usage of antialiasMult even when we have a texturized brush increases accuracy at small brush sizes and ensures
// that the brush stays inside the bounding box even when rotated.
${ assignTo } = flowAlpha * antialiasMult * texValue;`;
    } else {
        if (this.soft) {
            src += `
${ assignTo } = max((1.0 - centerDist / radius) * flowAlpha * antialiasMult, 0.0);`;
        } else {
            src += `
${ assignTo } =  flowAlpha * antialiasMult;`;
        }
    }
    // TODO: Restore indentation
    return src;
};

/**
 * Generates source for the inner loop of the fragment shader that blends a
 * circle with the "destAlpha" value from previous rounds.
 * @param {number} index Index of the circle.
 * @param {string=} arrayIndex Postfix for uCircle, so that it can be either an
 * array or just a bunch of separate uniforms to work around bugs. Defaults to
 * array. Does not matter if circle parameters are taken from a texture.
 * @return {Array<string>} Shader source code lines.
 */
RasterizeShaderGenerator.prototype.fragmentInnerLoopSource = function(index,
                                                             arrayIndex) {
    if (arrayIndex === undefined) {
        arrayIndex = `[${ index }]`;
    }
    var texturizedCircleParams = '';
    if (this.texturized) {
        texturizedCircleParams = `
      float circleRotation = uCircleB${ arrayIndex }.x;
      vec2 centerDiff = vPixelCoords - center;`;
    }

    // The conditional controlling blending the circle is non-uniform flow control.
    // See GLSL ES 1.0.17 spec Appendix A.6.
    // For the texturized brush, the if must be deferred since the texture is mipmapped.
    var evaluateCircleInsideIf = !this.texturized;
    var ifCircleActive = this.dynamicCircles ? `if (${ index } < uCircleCount)` : '';

    return `
    ${ evaluateCircleInsideIf ? ifCircleActive : '' } {
      vec2 center = uCircle${ arrayIndex }.xy;
      float circleRadius = uCircle${ arrayIndex }.z;
      float circleFlowAlpha = uCircle${ arrayIndex }.w;
      float centerDist = length(vPixelCoords - center);
${ texturizedCircleParams }
${ this.fragmentAlphaSource('float circleAlpha', '      ') }
${ !evaluateCircleInsideIf ? ifCircleActive : '' } {
        destAlpha = clamp(circleAlpha + (1.0 - circleAlpha) * destAlpha, 0.0, 1.0);
      }
    }`;
};

/**
 * @return {string} Fragment shader source.
 */
RasterizeShaderGenerator.prototype.fragmentSource = function() {
    var initSrcAlphaIfAny = '';
    if (this.doubleBuffered) {
        initSrcAlphaIfAny = `
  vec4 src = texture2D(uSrcTex, vSrcTexCoord);`
        if (this.fbFormat === GLRasterizerFormat.redGreen) {
            initSrcAlphaIfAny += `
  float srcAlpha = src.r + src.g / 256.0;`;
        } else {
            initSrcAlphaIfAny += `
  float srcAlpha = src.a;`;
        }
    }
    var fragmentInnerLoop = '';
    if (this.unroll) {
        for (var i = 0; i < this.circles; ++i) {
            fragmentInnerLoop += this.fragmentInnerLoopSource(i, i);
        }
    } else {
        fragmentInnerLoop = `
  for (int i = 0; i < ${ this.circles }; ++i) {
    ${ this.fragmentInnerLoopSource('i') }
  }`;
    }

    var computeOutputAlpha = 'float alpha = destAlpha;';
    if (this.doubleBuffered) {
        computeOutputAlpha = 'float alpha = destAlpha + (1.0 - destAlpha) * srcAlpha;';
    }
    var writeFragColor = 'gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);';
    if (this.fbFormat === GLRasterizerFormat.redGreen) {
        writeFragColor = 'gl_FragColor = packNormFloatToRG(alpha);';
    }
    return `
precision highp float;
precision highp sampler2D;
precision highp int;
${ ShaderGenerator.commonGLSLHelpers }
${ this.varyingSource() }
${ this.fragmentUniformSource().join('\n') }
void main(void) {
  float destAlpha = 0.0;
  ${ initSrcAlphaIfAny }
  ${ fragmentInnerLoop }
  ${ computeOutputAlpha }
  ${ writeFragColor }
}`;
};

/**
 * @param {number} index Index of the circle.
 * @param {string} arrayIndex Postfix for uCircle, so that it can be either an
 * array or just a bunch of separate uniforms to work around bugs. Defaults to
 * arrays. Does not matter if circle parameters are taken from a texture.
 * @return {Array<string>} Vertex shader inner loop lines.
 */
RasterizeShaderGenerator.prototype.vertexInnerLoopSource = function(index, arrayIndex) {
    return '';
};

/**
 * @return {string} Vertex shader source.
 */
RasterizeShaderGenerator.prototype.vertexSource = function() {
    var src = `precision highp float;

// expecting a vertex array with corners at -1 and 1 x and y coordinates
attribute vec2 aVertexPosition;
${ this.varyingSource() }
${ this.vertexUniformSource().join('\n') }
void main(void) {
  vPixelCoords = vec2(aVertexPosition.x + 1.0, 1.0 - aVertexPosition.y) / uPixelPitch;
`;
    if (this.doubleBuffered) {
        src += '  vSrcTexCoord = (aVertexPosition + 1.0) * 0.5;\n';
    }
    if (this.vertexInnerLoopSource('').length > 0) {
        if (this.unroll) {
            for (var i = 0; i < this.circles; ++i) {
                src += this.vertexInnerLoopSource(i, i);
            }
        } else {
            src += `
  for (int i = 0; i < ${ this.circles }; ++i) {
    ${ this.vertexInnerLoopSource('i') }
  }`;
        }
    }
    src += `  gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}`;
    return src;
};

export { RasterizeShaderGenerator };
