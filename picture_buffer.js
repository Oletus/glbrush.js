/*
 * Copyright Olli Etuaho 2012-2013.
 */

/**
 * A buffer for 2D picture data. Contains a series of picture events in back-
 * to-front order and a combined bitmap representation of them. Not to be
 * instanced directly.
 * @constructor
 * @protected
 */
var PictureBuffer = function() {};

/**
 * Initialize picture buffer data.
 * @param {BufferAddEvent} createEvent Event that initializes the buffer.
 * @param {number} width Width of the buffer in pixels. Must be an integer.
 * @param {number} height Height of the buffer in pixels. Must be an integer.
 * @param {boolean} hasUndoStates Does this buffer store undo states? Defaults
 * to false.
 * @protected
 */
PictureBuffer.prototype.initializePictureBuffer = function(createEvent,
                                                           width, height,
                                                           hasUndoStates) {
    this.hasAlpha = createEvent.hasAlpha;
    this.id = createEvent.bufferId;
    this.events = [];
    this.isDummy = false;
    this.mergedTo = null;
    // How many remove events are not undone in this buffer. There could be
    // multiple ones if the buffer is edited from multiple sessions.
    this.removeCount = 0;
    if (hasUndoStates === undefined) {
        hasUndoStates = false;
    }
    if (hasUndoStates) {
        this.undoStates = [];
        this.undoStateInterval = 16;
        this.maxUndoStates = 5;
    } else {
        this.undoStates = null;
    }

    this.boundsRect = new Rect(0, width, 0, height);
    this.clipStack = [];
    this.currentClipRect = new Rect(0, width, 0, height);

    this.visible = true;
    this.insertionPoint = 0;
};

/**
 * @return {number} The compositing opacity for this buffer.
 */
PictureBuffer.prototype.opacity = function() {
    return this.events[0].opacity;
};

/**
 * Clean up any allocated resources. The picture buffer is not usable after
 * this.
 */
PictureBuffer.prototype.free = function() {
};

/**
 * Re-rasterize all events using the given rasterizer. Subject to the current
 * clipping rectangle.
 * @param {BaseRasterizer} rasterizer The rasterizer.
 */
PictureBuffer.prototype.playbackAll = function(rasterizer) {
    this.playbackStartingFrom(0, rasterizer);
};

/**
 * Re-rasterize all events starting from the given index using the given
 * rasterizer. Subject to the current clipping rectangle.
 * @param {number} eventIndex The event index to start from, inclusive. Must be
 * an integer.
 * @param {BaseRasterizer} rasterizer The rasterizer.
 * @protected
 */
PictureBuffer.prototype.playbackStartingFrom = function(eventIndex,
                                                        rasterizer) {
    var clipRect = this.getCurrentClipRect();
    for (var i = eventIndex; i < this.events.length; i++) {
        if (!this.events[i].undone &&
            this.events[i].boundsIntersectRect(clipRect)) {
            this.applyEvent(this.events[i], rasterizer);
        }
    }
};

/**
 * Rasterize an event to the picture buffer. Subject to the current clipping
 * rectangle.
 * @param {PictureEvent} event The event to rasterize.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @protected
 */
PictureBuffer.prototype.applyEvent = function(event, rasterizer) {
    if (event.isRasterized()) {
        var boundingBox = event.getBoundingBox(this.boundsRect);
        if (boundingBox === null) {
            rasterizer.setClip(this.getCurrentClipRect());
            event.drawTo(rasterizer);
            boundingBox = event.getBoundingBox(this.boundsRect);
            // TODO: assert(boundingBox !== null);
            this.pushClipRect(boundingBox);
            if (this.getCurrentClipRect().isEmpty()) {
                this.popClip();
                return;
            }
        } else {
            this.pushClipRect(boundingBox);
            if (this.getCurrentClipRect().isEmpty()) {
                this.popClip();
                return;
            }
            rasterizer.setClip(this.getCurrentClipRect());
            event.drawTo(rasterizer);
        }
        this.drawRasterizerWithColor(rasterizer, event.color, event.opacity,
                                     event.mode);
        this.popClip();
    } else if (event.eventType === 'bufferMerge') {
        // TODO: assert(event.mergedBuffer !== this);
        event.mergedBuffer.mergedTo = this;
        if (!event.mergedBuffer.events[0].undone) {
            // TODO: assert(event.mergedBuffer.removeCount === 0)
            this.drawBuffer(event.mergedBuffer, event.opacity);
        }
    } else if (event.eventType === 'bufferAdd') {
        this.clear(event.clearColor);
    } // Nothing to be done on remove
};

