/**
 * A compositor for buffers that have canvas backing.
 * @param {CanvasRenderingContext2D} ctx Target rendering context.
 * @constructor
 */
var CanvasCompositor = function(ctx) {
    this.ctx = ctx;
    this.width = this.ctx.canvas.width;
    this.height = this.ctx.canvas.height;
    this.compositingCanvas = document.createElement('canvas');
    this.compositingCanvas.width = this.width;
    this.compositingCanvas.height = this.height;
    this.compositingCtx = this.compositingCanvas.getContext('2d');

    this.prepare();
};

/**
 * Type of composited element
 * @enum
 */
CanvasCompositor.Element = {
    buffer: 0,
    event: 1
};

/**
 * Prepare for another round of compositing.
 * @protected
 */
CanvasCompositor.prototype.prepare = function() {
    this.pending = [];
    this.needsClear = true;
    this.lastVisible = true;
};

/**
 * Add a buffer to composit to the target context.
 * @param {CanvasBuffer} buffer Buffer to composit.
 */
CanvasCompositor.prototype.pushBuffer = function(buffer) {
    this.lastVisible = buffer.visible;
    if (!buffer.visible) {
        return;
    }
    if (!buffer.hasAlpha) {
        this.needsClear = false;
        this.pending = [];
    }
    this.pending.push({type: CanvasCompositor.Element.buffer, buffer: buffer});
};

/**
 * Add an event to composit to the target context.
 * @param {PictureEvent} event Event to merge to the last pushed buffer.
 * @param {Rasterizer} rasterizer Rasterizer that holds the rasterized event.
 * @param {BrushEvent.Mode} mode Blending mode for the event.
 */
CanvasCompositor.prototype.pushEvent = function(event, rasterizer, mode) {
    if (!this.lastVisible || event === null || event.boundingBox === null) {
        return;
    }
    this.pending.push({type: CanvasCompositor.Element.event, event: event,
                       rasterizer: rasterizer, mode: mode});
};

/**
 * Ensure that results of all queued draw operations are written into the target
 * context.
 */
CanvasCompositor.prototype.flush = function() {
    if (this.needsClear) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.needsClear = false;
    }
    var i = 0;
    while (i < this.pending.length) {
        if (i + 1 === this.pending.length ||
            this.pending[i + 1].type === CanvasCompositor.Element.buffer) {
            this.ctx.drawImage(this.pending[i].buffer.canvas, 0, 0);
            ++i;
        } else {
            if (this.pending[i].buffer.hasAlpha) {
                this.compositingCtx.clearRect(0, 0, this.width, this.height);
            }
            this.compositingCtx.drawImage(this.pending[i].buffer.canvas, 0, 0);
            var sourceCtx = this.pending[i].buffer.ctx;
            ++i;
            while (i < this.pending.length &&
                  this.pending[i].type === CanvasCompositor.Element.event) {
                var clipRect = new Rect(0, this.width, 0, this.height);
                clipRect.intersectRect(this.pending[i].event.boundingBox);
                CanvasBuffer.drawRasterizer(sourceCtx,
                                            this.compositingCtx,
                                            this.pending[i].rasterizer,
                                            clipRect,
                                            false,
                                            this.pending[i].event.color,
                                            this.pending[i].event.opacity,
                                            this.pending[i].mode);
                ++i;
                sourceCtx = this.compositingCtx;
            }
            this.ctx.drawImage(this.compositingCanvas, 0, 0);
        }
    }
    this.prepare();
};

/**
 * A compositor for buffers that have WebGL texture backing.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {number} multitexturingLimit Maximum number of textures to access in
 * one fragment shader pass.
 * @constructor
 */
var GLCompositor = function(glManager, gl, multitexturingLimit) {
    this.glManager = glManager;
    this.gl = gl;
    this.currentBufferEvents = 0;
    this.multitexturingLimit = multitexturingLimit;

    this.prepare();
};

/**
 * Prepare for another round of compositing.
 * @protected
 */
GLCompositor.prototype.prepare = CanvasCompositor.prototype.prepare;

/**
 * Add a buffer to composit to the framebuffer.
 * @param {GLBuffer} buffer Buffer to composit.
 */
