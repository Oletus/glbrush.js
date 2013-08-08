/*
 * Copyright Olli Etuaho 2013.
 */

/**
 * Storage for bitmap data from a past PictureBuffer state.
 * @constructor
 * @param {number} index The index of the next event in the events array. The
 * last event that takes part in this undo state is events[index - 1].
 * @param {HTMLCanvasElement} srcCanvas Canvas containing the bitmap state
 * corresponding to the given index.
 */
var CanvasUndoState = function(index, srcCanvas) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = srcCanvas.width;
    this.canvas.height = srcCanvas.height;
    this.ctx = this.canvas.getContext('2d');
    this.update(index, srcCanvas);
};

/**
 * Update this undo state in place.
 * @param {number} index The index of the next event in the events array. The
 * last event that takes part in this undo state is events[index - 1].
 * @param {HTMLCanvasElement} srcCanvas Canvas containing the bitmap state
 * corresponding to the given index.
 */
CanvasUndoState.prototype.update = function(index, srcCanvas) {
    this.index = index;
    this.ctx.drawImage(srcCanvas, 0, 0);
};

/**
 * Copy an area from this undo state to the given context.
 * @param {CanvasRenderingContext2D} ctx Rendering context to draw with.
 * @param {Rect} clipRect Clipping rectangle for the copy operation. Will be
 * rounded outwards.
 */
CanvasUndoState.prototype.draw = function(ctx, clipRect) {
    var r = clipRect.getXYWH();
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(this.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
};

/**
 * Clean up any allocated resources. The undo state is not usable after this.
 */
CanvasUndoState.prototype.free = function() {};


/**
 * Storage for bitmap data from a past GLBuffer state.
 * @constructor
 * @param {number} index The index of the next event in the events array. The
 * last event that takes part in this undo state is events[index - 1].
 * @param {WebGLTexture} srcTex A texture containing the bitmap state
 * corresponding to the given index.
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {ShaderProgram} texBlitProgram Shader program to use for blits. Must
 * have uniform sampler uSrcTex for the source texture.
 * @param {number} width Width of the texture to copy.
 * @param {number} height Height of the texture to copy.
 * @param {boolean} hasAlpha Must alpha channel data be copied?
 */
var GLUndoState = function(index, srcTex, gl, glManager, texBlitProgram,
                           width, height, hasAlpha) {
    this.gl = gl;
    this.glManager = glManager;
    this.texBlitProgram = texBlitProgram;
    this.texBlitUniforms = texBlitProgram.uniformParameters();
    this.width = width;
    this.height = height;
    this.hasAlpha = hasAlpha;
    var format = this.hasAlpha ? gl.RGBA : gl.RGB;
    this.tex = glUtils.createTex(gl, this.width, this.height, format);
    this.update(index, srcTex);
};

/**
 * Update this undo state in place.
 * @param {number} index The index of the next event in the events array. The
 * last event that takes part in this undo state is events[index - 1].
 * @param {WebGLTexture} srcTex A texture containing the bitmap state
 * corresponding to the given index.
 */
GLUndoState.prototype.update = function(index, srcTex) {
    this.index = index;
    this.glManager.useFboTex(this.tex);
    glUtils.updateClip(this.gl, new Rect(0, this.width, 0, this.height),
                       this.height);
    this.texBlitUniforms.uSrcTex = srcTex;
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                      this.texBlitUniforms);
};

/**
 * Copy an area from this undo state to the context it was created in.
 * @param {Rect} clipRect Clipping rectangle for the copy operation. Will be
 * rounded outwards.
 */
GLUndoState.prototype.draw = function(clipRect) {
    this.texBlitUniforms.uSrcTex = this.tex;
    glUtils.updateClip(this.gl, clipRect, this.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                      this.texBlitUniforms);
};

/**
 * Clean up any allocated resources. The undo state is not usable after this.
 */
GLUndoState.prototype.free = function() {
    this.gl.deleteTexture(this.tex);
};