/**
 * Push an event to the top of this buffer's event stack.
 * @param {PictureEvent} event Event to push.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 */
PictureBuffer.prototype.pushEvent = function(event, rasterizer) {
    this.events.push(event);
    if (!event.undone) {
        this.applyEvent(event, rasterizer);
        if (event.eventType === 'bufferRemove') {
            ++this.removeCount;
        }
        this.eventsChanged(rasterizer);
    }
};

/**
 * Called from a merged buffer when its contents have changed and need to be
 * updated.
 * @param {PictureBuffer} changedBuffer The merged buffer that changed.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @protected
 */
PictureBuffer.prototype.mergedBufferChanged = function(changedBuffer,
                                                       rasterizer) {
    var i = this.events.length;
    while (i > 0) {
        --i;
        if (this.events[i].eventType === 'bufferMerge' &&
            this.events[i].mergedBuffer === changedBuffer) {
            this.playbackAfterChange(i, rasterizer);
            return;
        }
    }
};

/**
 * Insert an event at the current insertion point and increment the insertion
 * point.
 * @param {PictureEvent} event Event to insert.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 */
PictureBuffer.prototype.insertEvent = function(event, rasterizer) {
    if (this.insertionPoint === this.events.length) {
        this.pushEvent(event, rasterizer);
    } else {
        this.events.splice(this.insertionPoint, 0, event);
        if (event.eventType !== 'bufferMerge') {
            // Need to update the bounding box.
            // TODO: something more elegant here
            event.drawTo(rasterizer);
        }
        if (!event.undone) {
            this.playbackAfterChange(this.insertionPoint, rasterizer);
        }
    }
    this.setInsertionPoint(this.insertionPoint + 1);
};

/**
 * Change the insertion point.
 * @param {number} insertionPoint The insertion point to set. Must be an integer
 * event index.
 */
PictureBuffer.prototype.setInsertionPoint = function(insertionPoint) {
    // TODO: assert(insertionPoint > 0) // First event is always create event
    this.insertionPoint = insertionPoint;
    // TODO: Maintain an undo state exactly at the insertion point.
};

/**
 * Replace all the buffer contents with the given event. Meant for interactively
 * editing and displaying an event as efficiently as possible.
 * @param {PictureEvent} event The event to draw to the buffer. Can be null, in
 * which case the buffer is cleared completely.
 * @param {BaseRasterizer} rasterizer The rasterizer to use. The clip rect
 * should be set in the rasterizer in advance.
 */
PictureBuffer.prototype.replaceWithEvent = function(event, rasterizer) {
    // TODO: assert(this.clipStack.length === 0);
    if (this.events.length > 2) {
        this.clear(this.events[0].clearColor);
    } else if (this.events.length === 2) {
        this.pushClipRect(this.events[1].getBoundingBox(this.boundsRect));
        this.clear(this.events[0].clearColor);
        this.popClip();
    }
    this.events.splice(1, this.events.length);
    if (event !== null) {
        this.pushEvent(event, rasterizer);
    }
    this.invalidateUndoStatesFrom(1);
};

/**
 * Return objects that contain events touching the given pixel. The objects
 * have two keys: event, and alpha which determines that event's alpha value
 * affecting this pixel. The objects are sorted from front to back.
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Array.<Object>} Objects that contain events touching this pixel.
 */
