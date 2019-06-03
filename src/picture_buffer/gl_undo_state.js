/*
 * Copyright Olli Etuaho 2019.
 */

'use strict';

import { Rect } from '../math/rect.js';

import { glUtils } from '../gl/utilgl.js';

/**
 * Storage for bitmap data from a past GLBitmap state.
 * @constructor
 * @param {number} index The index of the next event in the events array. The
 * last event that takes part in this undo state is events[index - 1].
 * @param {number} cost Regeneration cost of the undo state.
 * @param {WebGLTexture} srcTex A texture containing the bitmap state
 * corresponding to the given index. May be null to create an invalid state.
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {ShaderProgram} texBlitProgram Shader program to use for blits. Must
 * have uniform sampler uSrcTex for the source texture.
 * @param {number} width Width of the texture to copy.
 * @param {number} height Height of the texture to copy.
 * @param {boolean} hasAlpha Must alpha channel data be copied?
 */
var GLUndoState = function(index, cost, srcTex, gl, glManager, texBlitProgram,
                           width, height, hasAlpha) {
    this.gl = gl;
    this.glManager = glManager;
    this.texBlitProgram = texBlitProgram;
    this.texBlitUniforms = texBlitProgram.uniformParameters();
    this.width = width;
    this.height = height;
    this.hasAlpha = hasAlpha;
    this.tex = null;
    this.invalid = true;
    this.update(srcTex, new Rect(0, this.width, 0, this.height));
    this.index = index;
    this.cost = cost;
};

/**
 * Set the bitmap dimensions of the undo state. Can only be done when the undo state is freed.
 * @param {number} width The new width.
 * @param {number} height The new height.
 */
GLUndoState.prototype.setDimensions = function(width, height) {
    // TODO: assert(this.tex === null);
    this.width = width;
    this.height = height;
};

/**
 * Ensure that the undo state has a texture to use.
 * @protected
 */
GLUndoState.prototype.ensureTexture = function() {
    if (this.tex === null) {
        var format = this.hasAlpha ? this.gl.RGBA : this.gl.RGB;
        this.tex = glUtils.createTexture(this.gl, this.width, this.height,
                                         format);
    }
};

/**
 * Update this undo state in place.
 * @param {WebGLTexture} srcTex A texture containing the bitmap state
 * corresponding to the given index.
 * @param {Rect} clipRect Area to update.
 */
GLUndoState.prototype.update = function(srcTex, clipRect) {
    if (srcTex === null) {
        return;
    }
    this.ensureTexture();
    this.gl.viewport(0, 0, this.width, this.height);
    this.glManager.useFboTex(this.tex);
    glUtils.updateClip(this.gl, clipRect, this.height);
    this.texBlitUniforms['uSrcTex'] = srcTex;
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                      this.texBlitUniforms);
    this.invalid = false;
};

/**
 * Copy an area from this undo state to the context it was created in.
 * @param {Rect} clipRect Clipping rectangle for the copy operation. Will be
 * rounded outwards.
 */
GLUndoState.prototype.draw = function(clipRect) {
    // TODO: assert(!this.invalid);
    this.gl.viewport(0, 0, this.width, this.height);
    this.texBlitUniforms['uSrcTex'] = this.tex;
    glUtils.updateClip(this.gl, clipRect, this.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                      this.texBlitUniforms);
};

/**
 * Clean up any allocated resources. The undo state will become invalid, but can
 * be restored by calling update().
 */
GLUndoState.prototype.free = function() {
    if (this.tex !== null) {
        this.gl.deleteTexture(this.tex);
        this.tex = null;
        this.invalid = true;
    }
};

export { GLUndoState };
