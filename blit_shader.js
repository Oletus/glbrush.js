/*
 * Copyright Olli Etuaho 2012-2013.
 */
'use strict';

var blitShader = {};

/**
 * Fragment shader source for converting a float monochrome raster to color.
 */
blitShader.convertSimpleSrc = `  precision highp float;
  uniform sampler2D uSrcTex;
  varying vec2 vTexCoord;
  uniform vec4 uColor;
  void main(void) {
    vec4 src = texture2D(uSrcTex, vTexCoord);
    float a = src.w * uColor.w;
    gl_FragColor = vec4(uColor.xyz * a, a); // premultiply
  }`;

/**
 * Fragment shader source for converting a monochrome raster stored in red and
 * green channels to color.
 */
blitShader.convertRedGreenSrc = `  precision highp float;
  uniform sampler2D uSrcTex;
  varying vec2 vTexCoord;
  uniform vec4 uColor;
  void main(void) {
    vec4 src = texture2D(uSrcTex, vTexCoord);
    float a = (src.x + src.y / 256.0) * uColor.w;
    gl_FragColor = vec4(uColor.xyz * a, a); // premultiply
  }`;

/**
 * Fragment shader source for a straight-up blit.
 */
blitShader.blitSrc = `  precision highp float;
  uniform sampler2D uSrcTex;
  varying vec2 vTexCoord;
  void main(void) {
    gl_FragColor = texture2D(uSrcTex, vTexCoord);
  }`;

/**
 * Vertex shader source for blitting/conversion/compositing.
 */
blitShader.blitVertSrc = `  precision highp float;
  attribute vec2 aVertexPosition;
  varying vec2 vTexCoord;
  void main(void) {
    vTexCoord = vec2((aVertexPosition.x + 1.0) * 0.5, (aVertexPosition.y + 1.0) * 0.5);
    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
  }`;

/**
 * Vertex shader source for drawing scaled/translated image.
 */
blitShader.blitScaledTranslatedVertSrc = `  precision highp float;
  attribute vec2 aVertexPosition;
  uniform vec2 uScale;
  uniform vec2 uTranslate;
  varying vec2 vTexCoord;
  void main(void) {
    vTexCoord = vec2((aVertexPosition.x + 1.0) * 0.5, (aVertexPosition.y + 1.0) * 0.5);
    vec2 vertexPosition = aVertexPosition * uScale + uTranslate;
    gl_Position = vec4(vertexPosition, 0.0, 1.0);
  }`;

/**
 * Uniform parameters for the conversion shaders.
 * @constructor
 */
blitShader.ConversionUniformParameters = function() {
    this['uSrcTex'] = null;
    this['uColor'] = new Float32Array([0.0, 0.0, 0.0, 0.0]);
};

export { blitShader };