PictureBuffer.prototype.blamePixel = function(coords) {
    var i = this.events.length - 1;
    var coordsRect = new Rect(Math.floor(coords.x), Math.floor(coords.x) + 1,
                              Math.floor(coords.y), Math.floor(coords.y) + 1);
    this.blameRasterizer.setClip(coordsRect);
    var blame = [];
    while (i >= 1) {
        if (!this.events[i].undone && this.events[i].isRasterized()) {
            var boundingBox = this.events[i].getBoundingBox(coordsRect);
            if (boundingBox.containsRoundedOut(coords)) {
                this.blameRasterizer.clear();
                this.events[i].drawTo(this.blameRasterizer);
                if (this.blameRasterizer.getPixel(coords) !== 0) {
                    var blameAlpha = this.blameRasterizer.getPixel(coords) *
                                     this.events[i].opacity;
                    blame.push({event: this.events[i], alpha: blameAlpha});
                }
            }
        }
        --i;
    }
    return blame;
};

/**
 * @return {Rect} Reference to the current clipping rectangle, that is the
 * intersection of all the rectangles in the clipping stack. Do not modify the
 * return value.
 */
PictureBuffer.prototype.getCurrentClipRect = function() {
    return this.currentClipRect;
};

/**
 * Push a rectangle to the clipping rectangle stack.
 * @param {Rect} rect The rectangle to clip with.
 */
PictureBuffer.prototype.pushClipRect = function(rect) {
    this.clipStack.push(rect);
    this.currentClipRect.intersectRectRoundedOut(rect);
};

/**
 * Remove the topmost rectangle from the clipping rectangle stack.
 */
PictureBuffer.prototype.popClip = function() {
    // TODO: Make this an assert.
    if (this.clipStack.length === 0) {
        console.log('Tried to pop from empty clipStack!');
        return;
    }
    this.clipStack.pop();
    this.currentClipRect.setRect(this.boundsRect);
    for (var i = 0; i < this.clipStack.length; ++i) {
        this.currentClipRect.intersectRectRoundedOut(this.clipStack[i]);
    }
};

/**
 * Search for an event in the buffer by session id and session event id.
 * @param {number} searchSid Session identifier. Must be an integer.
 * @param {number} searchSessionEventId An event/session specific identifier.
 * @return {number} Index of the event in the buffer or -1 if not found.
 */
PictureBuffer.prototype.eventIndexBySessionId = function(searchSid,
                                                         searchSessionEventId) {
    for (var e = 0; e < this.events.length; e++) {
        if (this.events[e].sid === searchSid) {
            if (this.events[e].sessionEventId === searchSessionEventId) {
                return e;
            } else if (this.events[e].sessionEventId > searchSessionEventId) {
                return -1;
            }
        }
    }
    return -1;
};

/**
 * @param {number} sid Session identifier. Must be an integer.
 * @param {boolean} canBeUndone Whether to consider undone events.
 * @return {number} The index of the latest event added with the given session
 * id or -1 if not found.
 */
PictureBuffer.prototype.findLatest = function(sid, canBeUndone) {
    var i = this.events.length - 1;
    while (i >= 0) {
        if ((canBeUndone || !this.events[i].undone) &&
            this.events[i].sid === sid) {
            return i;
        }
        i--;
    }
    return -1;
};

/**
 * Save an undo state.
 * @return {Object} The undo state.
 */
PictureBuffer.prototype.saveUndoState = function() {
    console.log('Unimplemented saveUndoState in PictureBuffer object');
    return null;
};

/**
 * Called after a new event has been pushed and applied. Updates undo states if
 * necessary.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 */
PictureBuffer.prototype.eventsChanged = function(rasterizer) {
    if (this.undoStates !== null) {
        var previousState = this.previousUndoState(this.events.length);

        // Find out how many new non-undone events are there?
        var newEvents = this.events.length - previousState.index;
        var i = this.events.length;
        while (newEvents >= this.undoStateInterval && i > previousState.index) {
            --i;
            if (this.events[i].undone) {
                --newEvents;
            }
        }
        if (newEvents >= this.undoStateInterval) {
            // Time to save a new undo state
            var newUndoState = this.saveUndoState();
            if (newUndoState !== null) {
                if (this.undoStates.length === this.maxUndoStates) {
                    this.undoStates.splice(0, 1);
                }
                this.undoStates.push(newUndoState);
            }
        }
    }
    if (this.mergedTo !== null) {
        this.mergedTo.mergedBufferChanged(this, rasterizer);
    }
};

