/*
 * Copyright Olli Etuaho 2012-2013.
 */

/**
 * @constructor
 * @param {number} id Picture's unique id number.
 * @param {Rect} boundsRect Picture bounds. x and y should always be zero.
 * @param {number} bitmapScale Scale for rasterizing the picture. Events that
 * are pushed to this picture get this scale applied to them.
 * @param {string=} mode Either 'webgl', 'no-texdata-webgl' or 'canvas'.
 * Defaults to 'webgl'.
 * @param {number} currentEventAttachment Which buffer index to attach the
 * picture's current event to. Can be set to -1 if no current event is needed.
 */
var Picture = function(id, boundsRect, bitmapScale, mode,
                       currentEventAttachment) {
    this.id = id;
    if (mode === undefined) {
        mode = 'webgl';
    }
    this.mode = mode;

    this.animating = false;

    this.activeSid = 0;
    this.activeSessionEventId = 0;

    this.buffers = [];
    this.currentEventAttachment = currentEventAttachment;
    this.currentEvent = null;
    this.currentEventMode = BrushEvent.Mode.normal;

    this.boundsRect = boundsRect;
    this.bitmapScale = bitmapScale;
    var bitmapWidth = Math.floor(this.boundsRect.width() * this.bitmapScale);
    var bitmapHeight = Math.floor(this.boundsRect.height() * this.bitmapScale);
    this.bitmapRect = new Rect(0, bitmapWidth, 0, bitmapHeight);

    this.container = null;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.bitmapWidth();
    this.canvas.height = this.bitmapHeight();

    if (this.usesWebGl()) {
        this.gl = Picture.initWebGL(this.canvas);
        if (this.gl === null || !this.setupGLState()) {
            this.mode = undefined;
            return;
        }
    } else if (this.mode === 'canvas') {
        this.ctx = this.canvas.getContext('2d');
        this.compositor = new CanvasCompositor(this.ctx);
        this.initRasterizers();
    } else {
        this.mode = undefined;
        return;
    }
    this.generationTime = 0;
};

/**
 * Set up state in an existing gl context.
 * @return {boolean} Whether buffer initialization succeeded.
 */
Picture.prototype.setupGLState = function() {
    this.glManager = glStateManager(this.gl);

    console.log(this.glManager.availableExtensions);

    var useFloatRasterizer = (this.mode === 'webgl' ||
                              this.mode === 'no-texdata-webgl');
    if (useFloatRasterizer) {
        if (this.glManager.extensionTextureFloat === null) {
            return false;
        }
        if (this.mode === 'webgl') {
            this.glRasterizerConstructor = GLFloatTexDataRasterizer;
        } else {
            this.glRasterizerConstructor = GLFloatRasterizer;
        }
    } else {
        this.glRasterizerConstructor = GLDoubleBufferedRasterizer;
    }

    this.texBlitProgram = this.glManager.shaderProgram(blitShader.blitSrc,
                                                       blitShader.blitVertSrc,
                                                       {uSrcTex: 'tex2d'});
    this.texBlitUniforms = {
        uSrcTex: null
    };

    if (!this.initRasterizers()) {
        console.log('WebGL accelerated rasterizer did not pass sanity test ' +
                    '(mode ' + this.mode + '). Update your graphics drivers ' +
                    'or try switching browsers if possible.');
        return false;
    }

    this.compositor = new GLCompositor(this.glManager, this.gl,
                                       glUtils.maxTextureUnits);
    return true;
};

/**
 * Add a buffer to the top of the buffer stack.
 * @param {number} id Identifier for this buffer. Unique at the Picture level.
 * Can be -1 if events won't be serialized separately from this buffer.
 * @param {Array.<number>} clearColor 4-component array with RGBA color that's
 * used to clear this buffer.
 * @param {boolean} hasUndoStates Does the buffer store undo states?
 * @param {boolean} hasAlpha Does the buffer have an alpha channel?
 */
Picture.prototype.addBuffer = function(id, clearColor, hasUndoStates,
                                       hasAlpha) {
    var buffer = this.createBuffer(id, clearColor, hasUndoStates, hasAlpha);
    this.buffers.push(buffer);
};