GLCompositor.prototype.pushBuffer = function(buffer) {
    this.lastVisible = buffer.visible;
    if (!buffer.visible) {
        return;
    }
    if (!buffer.hasAlpha) {
        this.needsClear = false;
        this.pending = [];
    }
    if (this.pending.length + 1 >= this.multitexturingLimit) {
        this.flushInternal();
        this.pending = [];
    }
    this.pending.push({type: CanvasCompositor.Element.buffer, buffer: buffer});
    this.currentBufferEvents = 0;
};

/**
 * Add an event to composit to the framebuffer.
 * @param {PictureEvent} event Event to merge to the last pushed buffer.
 * @param {BaseRasterizer} rasterizer Rasterizer that holds the rasterized
 * event.
 * @param {BrushEvent.Mode} mode Blending mode for the event.
 */
GLCompositor.prototype.pushEvent = function(event, rasterizer, mode) {
    if (!this.lastVisible) {
        return;
    }
    // TODO: assert(this.pending.length > 0);
    ++this.currentBufferEvents;
    if (this.currentBufferEvents + 1 >= this.multitexturingLimit) {
        // TODO: handle this case with a separate FBO
        console.log('Maximum event count exceeded in GLCompositor');
        return;
    }
    if (this.pending.length + 1 >= this.multitexturingLimit) {
        this.flushUntilLastBuffer();
    }
    // TODO: assert(this.stackToFlush.length < this.multiTexturingLimit);
    this.pending.push({type: CanvasCompositor.Element.event, event: event,
                       rasterizer: rasterizer, mode: mode});
};

/**
 * Ensure that results of all queued draw operations are written into the
 * framebuffer.
 */
GLCompositor.prototype.flush = function() {
    this.flushInternal(this.pending);
    this.prepare();
};

/**
 * Flush events up to the latest buffer in the pending stack.
 * @protected
 */
GLCompositor.prototype.flushUntilLastBuffer = function() {
    var i = this.pending.length - 1;
    while (this.pending[i].type === CanvasCompositor.Element.event) {
        --i;
        // TODO: assert(i >= 0);
    }
    this.flushInternal(this.pending.splice(0, i));
};

/**
 * Flush a collection of elements into the framebuffer.
 * @param {Array.<Object>} flushed Array of pending elements to flush.
 * @protected
 */
GLCompositor.prototype.flushInternal = function(flushed) {
    // TODO: assert(flushed[0].type === CanvasCompositor.Element.buffer);
    if (this.needsClear) {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.needsClear = false;
    }

    var buffers = [];
    var eventAttachment = -1;
    var eventObject = null;
    for (var i = 0; i < flushed.length; ++i) {
        if (flushed[i].type === CanvasCompositor.Element.buffer) {
            buffers.push(flushed[i].buffer);
        } else {
            eventAttachment = buffers.length - 1;
            eventObject = flushed[i];
        }
    }

    // TODO: limitation: can only composit one event into one buffer in a pass.
    var eventMode = BrushEvent.Mode.normal;
    var eventFormat = GLRasterizerFormat.alpha;
    if (eventObject !== null) {
        var eventMode = eventObject.mode;
        var eventFormat = eventObject.rasterizer.format;
    }
    var compositingProgram = compositingShader.getShaderProgram(
        this.glManager, buffers, eventAttachment, eventMode, eventFormat);

    var compositingUniforms = {};
    for (var i = 0; i < buffers.length; ++i) {
        if (buffers[i].visible) {
            compositingUniforms['uLayer' + i] = buffers[i].tex;
            if (eventAttachment === i) {
                compositingUniforms['uCurrentEvent'] =
                    eventObject.rasterizer.getTex();
                if (eventObject.event !== null) {
                    var color = eventObject.event.color;
                    compositingUniforms['uCurrentColor'] =
                        [color[0] / 255, color[1] / 255, color[2] / 255,
                        eventObject.event.opacity];
                } else {
                    compositingUniforms['uCurrentColor'] = [0, 0, 0, 0];
                }
            }
        }
    }
    this.glManager.drawFullscreenQuad(compositingProgram, compositingUniforms);
    this.gl.flush();
};