/**
 * @param {number} eventIndex The event that needs to be undone.
 * @return {Object} The latest undo state that is good for undoing the event at
 * the given index.
 */
PictureBuffer.prototype.previousUndoState = function(eventIndex) {
    // TODO: assert(eventIndex > 0); // event 0 is the buffer add event, undone
    // at a higher level.
    if (this.undoStates !== null) {
        var i = this.undoStates.length - 1;
        while (i >= 0) {
            if (this.undoStates[i].index <= eventIndex) {
                return this.undoStates[i];
            }
            --i;
        }
    }
    return { index: 0 };
};

/**
 * Invalidate undo states that contain unusable data after the given event
 * has been undone.
 * @param {number} eventIndex The event index that was undone.
 */
PictureBuffer.prototype.invalidateUndoStatesFrom = function(eventIndex) {
    if (this.undoStates !== null) {
        var i = this.undoStates.length - 1;
        while (i >= 0) {
            // TODO: Instead of removing the entire undo state, it might be
            // worth it to maintain an invalidated rect in some cases if there
            // still are newer events that are not undone.
            if (this.undoStates[i].index > eventIndex) {
                this.undoStates[i].free();
                this.undoStates.splice(i, 1);
            }
            --i;
        }
    }
};

/**
 * Apply the given undo state to the bitmap.
 * @param {Object} undoState The undo state. May be just a dummy state signaling
 * clearing the buffer.
 * @protected
 */
PictureBuffer.prototype.applyState = function(undoState) {
    if (undoState.index !== 0) {
        this.applyStateObject(undoState);
    }
};

/**
 * Apply the given undo state to the bitmap. Must be a real undo state. This
 * dummy implementation just falls back to a clear, meant to be overridden in
 * inheriting objects.
 * @param {Object} undoState The undo state to apply.
 * @protected
 */
PictureBuffer.prototype.applyStateObject = function(undoState) {
    console.log('Unimplemented applyStateObject in PictureBuffer object');
    undoState.index = 0;
};

/**
 * Undo the non-undone event at the given index.
 * @param {number} eventIndex Event index in the buffer.
 * @param {BaseRasterizer} rasterizer The rasterizer to use to update the
 * bitmap.
 * @param {boolean} allowUndoMerge Allow undoing merge events.
 * @return {PictureEvent} The index of the undone event or null if nothing was
 * undone.
 */
PictureBuffer.prototype.undoEventIndex = function(eventIndex, rasterizer,
                                                  allowUndoMerge) {
    if (this.events[eventIndex].undone) {
        console.log('Tried to undo event that was already undone');
        return null;
    }
    if (this.events[eventIndex].eventType === 'bufferMerge') {
        if (!allowUndoMerge) {
            return null;
        }
        this.events[eventIndex].mergedBuffer.mergedTo = null;
    } else if (this.events[eventIndex].eventType === 'bufferRemove') {
        --this.removeCount;
    }
    this.events[eventIndex].undone = true;
    if (this.events[eventIndex].eventType !== 'bufferMove') {
        this.playbackAfterChange(eventIndex, rasterizer);
    }
    return this.events[eventIndex];
};

/**
 * Fix the bitmap by playback after changing the event at eventIndex.
 * @param {number} eventIndex Index of the first event to play back at minimum.
 * @param {BaseRasterizer} rasterizer The rasterizer to use to update the
 * bitmap.
 * @protected
 */
PictureBuffer.prototype.playbackAfterChange = function(eventIndex, rasterizer) {
    if (!this.events[0].undone) {
        var bBox = this.events[eventIndex].getBoundingBox(this.boundsRect);
        this.pushClipRect(bBox);
        this.invalidateUndoStatesFrom(eventIndex);
        var undoState = this.previousUndoState(eventIndex);
        this.applyState(undoState);
        this.playbackStartingFrom(undoState.index, rasterizer);
        this.popClip();
    }
    if (this.mergedTo !== null) {
        this.mergedTo.mergedBufferChanged(this, rasterizer);
    }
};