/**
 * Move a buffer to the given index in the buffer stack. Current event stays
 * attached to the moved buffer, if it exists.
 * @param {number} fromPosition The position of the buffer to move. Must be an
 * integer between 0 and Picture.buffers.length - 1.
 * @param {number} toPosition The position to move this buffer to. Must be an
 * integer between 0 and Picture.buffers.length - 1.
 */
Picture.prototype.moveBuffer = function(fromPosition, toPosition) {
    // TODO: assert that buffer count is respected
    var buffer = this.buffers[fromPosition];
    this.buffers.splice(fromPosition, 1);
    this.buffers.splice(toPosition, 0, buffer);
    if (this.currentEventAttachment === fromPosition) {
        this.currentEventAttachment = toPosition;
    }
};

/**
 * Update the current event compositing mode.
 * @protected
 */
Picture.prototype.updateCurrentEventMode = function() {
    if (this.currentEvent !== null && this.currentEventAttachment >= 0) {
        // TODO: assert(this.currentEventAttachment < this.buffers.length)
        this.currentEventMode = this.currentEvent.mode;
        if (this.currentEventMode === BrushEvent.Mode.eraser &&
            !this.buffers[this.currentEventAttachment].hasAlpha) {
            this.currentEventMode = BrushEvent.Mode.normal;
        }
    }
};

/**
 * Attach the current event to the given buffer in the stack.
 * @param {number} attachment Which buffer index to attach the picture's current
 * event to. Can be set to -1 if no current event is needed.
 */
Picture.prototype.setCurrentEventAttachment = function(attachment) {
    this.currentEventAttachment = attachment;
    this.updateCurrentEventMode();
};

/**
 * Set one of this picture's buffers visible or invisible.
 * @param {number} buffer The index of the buffer to adjust.
 * @param {boolean} visible Is the buffer visible?
 */
Picture.prototype.setBufferVisible = function(buffer, visible) {
    this.buffers[buffer].visible = visible;
};

/**
 * Set the opacity of one of this picture's buffers.
 * @param {number} buffer The index of the buffer to adjust.
 * @param {number} opacity Opacity value to set, range from 0 to 1.
 */
Picture.prototype.setBufferOpacity = function(buffer, opacity) {
    this.buffers[buffer].opacity = opacity;
};

/**
 * Create a Picture object.
 * @param {number} id Picture's unique id number.
 * @param {number} width Picture width.
 * @param {number} height Picture height.
 * @param {number} bitmapScale Scale for rasterizing the picture. Events that
 * are pushed to this picture get this scale applied to them.
 * @param {Array.<string>} modesToTry Modes to try to initialize the picture.
 * Can contain either 'webgl', 'no-texdata-webgl', 'no-float-webgl' or 'canvas'.
 * Modes are tried in the order they are in the array.
 * @param {number} currentEventAttachment Which buffer index to attach the
 * picture's current event to. Can be set to -1 if no current event is needed.
 * @return {Picture} The created picture or null if one couldn't be created.
 */
Picture.create = function(id, width, height, bitmapScale, modesToTry,
                          currentEventAttachment) {
    var pictureBounds = new Rect(0, width, 0, height);
    var i = 0;
    var pic = null;
    while (i < modesToTry.length && pic === null) {
        var mode = modesToTry[i];
        if (glUtils.supportsTextureUnits(4) || mode === 'canvas') {
            pic = new Picture(id, pictureBounds, bitmapScale, mode,
                              currentEventAttachment);
            if (pic.mode === undefined) {
                pic = null;
            }
        }
        i++;
    }
    return pic;
};

/**
 * Create a picture object by parsing a serialization of it.
 * @param {number} id Unique identifier for the picture.
 * @param {string} serialization Serialization of the picture as generated by
 * Picture.prototype.serialize(). May optionally have metadata not handled by
 * the Picture object at the end, separated by line "metadata".
 * @param {number} bitmapScale Scale for rasterizing the picture. Events that
 * are pushed to this picture get this scale applied to them.
 * @param {Array.<string>} modesToTry Modes to try to initialize the picture.
 * Can contain either 'webgl', 'no-texdata-webgl', 'no-float-webgl' or 'canvas'.
 * Modes are tried in the order they are in the array.
 * @param {number} currentEventAttachment Which buffer index to attach the
 * picture's current buffer to. Can be set to -1 if no current buffer is needed.
 * @return {Object} Object containing key 'picture' for the created picture and
 * key 'metadata' for the metadata lines or null if picture couldn't be created.
 */
