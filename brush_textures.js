/*
 * Copyright Olli Etuaho 2013.
 */

/**
 * A collection of brush tip textures to use in drawing.
 * @constructor
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in utilgl.
 */
var GLBrushTextures = function(gl, glManager) {
    this.gl = gl;
    this.glManager = glManager;
    this.textures = [];
};

/**
 * @param {HTMLCanvasElement|HTMLImageElement|ImageData} imageSource Image containing the brush tip sample in its red
 * channel. Both dimensions of the image must be equal and powers of two.
 */
GLBrushTextures.prototype.addTexture = function(imageSource) {
    var tex = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageSource);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.textures.push(tex);
};

/**
 * @param {number} textureIndex Index of the texture, corresponding to the order in which the textures were added.
 * @return {WebGLTexture} The texture.
 */
GLBrushTextures.prototype.getTexture = function(textureIndex) {
    return this.textures[textureIndex];
};