/**
 * Redo the undone event at the given index. The event's order does not change.
 * @param {number} eventIndex Event index in the buffer.
 * @param {BaseRasterizer} rasterizer The rasterizer to use to update the
 * bitmap.
 */
PictureBuffer.prototype.redoEventIndex = function(eventIndex, rasterizer) {
    if (!this.events[eventIndex].undone) {
        console.log('Tried to redo event that was not undone');
        return;
    }
    this.events[eventIndex].undone = false;
    if (this.events[eventIndex].eventType === 'bufferRemove') {
        ++this.removeCount;
    }
    if (eventIndex === this.events.length - 1) {
        // TODO: less conservative check for whether there's anything on top of
        // the event
        this.applyEvent(this.events[eventIndex], rasterizer);
        this.eventsChanged(rasterizer);
    } else {
        this.playbackAfterChange(eventIndex, rasterizer);
    }
    return;
};

/**
 * Remove the event at the given index.
 * @param {number} eventIndex Event index in the buffer.
 * @param {BaseRasterizer} rasterizer The rasterizer to use to update the
 * bitmap.
 */
PictureBuffer.prototype.removeEventIndex = function(eventIndex, rasterizer) {
    if (!this.events[eventIndex].undone) {
        // TODO: maybe a better way to handle merge events
        if (this.undoEventIndex(eventIndex, rasterizer, false)) {
            this.events.splice(eventIndex, 1);
        }
    } else {
        this.events.splice(eventIndex, 1);
    }
};

/**
 * @return {boolean} True if this buffer completely covers everything below when
 * compositing.
 */
PictureBuffer.prototype.isOpaque = function() {
    return !this.hasAlpha && this.opacity() === 1.0;
};

/**
 * @param {Rect} rect Rectangle to pick events from.
 * @return {Array.<PictureEvent>} Events mostly inside the given rect.
 */
PictureBuffer.prototype.pickEventsMostlyInside = function(rect) {
    var inside = [];
    for (var i = 1; i < this.events.length; ++i) {
        var bb = this.events[i].getBoundingBox(this.boundsRect);
        if (bb && !this.events[i].undone && bb.isMostlyInside(rect)) {
            inside.push(this.events[i]);
        }
    }
    return inside;
};

/**
 * @return {boolean} Whether this buffer should be considered removed.
 */
PictureBuffer.prototype.isRemoved = function() {
    return this.events[0].undone || this.removeCount > 0;
};

/**
 * @return {boolean} Whether this buffer should be composited.
 */
PictureBuffer.prototype.isComposited = function() {
    return this.visible && !this.isRemoved();
};


/**
 * A PictureBuffer implementation with a canvas backing for the bitmap.
 * @constructor
 * @param {BufferAddEvent} createEvent Event that initializes the buffer.
 * @param {number} width Width of the buffer in pixels. Must be an integer.
 * @param {number} height Height of the buffer in pixels. Must be an integer.
 * @param {boolean} hasUndoStates Does this buffer store undo states?
 */
var CanvasBuffer = function(createEvent, width, height, hasUndoStates) {
    this.initializePictureBuffer(createEvent, width, height, hasUndoStates);
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    this.blameRasterizer = new Rasterizer(width, height);
    this.insertEvent(createEvent, null); // will clear the buffer
};

CanvasBuffer.prototype = new PictureBuffer();

/**
 * @return {number} The width of the buffer in pixels.
 */
CanvasBuffer.prototype.width = function() {
    return this.canvas.width;
};

/**
 * @return {number} The height of the buffer in pixels.
 */
CanvasBuffer.prototype.height = function() {
    return this.canvas.height;
};

/**
 * Save an undo state.
 * @return {CanvasUndoState} The undo state.
 */
CanvasBuffer.prototype.saveUndoState = function() {
    return new CanvasUndoState(this.events.length, this.canvas);
};