Picture.parse = function(id, serialization, bitmapScale, modesToTry,
                         currentEventAttachment) {
    var startTime = new Date().getTime();
    var eventStrings = serialization.split(/\r?\n/);
    var pictureParams = eventStrings[0].split(' ');
    var width = parseInt(pictureParams[1]);
    var height = parseInt(pictureParams[2]);
    var pic = Picture.create(id, width, height, bitmapScale, modesToTry,
                             currentEventAttachment);
    var i = 1;
    while (i < eventStrings.length) {
        if (eventStrings[i] === 'metadata') {
            break;
        } else {
            var arr = eventStrings[i].split(' ');
            if (arr[0] === 'buffer') {
                var j = 1;
                var bufferId = parseInt(arr[j++]);
                var clearColor = [parseInt(arr[j++]),
                                  parseInt(arr[j++]),
                                  parseInt(arr[j++]),
                                  parseInt(arr[j++])];
                var hasUndoStates = arr[j++] === '1';
                var hasAlpha = arr[j++] === '1';
                var insertionPoint = parseInt(arr[j++]);
                pic.addBuffer(bufferId, clearColor, hasUndoStates, hasAlpha);
                var targetBuffer = pic.buffers[pic.buffers.length - 1];
                targetBuffer.setInsertionPoint(insertionPoint);
            } else {
                var pictureEvent = PictureEvent.parse(arr, 0);
                pictureEvent.scale(bitmapScale);
                pic.pushEvent(pic.buffers.length - 1, pictureEvent);
            }
            ++i;
        }
    }
    var metadata = [];
    if (i < eventStrings.length && eventStrings[i] === 'metadata') {
        metadata = eventStrings.slice(i);
    }
    pic.generationTime = new Date().getTime() - startTime;
    return {picture: pic, metadata: metadata};
};

/**
 * Create a resized copy of the given picture at the given scale.
 * @param {Picture} pic The picture to resize.
 * @param {number} bitmapScale The scale to set to the new picture. The new
 * picture's bitmap width will be the old picture's width() * bitmapScale.
 * @return {Picture} A new, resized picture.
 */
Picture.resize = function(pic, bitmapScale) {
    var serialization = pic.serialize();
    return Picture.parse(pic.id, serialization, bitmapScale, [pic.mode],
                         pic.currentEventAttachment).picture;
};

/**
 * @return {number} The maximum scale to which this picture can be reliably
 * resized on the current configuration.
 */
Picture.prototype.maxBitmapScale = function() {
    // Note: if WebGL is unsupported, falls back to default (unconfirmed)
    // glUtils.maxFramebufferSize. This is a reasonable value for 2D canvas.
    return glUtils.maxFramebufferSize / Math.max(this.width(), this.height());
};

/**
 * @return {string} A serialization of this Picture. Can be parsed into a new
 * Picture by calling Picture.parse.
 */
Picture.prototype.serialize = function() {
    var serializationScale = 1.0 / this.bitmapScale;
    var serialization = ['picture ' + this.width() + ' ' + this.height()];
    for (var i = 0; i < this.buffers.length; ++i) {
        var buffer = this.buffers[i];
        serialization.push('buffer ' + buffer.id +
                           ' ' + color.serializeRGBA(buffer.clearColor) +
                           ' ' + (buffer.undoStates !== null ? '1' : '0') +
                           ' ' + (buffer.hasAlpha ? '1' : '0') +
                           ' ' + buffer.insertionPoint);
        for (var j = 0; j < buffer.events.length; ++j) {
            serialization.push(buffer.events[j].serialize(serializationScale));
        }
    }
    return serialization.join('\n');
};

/**
 * Set the session with the given sid active for purposes of createBrushEvent
 * and undoLatest.
 * @param {number} sid The session id to activate. Must be a positive integer.
 */
Picture.prototype.setActiveSession = function(sid) {
    this.activeSid = sid;
    this.activeSessionEventId = 0;
    var latest = this.findLatest(sid, true);
    if (latest !== null) {
        this.activeSessionEventId = latest.sessionEventId + 1;
    }
};

/**
 * Create a brush event using the current active session. The event is marked as
 * not undone.
 * @param {Uint8Array|Array.<number>} color The RGB color of the stroke. Channel
 * values are between 0-255.
 * @param {number} flow Alpha value controlling blending individual brush
 * samples (circles) to each other in the rasterizer. Range 0 to 1. Normalized
 * to represent the resulting maximum alpha value in the rasterizer's bitmap in
 * case of a straight stroke and the maximum pressure.
 * @param {number} opacity Alpha value controlling blending the rasterizer
 * stroke to the target buffer. Range 0 to 1.
 * @param {number} radius The stroke radius in pixels.
 * @param {number} softness Value controlling the softness. Range 0 to 1.
 * @param {BrushEvent.Mode} mode Blending mode to use.
 * @return {BrushEvent} The created brush event.
 */
Picture.prototype.createBrushEvent = function(color, flow, opacity, radius,
                                              softness, mode) {
    var event = new BrushEvent(this.activeSid, this.activeSessionEventId, false,
                               color, flow, opacity, radius, softness, mode);
    this.activeSessionEventId++;
    return event;
};


/**
 * @param {HTMLCanvasElement} canvas Canvas to use for rasterization.
 * @return {WebGLRenderingContext} Context to use or null if unsuccessful.
 */
Picture.initWebGL = function(canvas) {
    var contextAttribs = {
        antialias: false,
        stencil: false,
        depth: false,
        premultipliedAlpha: true
    };
    var gl = glUtils.initGl(canvas, contextAttribs, 4);
    if (!gl) {
        return null;
    }

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, canvas.width, canvas.height);
    return gl;
};

/**
 * @return {boolean} Does the picture use WebGL?
 */
Picture.prototype.usesWebGl = function() {
    return (this.mode === 'webgl' || this.mode === 'no-float-webgl' ||
            this.mode === 'no-texdata-webgl');
};

/**
 * Set a containing widget for this picture. The container is expected to add
 * what's returned from pictureElement() under a displayed HTML element.
 * @param {Object} container The container.
 */
Picture.prototype.setContainer = function(container) {
    this.container = container;
};

/**
 * @return {HTMLCanvasElement} the element that displays the rasterized picture.
 */
Picture.prototype.pictureElement = function() {
    return this.canvas;
};

/**
 * Initialize rasterizers.
 * @return {boolean} True on success.
 * @protected
 */
Picture.prototype.initRasterizers = function() {
    this.currentEventRasterizer = this.createRasterizer();
    if (!this.currentEventRasterizer.checkSanity()) {
        this.currentEventRasterizer.free();
        return false;
    }
    this.genericRasterizer = this.createRasterizer();
    return true;
};

/**
 * Create a single buffer using the mode specified for this picture.
 * @param {number} id Identifier for this buffer. Unique at the Picture level.
 * Can be -1 if events won't be serialized separately from this buffer.
 * @param {Array.<number>} clearColor 4-component array with RGBA color that's
 * used to clear this buffer. Unpremultiplied and channel values are between
 * 0-255.
 * @param {boolean} hasUndoStates Does the buffer store undo states?
 * @param {boolean} hasAlpha Does the buffer have an alpha channel?
 * @return {GLBuffer|CanvasBuffer} The buffer.
 * @protected
 */
Picture.prototype.createBuffer = function(id, clearColor, hasUndoStates,
                                          hasAlpha) {
    if (this.usesWebGl()) {
        return new GLBuffer(this.gl, this.glManager, this.texBlitProgram, id,
                            this.bitmapWidth(), this.bitmapHeight(),
                            clearColor, hasUndoStates, hasAlpha);
    } else if (this.mode === 'canvas') {
        return new CanvasBuffer(id, this.bitmapWidth(), this.bitmapHeight(),
                                clearColor, hasUndoStates, hasAlpha);
    }
};