/**
 * Apply the given undo state to the bitmap. Must be a real undo state.
 * @param {CanvasUndoState} undoState The undo state to apply.
 * @protected
 */
CanvasBuffer.prototype.applyStateObject = function(undoState) {
    undoState.draw(this.ctx, this.getCurrentClipRect());
};

/**
 * Clear the bitmap. Subject to the current clipping rectangle.
 * @param {Uint8Array|Array.<number>} clearColor The RGB(A) color to use when
 * clearing the buffer. Unpremultiplied and channel values are between 0-255.
 * @protected
 */
CanvasBuffer.prototype.clear = function(clearColor) {
    var br = this.getCurrentClipRect().getXYWH();
    if (clearColor.length === 4 && clearColor[3] < 255) {
        this.ctx.clearRect(br.x, br.y, br.w, br.h);
        this.opaque = false;
    } else if (br.w === this.width() && br.h === this.height() &&
               br.x === 0 && br.y === 0) {
        this.opaque = true;
    }
    if (clearColor.length === 4) {
        if (clearColor[3] !== 0) {
            this.ctx.fillStyle = cssUtil.rgbaString(clearColor);
            this.ctx.fillRect(br.x, br.y, br.w, br.h);
        }
    } else {
        this.ctx.fillStyle = cssUtil.rgbString(clearColor);
        this.ctx.fillRect(br.x, br.y, br.w, br.h);
    }
};

/**
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8ClampedArray} Unpremultiplied RGBA value.
 */
CanvasBuffer.prototype.getPixelRGBA = function(coords) {
    var imageData = this.ctx.getImageData(coords.x, coords.y, 1, 1);
    return imageData.data;
};

/**
 * Draw the given rasterizer's contents with the given color to the buffer's
 * bitmap.
 * @param {Rasterizer} raster The rasterizer to draw.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {PictureEvent.Mode} mode Blending mode to use for drawing.
 * @protected
 */
CanvasBuffer.prototype.drawRasterizerWithColor = function(raster, color,
                                                          opacity, mode) {
    CanvasBuffer.drawRasterizer(this.ctx, this.ctx, raster,
                                this.getCurrentClipRect(),
                                this.opaque, color, opacity, mode);
};

/**
 * Draw the given rasterizer's contents blended with the image from dataCtx to
 * targetCtx.
 * @param {CanvasRenderingContext2D} dataCtx Context to get the source data to
 * blend with.
 * @param {CanvasRenderingContext2D} targetCtx Target context to place the
 * blending result. May be the same as dataCtx, which effectively blends the
 * raster to the dataCtx.
 * @param {Rasterizer} raster The rasterizer to draw.
 * @param {Rect} clipRect Clipping rectangle to use for both dataCtx and
 * targetCtx.
 * @param {boolean} opaque Whether the target buffer should be treated as
 * opaque.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {PictureEvent.Mode} mode Blending mode to use for drawing.
 */
CanvasBuffer.drawRasterizer = function(dataCtx, targetCtx, raster, clipRect,
                                       opaque, color, opacity, mode) {
    var br = clipRect.getXYWH();
    if (br.w === 0 || br.h === 0) {
        return;
    }
    // TODO: assert(br.x >= 0 && br.y >= 0 && br.x + br.w <= this.width &&
    // br.y + br.h <= this.height);
    var targetData = dataCtx.getImageData(br.x, br.y, br.w, br.h);
    if (opaque &&
        (mode === PictureEvent.Mode.normal ||
         mode === PictureEvent.Mode.erase)) {
        raster.drawWithColorToOpaque(targetData, color, opacity,
                                     br.x, br.y, br.w, br.h);
    } else if (mode === PictureEvent.Mode.normal) {
        raster.drawWithColor(targetData, color, opacity,
                             br.x, br.y, br.w, br.h);
    } else if (mode === PictureEvent.Mode.erase) {
        raster.erase(targetData, opacity, br.x, br.y, br.w, br.h);
    } else if (mode === PictureEvent.Mode.multiply) {
        raster.multiply(targetData, color, opacity, br.x, br.y, br.w, br.h);
    } else if (mode === PictureEvent.Mode.screen) {
        raster.screen(targetData, color, opacity, br.x, br.y, br.w, br.h);
    }
    targetCtx.putImageData(targetData, br.x, br.y);
};