/**
 * Create a single rasterizer using the mode specified for this picture.
 * @param {boolean=} saveMemory Choose a rasterizer that uses the least possible
 * memory as opposed to one that has the best performance. Defaults to false.
 * @return {BaseRasterizer} The rasterizer.
 */
Picture.prototype.createRasterizer = function(saveMemory) {
    if (saveMemory === undefined) {
        saveMemory = false;
    }
    if (this.glRasterizerConstructor !== undefined) {
        if (saveMemory) {
            return new GLDoubleBufferedRasterizer(this.gl, this.glManager,
                                                  this.bitmapWidth(),
                                                  this.bitmapHeight());
        } else {
            return new this.glRasterizerConstructor(this.gl, this.glManager,
                                                    this.bitmapWidth(),
                                                    this.bitmapHeight());
        }
    } else {
        return new Rasterizer(this.bitmapWidth(), this.bitmapHeight());
    }
};

/**
 * @return {number} The rasterizer bitmap width of the picture in pixels.
 */
Picture.prototype.bitmapWidth = function() {
    return this.bitmapRect.width();
};

/**
 * @return {number} The rasterizer bitmap height of the picture in pixels.
 */
Picture.prototype.bitmapHeight = function() {
    return this.bitmapRect.height();
};

/**
 * @return {number} The width of the picture.
 */
Picture.prototype.width = function() {
    return this.boundsRect.width();
};

/**
 * @return {number} The height of the picture.
 */
Picture.prototype.height = function() {
    return this.boundsRect.height();
};

/**
 * Scale the parsed event according to this picture's bitmap scale. The event's
 * data is scaled, but it will still be serialized using the original
 * coordinates, within floating point accuracy.
 * @param {PictureEvent} event Event to scale.
 */
Picture.prototype.scaleParsedEvent = function(event) {
    event.scale(this.bitmapScale);
};

/**
 * Add an event to the top of one of this picture's buffers.
 * @param {number} targetBuffer The index of the buffer to apply the event to.
 * @param {PictureEvent} event Event to add.
 */
Picture.prototype.pushEvent = function(targetBuffer, event) {
    if (this.currentEventRasterizer.drawEvent === event) {
        this.buffers[targetBuffer].pushEvent(event,
                                             this.currentEventRasterizer);
    } else {
        this.buffers[targetBuffer].pushEvent(event, this.genericRasterizer);
    }
};

/**
 * Add an event to the insertion point of one of this picture's buffers and
 * increment the insertion point.
 * @param {number} targetBuffer The index of the buffer to insert the event to.
 * @param {PictureEvent} event Event to insert.
 */
Picture.prototype.insertEvent = function(targetBuffer, event) {
    this.buffers[targetBuffer].insertEvent(event, this.genericRasterizer);
};

/**
 * Find the latest event from the given session.
 * @param {number} sid The session id to search.
 * @param {boolean} canBeUndone Whether to consider undone events.
 * @return {Object} The latest event indices or null if no event found. The
 * object will have keys eventIndex, bufferIndex and sessionEventId.
 * @protected
 */
Picture.prototype.findLatest = function(sid, canBeUndone) {
    var latestIndex = 0;
    var latestBufferIndex = 0;
    var latestId = -1;
    for (var i = 0; i < this.buffers.length; ++i) {
        var candidateIndex = this.buffers[i].findLatest(sid, canBeUndone);
        if (candidateIndex >= 0 &&
            this.buffers[i].events[candidateIndex].sessionEventId > latestId) {
            latestBufferIndex = i;
            latestIndex = candidateIndex;
            latestId = this.buffers[i].events[latestIndex].sessionEventId;
        }
    }
    if (latestId >= 0) {
        return {eventIndex: latestIndex, bufferIndex: latestBufferIndex,
            sessionEventId: latestId};
    }
    return null;
};

/**
 * Undo the latest non-undone event applied to this picture by the current
 * active session.
 * @return {PictureEvent} The event that was undone or null if no event found.
 */
Picture.prototype.undoLatest = function() {
    var latest = this.findLatest(this.activeSid, false);
    if (latest === null) {
        return null;
    }
    return this.buffers[latest.bufferIndex].undoEventIndex(latest.eventIndex,
                                                        this.genericRasterizer);
};

/**
 * Undo the specified event applied to this picture.
 * @param {number} sid The session id of the event.
 * @param {number} sessionEventId The session-specific event id of the event.
 * @return {boolean} True on success.
 */
Picture.prototype.undoEventSessionId = function(sid, sessionEventId) {
    var j = this.buffers.length;
    while (j >= 1) {
       --j;
        var i = this.buffers[j].eventIndexBySessionId(sid, sessionEventId);
        if (i >= 0) {
            if (!this.buffers[j].events[i].undone) {
                this.buffers[j].undoEventIndex(i, this.genericRasterizer);
            }
            return true;
        }
    }
    return false;
};

/**
 * Redo the specified event applied to this picture by marking it not undone.
 * @param {number} sid The session id of the event.
 * @param {number} sessionEventId The session-specific event id of the event.
 * @return {boolean} True on success.
 */
Picture.prototype.redoEventSessionId = function(sid, sessionEventId) {
    var j = this.buffers.length;
    while (j >= 1) {
       --j;
        var i = this.buffers[j].eventIndexBySessionId(sid, sessionEventId);
        if (i >= 0) {
            this.buffers[j].redoEventIndex(i, this.genericRasterizer);
            return true;
        }
    }
    return false;
};

/**
 * Remove the specified event from this picture entirely.
 * @param {number} sid The session id of the event.
 * @param {number} sessionEventId The session-specific event id of the event.
 * @return {boolean} True on success.
 */
Picture.prototype.removeEventSessionId = function(sid, sessionEventId) {
    var j = this.buffers.length;
    while (j >= 1) {
       --j;
        var i = this.buffers[j].eventIndexBySessionId(sid, sessionEventId);
        if (i >= 0) {
            this.buffers[j].removeEventIndex(i, this.genericRasterizer);
            return true;
        }
    }
    return false;
};

/**
 * Update the currentEvent of this picture, meant to contain the event that the
 * user is currently drawing. The event is assumed to already be in the picture
 * bitmap coordinates in pixels, not in the picture coordinates.
 * @param {PictureEvent} cEvent The event the user is currently drawing or null.
 */
Picture.prototype.setCurrentEvent = function(cEvent) {
    this.currentEvent = cEvent;
    if (this.currentEvent) {
        this.currentEventRasterizer.resetClip();
        this.currentEvent.updateTo(this.currentEventRasterizer);
    }
    this.updateCurrentEventMode();
};

/**
 * Search for event from sourceBuffer, remove it from there if it is found, and
 * push it to targetBuffer.
 * @param {number} targetBuffer The index of the buffer to push the event to.
 * @param {number} sourceBuffer The index of the buffer to search the event
 * from.
 * @param {PictureEvent} event The event to transfer.
 */
Picture.prototype.moveEvent = function(targetBuffer, sourceBuffer, event) {
    var src = this.buffers[sourceBuffer];
    var eventIndex = src.eventIndexBySessionId(event.sid, event.sessionEventId);
    if (eventIndex >= 0) {
        src.removeEventIndex(eventIndex, this.genericRasterizer);
    }
    this.pushEvent(targetBuffer, event);
};

/**
 * Display the latest updated buffers of this picture. Call after doing changes
 * to any of the picture's buffers.
 */
Picture.prototype.display = function() {
    if (this.animating) {
        return;
    }
    if (this.usesWebGl()) {
        this.glManager.useFbo(null);
        this.gl.scissor(0, 0, this.bitmapWidth(), this.bitmapHeight());
    }
    for (var i = 0; i < this.buffers.length; ++i) {
        this.compositor.pushBuffer(this.buffers[i]);
        if (this.currentEventAttachment === i) {
            // Even if there's no this.currentEvent at the moment, push it so
            // that the GLCompositor can avoid extra shader changes.
            this.compositor.pushEvent(this.currentEvent,
                                      this.currentEventRasterizer,
                                      this.currentEventMode);
        }
    }
    this.compositor.flush();
};