/**
 * Blend another buffer with this one.
 * @param {CanvasBuffer} buffer Buffer to blend.
 * @param {number} opacity Opacity to blend with.
 * @protected
 */
CanvasBuffer.prototype.drawBuffer = function(buffer, opacity) {
    // TODO: Should rather use the compositor for this, but it needs some API
    // changes.
    var br = this.getCurrentClipRect().getXYWH();
    if (br.w === 0 || br.h === 0) {
        return;
    }
    this.ctx.globalAlpha = opacity;
    this.ctx.drawImage(buffer.canvas, br.x, br.y, br.w, br.h,
                       br.x, br.y, br.w, br.h);
    this.ctx.globalAlpha = 1.0;
};


/**
 * A PictureBuffer implementation with a GL texture backing for the bitmap.
 * @constructor
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {GLCompositor} compositor The compositor to use for blends that are
 * not supported by blendFunc and merge operations.
 * @param {ShaderProgram} texBlitProgram Shader program to use for blits. Must
 * have uniform sampler uSrcTex for the source texture.
 * @param {BufferAddEvent} createEvent Event that initializes the buffer.
 * @param {number} width Width of the buffer in pixels. Must be an integer.
 * @param {number} height Height of the buffer in pixels. Must be an integer.
 * @param {boolean} hasUndoStates Does this buffer store undo states?
 */
var GLBuffer = function(gl, glManager, compositor, texBlitProgram, createEvent,
                        width, height, hasUndoStates) {
    this.texBlitProgram = texBlitProgram;
    this.texBlitUniforms = texBlitProgram.uniformParameters();
    this.initializePictureBuffer(createEvent, width, height, hasUndoStates);
    // Add undo states less often than the default, since drawing is cheap.
    this.undoStateInterval = 32;
    this.gl = gl;
    this.glManager = glManager;
    this.compositor = compositor;
    this.w = width;
    this.h = height;

    var format = this.hasAlpha ? gl.RGBA : gl.RGB;
    this.tex = glUtils.createTexture(this.gl, width, height, format);

    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !==
        this.gl.FRAMEBUFFER_COMPLETE) {
        console.log('Error: Unable to create WebGL FBO!');
    }

    this.blameRasterizer = new Rasterizer(this.w, this.h);
    this.insertEvent(createEvent, null); // will clear the buffer
};

GLBuffer.prototype = new PictureBuffer();

/**
 * Clean up any allocated resources. The picture buffer is not usable after
 * this.
 */
GLBuffer.prototype.free = function() {
    this.gl.deleteTexture(this.tex);
};

/**
 * @return {number} The width of the buffer in pixels.
 */
GLBuffer.prototype.width = function() {
    return this.w;
};

/**
 * @return {number} The height of the buffer in pixels.
 */
GLBuffer.prototype.height = function() {
    return this.h;
};

/**
 * Clear the bitmap. Subject to the current clipping rectangle.
 * @param {Uint8Array|Array.<number>} unPremulClearColor The RGB(A) color to use
 * when clearing the buffer. Unpremultiplied and channel values are between
 * 0-255.
 * @protected
 */
GLBuffer.prototype.clear = function(unPremulClearColor) {
    this.updateClip();
    this.glManager.useFboTex(this.tex);
    if (unPremulClearColor.length === 3) {
        this.gl.clearColor(unPremulClearColor[0] / 255.0,
                           unPremulClearColor[1] / 255.0,
                           unPremulClearColor[2] / 255.0,
                           1.0);
    } else {
        var clearColor = colorUtil.premultiply(unPremulClearColor);
        this.gl.clearColor(clearColor[0] / 255.0, clearColor[1] / 255.0,
                           clearColor[2] / 255.0, clearColor[3] / 255.0);
    }
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
};