/**
 * Play back an animation displaying the progress of this picture from start to
 * finish.
 * @param {number} simultaneousStrokes How many subsequent events to animate
 * simultaneously. Must be at least 1.
 * @param {number} speed Speed at which to animate the individual events. Must
 * be between 0 and 1.
 * @param {function()=} animationFinishedCallBack Function to call when the
 * animation has finished.
 * @return {boolean} Returns true if the animation was started or is still in
 * progress from an earlier call.
 */
Picture.prototype.animate = function(simultaneousStrokes, speed,
                                     animationFinishedCallBack) {
    if (this.animating) {
        return true;
    }
    var that = this;
    this.animating = true;
    if (this.buffers.length === 0) {
        setTimeout(function() {
            that.animating = false;
            if (animationFinishedCallBack !== undefined) {
                animationFinishedCallBack();
            }
        }, 0);
        return true;
    }
    if (speed === undefined) {
        speed = 0.05;
    }
    this.animationSpeed = speed;

    this.totalEvents = 0;
    this.animationBuffers = [];
    // TODO: Currently playback is from bottom to top. Switch to a
    // timestamp-based approach.
    for (var i = 0; i < this.buffers.length; ++i) {
        this.totalEvents += this.buffers[i].events.length;
        var buffer = this.createBuffer(-1, this.buffers[i].clearColor,
                                       false, this.buffers[i].hasAlpha);
        this.animationBuffers.push(buffer);
    }
    this.animationRasterizers = [];
    this.animationEventIndices = [];

    simultaneousStrokes = Math.min(simultaneousStrokes, this.totalEvents);
    var j = -1;
    this.eventToAnimate = function(index) {
        for (var i = 0; i < that.buffers.length; ++i) {
            if (index < that.buffers[i].events.length) {
                return {event: that.buffers[i].events[index], bufferIndex: i};
            } else {
                index -= that.buffers[i].events.length;
            }
        }
        return null; // should not be reached
    };

    function getNextEventIndexToAnimate() {
        ++j;
        while (j < that.totalEvents && that.eventToAnimate(j).event.undone) {
            ++j;
        }
        var bufferIndex = 0;
        var eventToAnimate = that.eventToAnimate(j);
        if (eventToAnimate !== null) {
            bufferIndex = eventToAnimate.bufferIndex;
        }
        return {index: j, bufferIndex: bufferIndex};
    };

    for (var i = 0; i < simultaneousStrokes; ++i) {
        this.animationRasterizers.push(this.createRasterizer(true));
        this.animationEventIndices.push(getNextEventIndexToAnimate());
    }

    var animationPos = 0;
    var animationFrame = function() {
        if (!that.animating) {
            return;
        }
        var finishedRasterizers = 0;
        var animationPosForStroke = animationPos;
        animationPos += that.animationSpeed;
        for (var i = 0; i < simultaneousStrokes; ++i) {
            animationPosForStroke -= 1.0 / simultaneousStrokes;
            var eventIndex = that.animationEventIndices[i].index;
            if (eventIndex < that.totalEvents) {
                if (animationPosForStroke > 0) {
                    var eventToAnimate = that.eventToAnimate(eventIndex);
                    var bufferIndex = eventToAnimate.bufferIndex;
                    var event = eventToAnimate.event;
                    var untilPos = (animationPosForStroke % 1.0) +
                                   that.animationSpeed;
                    if (untilPos > 1.0) {
                        event.updateTo(that.animationRasterizers[i]);
                        that.animationBuffers[bufferIndex].pushEvent(event,
                            that.animationRasterizers[i]);
                        that.animationEventIndices[i] =
                            getNextEventIndexToAnimate();
                        that.animationRasterizers[i].clear();
                        that.animationRasterizers[i].resetClip();
                    } else {
                        var untilCoord = event.coords.length * untilPos;
                        untilCoord = Math.ceil(untilCoord / 3) * 3;
                        event.updateTo(that.animationRasterizers[i],
                                       untilCoord);
                    }
                }
            } else {
                if (that.animationRasterizers[i] !== null) {
                    that.animationRasterizers[i].free();
                    that.animationRasterizers[i] = null;
                }
                ++finishedRasterizers;
            }
        }
        if (finishedRasterizers !== simultaneousStrokes) {
            that.displayAnimation();
            requestAnimationFrame(animationFrame);
        } else {
            that.stopAnimating();
            if (animationFinishedCallBack !== undefined) {
                animationFinishedCallBack();
            }
        }
    };
    requestAnimationFrame(animationFrame);
    return true;
};

/**
 * Stop animating if animation is in progress.
 */
Picture.prototype.stopAnimating = function() {
    if (this.animating) {
        this.animating = false;
        var i;
        for (i = 0; i < this.animationRasterizers.length; ++i) {
            if (this.animationRasterizers[i] !== null) {
                this.animationRasterizers[i].free();
                this.animationRasterizers[i] = null;
            }
        }
        for (i = 0; i < this.animationBuffers.length; ++i) {
            this.animationBuffers[i].free();
        }
        this.animationBuffers = null;
        this.eventToAnimate = null;
        this.display();
    }
};

/**
 * Display the current animation frame on the canvas.
 * @protected
 */
Picture.prototype.displayAnimation = function() {
    if (this.usesWebGl()) {
        this.glManager.useFbo(null);
        this.gl.scissor(0, 0, this.bitmapWidth(), this.bitmapHeight());
    }
    var i, j;
    var rasterizerIndexOffset = 0;
    for (i = 0; i < this.animationRasterizers.length; ++i) {
        if (this.animationEventIndices[i].index <
            this.animationEventIndices[rasterizerIndexOffset].index) {
            rasterizerIndexOffset = i;
        }
    }
    for (i = 0; i < this.animationBuffers.length; ++i) {
        this.compositor.pushBuffer(this.animationBuffers[i]);
        for (j = 0; j < this.animationRasterizers.length; ++j) {
            // Start from the rasterizer that's first in the bottom-to-top order
            var ri = (j + rasterizerIndexOffset) %
                                  this.animationRasterizers.length;
            if (this.animationEventIndices[ri].index < this.totalEvents &&
                this.animationEventIndices[ri].bufferIndex === i) {
                var event = this.eventToAnimate(
                                this.animationEventIndices[ri].index).event;
                this.compositor.pushEvent(event, this.animationRasterizers[ri],
                                          event.mode);
            }
        }
    }
    this.compositor.flush();
};

/**
 * Return objects that contain events touching the given pixel. The objects
 * have two keys: event, and alpha which determines that event's alpha value
 * affecting this pixel. The objects are sorted from newest to oldest.
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Array.<Object>} Objects that contain events touching this pixel.
 */
Picture.prototype.blamePixel = function(coords) {
    var blame = [];
    var j = this.buffers.length;
    while (j >= 1) {
        --j;
        if (this.buffers[j].events.length > 0) {
            var bufferBlame = this.buffers[j].blamePixel(coords);
            if (bufferBlame.length > 0) {
                blame = blame.concat(bufferBlame);
            }
        }
    }
    return blame;
};

/**
 * Get a pixel from the composited picture. Displays the latest changes to the
 * picture as a side effect.
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8Array|Uint8ClampedArray} Unpremultiplied RGBA value.
 */
Picture.prototype.getPixelRGBA = function(coords) {
    this.display();
    if (this.usesWebGl()) {
        var buffer = new ArrayBuffer(4);
        var pixelData = new Uint8Array(buffer);
        var glX = Math.min(Math.floor(coords.x), this.bitmapWidth() - 1);
        var glY = Math.max(0, this.bitmapHeight() - 1 - Math.floor(coords.y));
        this.gl.readPixels(glX, glY, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE,
                           pixelData);
        pixelData = color.unpremultiply(pixelData);
        return pixelData;
    } else {
        return this.ctx.getImageData(Math.floor(coords.x),
                                     Math.floor(coords.y), 1, 1).data;
    }
};

/**
 * Generate a data URL representing this picture. Displays the latest changes to
 * the picture as a side effect.
 * @return {string} PNG data URL representing this picture.
 */
Picture.prototype.toDataURL = function() {
    this.display();
    return this.canvas.toDataURL();
};