/**
 * Set the current clipping rectangle as a scissor rectangle for GL.
 * @protected
 */
GLBuffer.prototype.updateClip = function() {
    glUtils.updateClip(this.gl, this.getCurrentClipRect(), this.height());
};

/**
 * Draw the given rasterizer's contents with the given color to the buffer's
 * bitmap.
 * @param {BaseRasterizer} raster The rasterizer to draw.
 * @param {Uint8Array|Array.<number>} color Color to use for drawing. Channel
 * values should be 0-255.
 * @param {number} opacity Opacity to use when drawing the rasterization result.
 * Opacity for each individual pixel is its rasterized opacity times this
 * opacity value.
 * @param {PictureEvent.Mode} mode Blending mode to use for drawing.
 * @protected
 */
GLBuffer.prototype.drawRasterizerWithColor = function(raster, color, opacity,
                                                      mode) {
    this.updateClip();
    if (mode === PictureEvent.Mode.normal || mode === PictureEvent.Mode.erase) {
        this.glManager.useFboTex(this.tex);
        raster.drawWithColor(color, opacity, mode);
    } else {
        // Copy into helper texture from this.tex, then use compositor to render
        // that blended with the contents of the rasterizer back to this.tex.
        var helper = glUtils.createTexture(this.gl, this.w, this.h);
        this.glManager.useFboTex(helper);
        this.texBlitUniforms.uSrcTex = this.tex;
        this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                          this.texBlitUniforms);

        this.glManager.useFboTex(this.tex);
        this.compositor.pushBufferTex(helper, 1.0, false);
        this.compositor.pushRasterizer(raster, color, opacity, mode, null);
        this.compositor.flush();
        this.gl.deleteTexture(helper);
    }
};

/**
 * Blend another buffer with this one.
 * @param {GLBuffer} buffer Buffer to blend.
 * @param {number} opacity Opacity to blend with.
 * @protected
 */
GLBuffer.prototype.drawBuffer = function(buffer, opacity) {
    this.updateClip();
    // Copy into helper texture from this.tex, then use compositor to render
    // that blended with the contents of the buffer back to this.tex.
    var helper = glUtils.createTexture(this.gl, this.w, this.h);
    this.glManager.useFboTex(helper);
    this.texBlitUniforms.uSrcTex = this.tex;
    this.glManager.drawFullscreenQuad(this.texBlitProgram,
                                      this.texBlitUniforms);
    this.glManager.useFboTex(this.tex);
    this.compositor.pushBufferTex(helper, 1.0, false);
    this.compositor.pushBufferTex(buffer.tex, opacity, false);
    this.compositor.flush();
    this.gl.deleteTexture(helper);
};

/**
 * Save an undo state.
 * @return {GLUndoState} The undo state.
 */
GLBuffer.prototype.saveUndoState = function() {
    return new GLUndoState(this.events.length, this.tex, this.gl,
                           this.glManager, this.texBlitProgram,
                           this.w, this.h, this.hasAlpha);
};

/**
 * Apply the given undo state to the bitmap. Must be a real undo state.
 * @param {GLUndoState} undoState The undo state to apply.
 * @protected
 */
GLBuffer.prototype.applyStateObject = function(undoState) {
    this.glManager.useFboTex(this.tex);
    undoState.draw(this.getCurrentClipRect());
};

/**
 * @param {Vec2} coords Position of the pixel in bitmap coordinates.
 * @return {Uint8ClampedArray} Unpremultiplied RGBA value.
 */
GLBuffer.prototype.getPixelRGBA = function(coords) {
    this.glManager.useFboTex(this.tex);
    var buffer = new ArrayBuffer(4);
    var pixelData = new Uint8Array(buffer);
    var glX = Math.min(Math.floor(coords.x), this.width() - 1);
    var glY = Math.max(0, this.height() - 1 - Math.floor(coords.y));
    this.gl.readPixels(glX, glY, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE,
                       pixelData);
    pixelData = colorUtil.unpremultiply(pixelData);
    return pixelData;
};
