/*
 * Copyright Olli Etuaho 2012-2013.
 */

/**
 * Draw state for a brush event. Used to resume drawTo() from a point along
 * the brush stroke.
 * @constructor
 * @param {number} coordsInd Index in the coords array. Must be an integer.
 */
var BrushEventState = function(coordsInd) {
    if (coordsInd === undefined) {
        coordsInd = 0;
    }
    this.coordsInd = coordsInd;
};

/**
 * Draw state for a gradient event. Used to determine whether a gradient is
 * already drawn in a rasterizer.
 * @constructor
 */
var GradientEventState = function() {
    this.drawn = false;
};

/**
 * An event that is a part of the picture buffer's state.
 * @constructor
 * @param {string} eventType A short identifier for the type of the event. May
 * not contain spaces.
 */
var PictureEvent = function(eventType) {
    // TODO: Assert no spaces in eventType.
    this.eventType = eventType;
};

/**
 * @return {string} A serialization of the event.
 */
PictureEvent.prototype.serializePictureEvent = function() {
    return this.eventType + ' ' + this.sid + ' ' + this.sessionEventId + ' ' +
           (this.undone ? '1' : '0');
};

/**
 * Parse a PictureEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @return {PictureEvent} The parsed event or null.
 */
PictureEvent.parse = function(arr, i, version) {
    var eventType = arr[i++];
    var sid = parseInt(arr[i++]);
    var sessionEventId = parseInt(arr[i++]);
    var undone = (parseInt(arr[i++]) !== 0);
    if (eventType === 'brush') {
        return BrushEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'scatter') {
        return ScatterEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'gradient') {
        return GradientEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'rasterImport') {
        return RasterImportEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'bufferMerge') {
        return BufferMergeEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'bufferAdd') {
        return BufferAddEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'bufferRemove') {
        return BufferRemoveEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'bufferMove') {
        return BufferMoveEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else if (eventType === 'eventHide') {
        return EventHideEvent.parse(arr, i, version, sid, sessionEventId, undone);
    } else {
        console.log('Unexpected picture event type ' + eventType);
        return null;
    }
};

/**
 * Create an identical copy of the given PictureEvent.
 * @param {PictureEvent} event Event to copy.
 * @return {PictureEvent} A copy of the event.
 */
PictureEvent.copy = function(event) {
    return PictureEvent.parse(event.serialize(1.0).split(' '), 0,
                              Picture.formatVersion);
};

/**
 * Determine whether this event's bounding box intersects with the given
 * rectangle.
 * @param {Rect} rect The rectangle to intersect with.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @return {boolean} Does the event's axis-aligned bounding box intersect the
 * given rectangle?
 */
PictureEvent.prototype.boundsIntersectRect = function(rect, transform) {
    return this.getBoundingBox(rect, transform).intersectsRectRoundedOut(rect);
};

/**
 * @return {boolean} Whether the event is a buffer stack change.
 */
PictureEvent.prototype.isBufferStackChange = function() {
    return false;
};

/**
 * Scale this event.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
PictureEvent.prototype.scale = function(scale) {};

/**
 * @enum {number}
 */
PictureEvent.Mode = {
    erase: 0,
    normal: 1,
    multiply: 2,
    screen: 3,
    overlay: 4,
    hardlight: 5,
    softlight: 6,
    darken: 7,
    lighten: 8,
    difference: 9,
    exclusion: 10,
    colorburn: 11,
    linearburn: 12,
    vividlight: 13,
    linearlight: 14,
    pinlight: 15,
    colordodge: 16,
    lineardodge: 17
};

/**
 * Generate a constructor for an event conforming to the brush event format.
 * @param {boolean} needsTipMovers True if needs brush tip movement interpolation.
 * @return {function(number, number, boolean, Uint8Array|Array.<number>, number,
 * number, number, number, number, PictureEvent.Mode)} Constructor for the event.
 */
var brushEventConstructor = function(needsTipMovers) {
    return function(sid, sessionEventId, undone, color, flow, opacity, radius, textureId,
                    softness, mode) {
        // TODO: assert(color.length == 3);
        this.undone = undone;
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.color = color;
        this.flow = flow;
        this.opacity = opacity;
        this.radius = radius;
        this.coords = []; // holding x,y,pressure triplets
        this.boundingBoxRasterizer = new BrushEvent.BBRasterizer();
        this.textureId = textureId; // Id 0 is a circle, others are bitmap textures.
        this.soft = softness > 0.5;
        this.mode = mode;
        this.hideCount = 0;
        this.generation = 0;
        if (needsTipMovers) {
            this.bbTip = new BrushTipMover(true);
            this.brushTip = new BrushTipMover(true);
        }
    };
};

/**
 * A PictureEvent representing a brush stroke.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {Uint8Array|Array.<number>} color The RGB color of the stroke. Channel
 * values are between 0-255.
 * @param {number} flow Alpha value controlling blending individual brush
 * samples (circles) to each other in the rasterizer. Range 0 to 1. Normalized
 * to represent the resulting maximum alpha value in the rasterizer's bitmap in
 * case of a straight stroke and the maximum pressure.
 * @param {number} opacity Alpha value controlling blending the rasterizer
 * stroke to the target buffer. Range 0 to 1.
 * @param {number} radius The stroke radius in pixels.
 * @param {number} textureId Id of the brush tip shape texture. 0 is a circle, others are bitmap textures.
 * @param {number} softness Value controlling the softness. Range 0 to 1.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 */
var BrushEvent = brushEventConstructor(true);

BrushEvent.prototype = new PictureEvent('brush');

/**
 * @const
 * @protected
 */
BrushEvent.coordsStride = 3; // x, y and pressure coordinates belong together

/**
 * @return {string} A serialization of the event.
 */
BrushEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + colorUtil.serializeRGB(this.color);
    eventMessage += ' ' + this.flow + ' ' + this.opacity;
    eventMessage += ' ' + this.radius;
    eventMessage += ' ' + this.textureId;
    if (this.soft) {
        eventMessage += ' 1.0';
    } else {
        eventMessage += ' 0.0';
    }
    eventMessage += ' ' + this.mode;
    eventMessage += this.serializeCoords();
    return eventMessage;
};

/**
 * @return {string} A serialization of the coordinates.
 */
BrushEvent.prototype.serializeCoords = function() {
    var eventCoordsMessage = '';
    var i = 0;
    while (i < this.coords.length) {
        eventCoordsMessage += ' ' + this.coords[i++];
        eventCoordsMessage += ' ' + this.coords[i++];
        eventCoordsMessage += ' ' + this.coords[i++];
    }
    return eventCoordsMessage;
};

/**
 * Generate a parser for an event conforming to the brush event format.
 * @param {function(number, number, boolean, Uint8Array|Array.<number>, number,
 * number, number, number, PictureEvent.Mode)} constructor Constructor for the
 * parsed object.
 * @return {function(Array.<string>, number, number, number, number, boolean)}
 * Parse function.
 */
var brushEventParser = function(constructor) {
    return function(arr, i, version, sid, sessionEventId, undone) {
        var color = [];
        color[0] = parseInt(arr[i++]);
        color[1] = parseInt(arr[i++]);
        color[2] = parseInt(arr[i++]);
        var flow = parseFloat(arr[i++]);
        var opacity = parseFloat(arr[i++]);
        var radius = parseFloat(arr[i++]);
        var textureId = 0;
        if (version > 1) {
            textureId = parseInt(arr[i++]);
        }
        var softness = parseFloat(arr[i++]);
        var mode = parseInt(arr[i++]);
        var pictureEvent = new constructor(sid, sessionEventId, undone, color,
                                           flow, opacity, radius, textureId, softness,
                                           mode);
        pictureEvent.parseCoords(arr, i, version);
        return pictureEvent;
    };
};

/**
 * Parse a BrushEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {BrushEvent} The parsed event or null.
 */
BrushEvent.parse = brushEventParser(BrushEvent);

/**
 * Parse BrushEvent coordinates from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BrushEvent.prototype.parseCoords = function(arr, i, version) {
    while (i <= arr.length - BrushEvent.coordsStride) {
        var x = parseFloat(arr[i++]);
        var y = parseFloat(arr[i++]);
        var pressure = parseFloat(arr[i++]);
        this.pushCoordTriplet(x, y, pressure);
    }
};

/**
 * Add a triplet of coordinates to the brush stroke. The stroke will travel
 * through this control point.
 * @param {number} x The x coordinate of the stroke control point.
 * @param {number} y The y coordinate of the stroke control point.
 * @param {number} pressure Used as a multiplier for stroke radius at this
 * point. Must be larger than zero.
 */
BrushEvent.prototype.pushCoordTriplet = function(x, y, pressure) {
    // Limit pressure to 5 decimals to cut on file size a bit. This rounding
    // method should be okay as long as pressure stays within reasonable bounds.
    pressure = Math.round(pressure * 100000) / 100000;
    if (this.coords.length > 0) {
        if (x === this.coords[this.coords.length - BrushEvent.coordsStride] &&
          y === this.coords[this.coords.length - BrushEvent.coordsStride - 1]) {
            return;
            // TODO: Possible to do something smarter if only pressure changes?
            // Drawing small strokes in place would benefit from that.
            // Also needs changes in drawing.
        }
    }
    this.coords.push(x);
    this.coords.push(y);
    this.coords.push(pressure);
};

/**
 * Scale this event. This will change the coordinates of the stroke.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
BrushEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.radius *= scale;
    for (var i = 0; i < this.coords.length; ++i) {
        if (i % BrushEvent.coordsStride < 2) {
            this.coords[i] *= scale;
        }
    }
    ++this.generation; // This invalidates any rasterizers (including BBRasterizer) which have this event cached.
};

/**
 * Translate this event. This will change the coordinates of the stroke.
 * @param {Vec2} offset The vector to translate with.
 */
BrushEvent.prototype.translate = function(offset) {
    for (var i = 0; i < this.coords.length; ++i) {
        if (i % BrushEvent.coordsStride === 0) {
            this.coords[i] += offset.x;
        } else if (i % BrushEvent.coordsStride === 1) {
            this.coords[i] += offset.y;
        }
    }
    ++this.generation; // This invalidates any real rasterizers which have this event cached.
    this.boundingBoxRasterizer.translate(offset, this.generation);
};

/**
 * Normalize pressure to the range 0 to 1. Adjusts the radius accordingly.
 */
BrushEvent.prototype.normalizePressure = function() {
    var i;
    var maxPressure = 0;
    for (i = 0; i < this.coords.length; i += BrushEvent.coordsStride) {
        if (this.coords[i + 2] > maxPressure) {
            maxPressure = this.coords[i + 2];
        }
    }
    if (maxPressure <= 1.0) {
        return;
    }
    for (i = 0; i < this.coords.length; i += BrushEvent.coordsStride) {
        this.coords[i + 2] = Math.round(this.coords[i + 2] / maxPressure * 100000) / 100000;
    }
    this.scaleRadiusPreservingFlow(maxPressure);
    ++this.generation;
};

/**
 * Scale radius while preserving the stroke's appearance.
 * @param {number} radiusScale Multiplier for radius.
 */
BrushEvent.prototype.scaleRadiusPreservingFlow = function(radiusScale) {
    var nBlends = Math.ceil(this.radius * 2);
    var drawAlpha = colorUtil.alphaForNBlends(this.flow, nBlends);
    this.radius *= radiusScale;
    nBlends = Math.ceil(this.radius * 2);
    this.flow = colorUtil.nBlends(drawAlpha, nBlends);
};

/**
 * A rasterizer that does not rasterize, but computes bounding boxes for a brush
 * event. Only implements functions necessary for drawing a brush event.
 * @constructor
 */
BrushEvent.BBRasterizer = function() {
    this.state = null;
    this.boundingBox = null;
    this.generation = -1;
};

/**
 * Clear the bounding box.
 */
BrushEvent.BBRasterizer.prototype.clearDirty = function() {
    this.state = null;
    this.boundingBox = null;
};

/**
 * Get draw event state for the given event.
 * @param {BrushEvent} event The event to be rasterized.
 * @param {function()} stateConstructor Constructor for creating a new draw
 * event state object unless the event already has been rasterized to this
 * rasterizer's bitmap.
 * @return {Object} Draw event state for the given event.
 */
BrushEvent.BBRasterizer.prototype.getDrawEventState = function(event, stateConstructor) {
    if (this.boundingBox === null || event.generation !== this.generation) {
        this.state = new stateConstructor();
        this.boundingBox = new Rect();
        this.generation = event.generation;
    }
    return this.state;
};

/**
 * Do nothing.
 */
BrushEvent.BBRasterizer.prototype.beginCircles = function() {};

/**
 * Add a circle to the bounding box.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 * @param {number} flowAlpha The flow alpha. Unused.
 * @param {number} rotation Rotation of the circle texture in radians. Unused.
 */
BrushEvent.BBRasterizer.prototype.fillCircle = function(centerX, centerY, radius, flowAlpha, rotation) {
    this.boundingBox.unionCircle(centerX, centerY, Math.max(radius, 1.0) + 1.0);
};

/**
 * Translate the bounding box.
 * @param {Vec2} offset Amount to translate with.
 * @param {number} generation Generation to set in case bounding box can be updated.
 */
BrushEvent.BBRasterizer.prototype.translate = function(offset, generation) {
    if (this.boundingBox !== null && this.generation === generation - 1) {
        this.boundingBox.left += offset.x;
        this.boundingBox.right += offset.x;
        this.boundingBox.top += offset.y;
        this.boundingBox.bottom += offset.y;
        this.generation = generation;
    }
};

/**
 * Do nothing.
 */
BrushEvent.BBRasterizer.prototype.flushCircles = function() {};

/**
 * Draw the brush event to the given rasterizer's bitmap.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @param {number} untilCoord Maximum coordinate index to draw + 1.
 */
BrushEvent.prototype.drawTo = function(rasterizer, transform, untilCoord) {
    var drawState = rasterizer.getDrawEventState(this, BrushEventState);
    // Use different tips for BB and normal drawing to avoid clearing the rasterizer all the time while drawing
    var brushTip = rasterizer === this.boundingBoxRasterizer ? this.bbTip : this.brushTip;
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    }
    // TODO: Reset also if transform has changed
    if (drawState.coordsInd > untilCoord || brushTip.target !== rasterizer) {
        rasterizer.clearDirty();
        drawState = rasterizer.getDrawEventState(this, BrushEventState);
    }
    // TODO: assert(this.coords.length % BrushEvent.coordsStride === 0);
    // TODO: assert(untilCoord % BrushEvent.coordsStride === 0);

    var i = drawState.coordsInd;

    if (i === 0) {
        rasterizer.beginCircles(this.soft, this.textureId);
        var x = this.coords[i++];
        var y = this.coords[i++];
        var pressure = this.coords[i++];
        brushTip.reset(rasterizer, transform, x, y, pressure, this.radius, this.flow, 0, 1, false,
                       BrushTipMover.Rotation.off);
    }

    while (i + BrushEvent.coordsStride <= untilCoord) {
        var x = this.coords[i++];
        var y = this.coords[i++];
        var pressure = this.coords[i++];
        brushTip.move(x, y, pressure);
    }
    drawState.coordsInd = i;
    rasterizer.flushCircles();
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
BrushEvent.prototype.getBoundingBox = function(clipRect, transform) {
    this.drawTo(this.boundingBoxRasterizer, transform);
    return this.boundingBoxRasterizer.boundingBox;
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
BrushEvent.prototype.isRasterized = function() {
    return true;
};


/**
 * A PictureEvent representing a bunch of individually positioned circles.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {Uint8Array|Array.<number>} color The RGB color of the event. Channel
 * values are between 0-255.
 * @param {number} flow Alpha value controlling blending individual brush
 * samples (circles) to each other in the rasterizer. Range 0 to 1.
 * @param {number} opacity Alpha value controlling blending the rasterizer
 * data to the target buffer. Range 0 to 1.
 * @param {number} radius The stroke radius in pixels.
 * @param {number} textureId Id of the brush tip shape texture. 0 is a circle, others are bitmap textures.
 * @param {number} softness Value controlling the softness. Range 0 to 1.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 */
var ScatterEvent = brushEventConstructor(false);

/**
 * @const
 * @protected
 */
ScatterEvent.coordsStride = 5; // x, y, radius, flow and rotation coordinates belong together

ScatterEvent.prototype = new PictureEvent('scatter');

/** @inheritDoc */
ScatterEvent.prototype.serialize = BrushEvent.prototype.serialize;

/**
 * @return {string} A serialization of the coordinates.
 */
ScatterEvent.prototype.serializeCoords = function() {
    var eventCoordsMessage = '';
    var i = 0;
    while (i < this.coords.length) {
        eventCoordsMessage += ' ' + this.coords[i++];
        eventCoordsMessage += ' ' + this.coords[i++];
        eventCoordsMessage += ' ' + this.coords[i++]; // radius
        eventCoordsMessage += ' ' + this.coords[i++]; // flow
        eventCoordsMessage += ' ' + this.coords[i++]; // rotation
    }
    return eventCoordsMessage;
};

/**
 * Parse a ScatterEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {ScatterEvent} The parsed event or null.
 */
ScatterEvent.parse = brushEventParser(ScatterEvent);

/**
 * Parse ScatterEvent coordinates from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
ScatterEvent.prototype.parseCoords = function(arr, i, version) {
    while (i <= arr.length - ScatterEvent.coordsStride) {
        var x = parseFloat(arr[i++]);
        var y = parseFloat(arr[i++]);
        var pressure = parseFloat(arr[i++]);
        if (version >= 4) {
            var flow = parseFloat(arr[i++]);
            var rotation = parseFloat(arr[i++]);
            // pressure interpreted as radius
            this.fillCircle(x, y, pressure, flow, rotation);
        } else {
            this.fillCircle(x, y, pressure * this.radius, this.flow, 0);
        }
    }
};


/**
 * Scale this event. This will change the coordinates of the stroke.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
ScatterEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.radius *= scale;
    for (var i = 0; i < this.coords.length; ++i) {
        if (i % ScatterEvent.coordsStride < 3) {
            this.coords[i] *= scale;
        }
    }
    ++this.generation; // This invalidates any rasterizers (including BBRasterizer) which have this event cached.
};

/**
 * Translate this event. This will change the coordinates of the stroke.
 * @param {Vec2} offset The vector to translate with.
 */
ScatterEvent.prototype.translate = function(offset) {
    for (var i = 0; i < this.coords.length; ++i) {
        if (i % ScatterEvent.coordsStride === 0) {
            this.coords[i] += offset.x;
        } else if (i % ScatterEvent.coordsStride === 1) {
            this.coords[i] += offset.y;
        }
    }
    ++this.generation; // This invalidates any real rasterizers which have this event cached.
    this.boundingBoxRasterizer.translate(offset, this.generation);
};

/** @inheritDoc */
ScatterEvent.prototype.getBoundingBox = BrushEvent.prototype.getBoundingBox;

/**
 * Draw the brush event to the given rasterizer's bitmap.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @param {number} untilCoord Maximum coordinate index to draw + 1.
 */
ScatterEvent.prototype.drawTo = function(rasterizer, transform, untilCoord) {
    var drawState = rasterizer.getDrawEventState(this, BrushEventState);
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    } else {
        if (drawState.coordsInd > untilCoord) {
            rasterizer.clearDirty();
            drawState = rasterizer.getDrawEventState(this, BrushEventState);
        }
    }
    var i = drawState.coordsInd;
    if (i === 0) {
        rasterizer.beginCircles(this.soft, this.textureId);
    }
    while (i + ScatterEvent.coordsStride <= untilCoord) {
        var x = this.coords[i++];
        var y = this.coords[i++];
        var radius = this.coords[i++];
        var flow = this.coords[i++];
        var rotation = this.coords[i++];
        rasterizer.fillCircle(transform.transformX(x, y),
                              transform.transformY(x, y),
                              transform.scaleValue(radius),
                              flow, rotation);
    }
    drawState.coordsInd = i;
    rasterizer.flushCircles();
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
ScatterEvent.prototype.isRasterized = function() {
    return true;
};

/**
 * Add coordinates for a circle.
 * @param {number} x The x center of the circle.
 * @param {number} y The y center of the circle.
 * @param {number} radius Radius of the circle.
 * @param {number} flow Alpha value for the circle.
 * @param {number} rotation Rotation of the circle texture in radians.
 */
ScatterEvent.prototype.fillCircle = function(x, y, radius, flow, rotation) {
    this.coords.push(x);
    this.coords.push(y);
    this.coords.push(radius);
    this.coords.push(flow);
    this.coords.push(rotation);
};


/**
 * A PictureEvent representing a gradient.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {Uint8Array|Array.<number>} color The RGB color of the gradient.
 * Channel values are between 0-255.
 * @param {number} opacity Alpha value controlling blending the rasterizer
 * stroke to the target buffer. Range 0 to 1.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 */
var GradientEvent = function(sid, sessionEventId, undone, color, opacity,
                             mode) {
    // TODO: assert(color.length == 3);
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.color = color;
    this.opacity = opacity;
    this.coords0 = new Vec2(0, 0);
    this.coords1 = new Vec2(1, 1);
    this.mode = mode;
    this.hideCount = 0;
    this.generation = 0;
};

GradientEvent.prototype = new PictureEvent('gradient');

/**
 * Parse a GradientEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {GradientEvent} The parsed event or null.
 */
GradientEvent.parse = function(arr, i, version, sid, sessionEventId, undone) {
    var color = [];
    color[0] = parseInt(arr[i++]);
    color[1] = parseInt(arr[i++]);
    color[2] = parseInt(arr[i++]);
    var opacity = parseFloat(arr[i++]);
    var mode = parseInt(arr[i++]);
    var pictureEvent = new GradientEvent(sid, sessionEventId, undone, color,
                                         opacity, mode);
    pictureEvent.coords0.x = parseFloat(arr[i++]);
    pictureEvent.coords0.y = parseFloat(arr[i++]);
    pictureEvent.coords1.x = parseFloat(arr[i++]);
    pictureEvent.coords1.y = parseFloat(arr[i++]);
    return pictureEvent;
};

/**
 * @return {string} A serialization of the event.
 */
GradientEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + colorUtil.serializeRGB(this.color);
    eventMessage += ' ' + this.opacity;
    eventMessage += ' ' + this.mode;
    var i = 0;
    eventMessage += ' ' + this.coords0.x;
    eventMessage += ' ' + this.coords0.y;
    eventMessage += ' ' + this.coords1.x;
    eventMessage += ' ' + this.coords1.y;
    return eventMessage;
};

/**
 * Scale this event. This will change the coordinates of the gradient.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
GradientEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.coords0.x *= scale;
    this.coords0.y *= scale;
    this.coords1.x *= scale;
    this.coords1.y *= scale;
    ++this.generation; // This invalidates any rasterizers which have this event cached.
};

/**
 * Translate this event. This will change the coordinates of the gradient.
 * @param {Vec2} offset The vector to translate with.
 */
GradientEvent.prototype.translate = function(offset) {
    this.coords0.x += offset.x;
    this.coords0.y += offset.y;
    this.coords1.x += offset.x;
    this.coords1.y += offset.y;
    ++this.generation; // This invalidates any rasterizers which have this event cached.
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
GradientEvent.prototype.getBoundingBox = function(clipRect, transform) {
    var boundingBox = new Rect(clipRect.left, clipRect.right,
                               clipRect.top, clipRect.bottom);
    var coords0 = new Vec2();
    var coords1 = new Vec2();
    coords0.setVec2(this.coords0);
    coords1.setVec2(this.coords1);
    transform.transform(coords0);
    transform.transform(coords1);
    if (coords0.y === coords1.y) {
        if (coords1.x > coords0.x) {
            boundingBox.limitLeft(coords0.x - 1);
        } else if (coords1.x < coords0.x) {
            boundingBox.limitRight(coords0.x + 1);
        } else {
            boundingBox.makeEmpty();
        }
    } else {
        // y = slope * x + b
        var normalSlope = -1.0 / coords0.slope(coords1);
        var normalB = coords0.y - normalSlope * coords0.x;
        if (normalSlope === 0.0) {
            if (coords0.y < coords1.y) {
                boundingBox.limitTop(coords0.y - 1);
            } else {
                boundingBox.limitBottom(coords0.y + 1);
            }
        } else if (normalSlope < 0 && coords1.y < coords0.y) {
            // the covered area is in the top left corner
            // intersection with left edge
            boundingBox.limitBottom(normalSlope * boundingBox.left +
                                    normalB + 1);
            // intersection with top edge
            boundingBox.limitRight((boundingBox.top - normalB) /
                                   normalSlope + 1);
        } else if (normalSlope > 0 && coords1.y < coords0.y) {
            // the covered area is in the top right corner
            // intersection with right edge
            boundingBox.limitBottom(normalSlope * boundingBox.right +
                                    normalB + 1);
            // intersection with top edge
            boundingBox.limitLeft((boundingBox.top - normalB) /
                                  normalSlope - 1);
        } else if (normalSlope < 0 && coords1.y > coords0.y) {
            // the covered area is in the bottom right corner
            // intersection with right edge
            boundingBox.limitTop(normalSlope * boundingBox.right + normalB - 1);
            // intersection with bottom edge
            boundingBox.limitLeft((boundingBox.bottom - normalB) /
                                  normalSlope - 1);
        } else {
            // TODO: assert(normalSlope > 0 && coords1.y > coords0.y);
            // the covered area is in the bottom left corner
            // intersection with left edge
            boundingBox.limitTop(normalSlope * boundingBox.left + normalB - 1);
            // intersection with bottom edge
            boundingBox.limitRight((boundingBox.bottom - normalB) /
                                   normalSlope + 1);
        }
    }
    return boundingBox;
};

/**
 * Draw the GradientEvent to the given rasterizer's bitmap.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @param {AffineTransform} transform Transform for the event coordinates.
 */
GradientEvent.prototype.drawTo = function(rasterizer, transform) {
    var drawState = rasterizer.getDrawEventState(this, GradientEventState);
    if (drawState.drawn) {
        return;
    }
    var coords0 = new Vec2();
    var coords1 = new Vec2();
    coords0.setVec2(this.coords0);
    coords1.setVec2(this.coords1);
    transform.transform(coords0);
    transform.transform(coords1);
    rasterizer.linearGradient(coords1, coords0);
    drawState.drawn = true;
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
GradientEvent.prototype.isRasterized = function() {
    return true;
};


/**
 * Event that adds an imported raster image into a buffer.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {HTMLImageElement} importedImage The imported image.
 * @param {Rect} rect Rectangle defining the position and scale of the imported image in the buffer.
 */
var RasterImportEvent = function(sid, sessionEventId, undone, importedImage, rect) {
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;

    this.importedImage = document.createElement('img');
    this.loaded = false;
    var that = this;
    this.importedImage.onload = function() {
        that.loaded = true;
    };
    if (importedImage.src.substring(0, 4) === 'data') {
        this.importedImage.src = importedImage.src;
    } else {
        var c = document.createElement('canvas');
        c.width = importedImage.width;
        c.height = importedImage.height;
        var ctx = c.getContext('2d');
        ctx.drawImage(importedImage, 0, 0);
        this.importedImage.src = c.toDataURL();
    }
    this.rect = rect;
};

RasterImportEvent.prototype = new PictureEvent('rasterImport');

/**
 * Parse a RasterImportEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {GradientEvent} The parsed event or null.
 */
RasterImportEvent.parse = function(arr, i, version, sid, sessionEventId, undone) {
    var importedImage = document.createElement('img');
    importedImage.src = arr[i++]; // data URI
    var left = parseFloat(arr[i++]);
    var right = parseFloat(arr[i++]);
    var top = parseFloat(arr[i++]);
    var bottom = parseFloat(arr[i++]);
    var rect = new Rect(left, right, top, bottom);
    return new RasterImportEvent(sid, sessionEventId, undone, importedImage, rect);
};

/**
 * @return {string} A serialization of the event.
 */
RasterImportEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + this.importedImage.src;
    eventMessage += ' ' + this.rect.left;
    eventMessage += ' ' + this.rect.right;
    eventMessage += ' ' + this.rect.top;
    eventMessage += ' ' + this.rect.bottom;
    return eventMessage;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
RasterImportEvent.prototype.getBoundingBox = function(clipRect) {
    var bbRect = new Rect();
    bbRect.setRect(this.rect);
    return bbRect;
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
RasterImportEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * Scale this event. This will change the coordinates of the bitmap.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
RasterImportEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.rect.scale(scale);
};

/**
 * Translate this event. This will change the coordinates of the bitmap.
 * @param {Vec2} offset The vector to translate with.
 */
RasterImportEvent.prototype.translate = function(offset) {
    this.rect.translate(offset);
};


/**
 * Event that adds a buffer into a Picture.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {number} bufferId Id of the added buffer. Unique at the Picture level.
 * Should be an integer >= 0.
 * @param {boolean} hasAlpha Whether the buffer has an alpha channel.
 * @param {Uint8Array|Array.<number>} clearColor The RGB(A) color used to clear
 * the buffer. Channel values are integers between 0-255.
 * @param {number} opacity Alpha value controlling compositing the buffer. Range
 * 0 to 1.
 * @param {number} insertionPoint Insertion point for the added buffer. Only
 * taken into account when the whole picture containing this buffer is parsed or
 * serialized.
 */
var BufferAddEvent = function(sid, sessionEventId, undone, bufferId, hasAlpha,
                              clearColor, opacity, insertionPoint) {
    // TODO: assert(clearColor.length === (hasAlpha ? 4 : 3));
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.bufferId = bufferId;
    this.hasAlpha = hasAlpha;
    this.clearColor = clearColor;
    this.opacity = opacity;

    // TODO: storing this is necessary for restoring complete picture state,
    // but might not really logically belong in the add event.
    // Note that this is not used when the event is pushed to a picture the
    // usual way, only when a whole picture is parsed / serialized!
    this.insertionPoint = insertionPoint;
};

BufferAddEvent.prototype = new PictureEvent('bufferAdd');

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
BufferAddEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * @return {boolean} Whether the event is a buffer stack change.
 */
BufferAddEvent.prototype.isBufferStackChange = function() {
    return true;
};

/**
 * Parse a BufferAddEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {BufferAddEvent} The parsed event or null.
 */
BufferAddEvent.parse = function(arr, i, version, sid, sessionEventId, undone) {
    var bufferId = parseInt(arr[i++]);
    var hasAlpha = arr[i++] === '1';
    var clearColor = [];
    clearColor[0] = parseInt(arr[i++]);
    clearColor[1] = parseInt(arr[i++]);
    clearColor[2] = parseInt(arr[i++]);
    if (hasAlpha) {
        clearColor[3] = parseInt(arr[i++]);
    }
    var opacity = parseFloat(arr[i++]);
    var insertionPoint = parseInt(arr[i++]);
    var pictureEvent = new BufferAddEvent(sid, sessionEventId, undone, bufferId,
                                          hasAlpha, clearColor, opacity,
                                          insertionPoint);
    return pictureEvent;
};

/**
 * @return {string} A serialization of the event.
 */
BufferAddEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + this.bufferId;
    eventMessage += ' ' + (this.hasAlpha ? '1' : '0');
    if (this.hasAlpha) {
        eventMessage += ' ' + colorUtil.serializeRGBA(this.clearColor);
    } else {
        eventMessage += ' ' + colorUtil.serializeRGB(this.clearColor);
    }
    eventMessage += ' ' + this.opacity;
    eventMessage += ' ' + this.insertionPoint;
    return eventMessage;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
BufferAddEvent.prototype.getBoundingBox = function(clipRect) {
    return new Rect(clipRect.left, clipRect.right,
                    clipRect.top, clipRect.bottom);
};

/**
 * Event that removes a buffer from a Picture.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {number} bufferId Id of the removed buffer.
 */
var BufferRemoveEvent = function(sid, sessionEventId, undone, bufferId) {
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.bufferId = bufferId;
};

BufferRemoveEvent.prototype = new PictureEvent('bufferRemove');

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
BufferRemoveEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * @return {boolean} Whether the event is a buffer stack change.
 */
BufferRemoveEvent.prototype.isBufferStackChange = function() {
    return true;
};

/**
 * Parse a BufferRemoveEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {BufferRemoveEvent} The parsed event or null.
 */
BufferRemoveEvent.parse = function(arr, i, version, sid, sessionEventId,
                                   undone) {
    var bufferId = parseInt(arr[i++]);
    var pictureEvent = new BufferRemoveEvent(sid, sessionEventId, undone,
                                             bufferId);
    return pictureEvent;
};

/**
 * @return {string} A serialization of the event.
 */
BufferRemoveEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + this.bufferId;
    return eventMessage;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
BufferRemoveEvent.prototype.getBoundingBox = function(clipRect) {
    return new Rect(clipRect.left, clipRect.right,
                    clipRect.top, clipRect.bottom);
};


/**
 * Event that moves a buffer to a different position in the Picture stack.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {number} movedId Id of the moved buffer.
 * @param {number} fromIndex Index where the buffer was moved from. Only used
 * for undo.
 * @param {number} toIndex Index where the buffer is being moved to.
 */
var BufferMoveEvent = function(sid, sessionEventId, undone, movedId, fromIndex,
                               toIndex) {
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.movedId = movedId;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
};

BufferMoveEvent.prototype = new PictureEvent('bufferMove');

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
BufferMoveEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * @return {boolean} Whether the event is a buffer stack change.
 */
BufferMoveEvent.prototype.isBufferStackChange = function() {
    return true;
};

/**
 * Parse a BufferMoveEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {BufferMoveEvent} The parsed event or null.
 */
BufferMoveEvent.parse = function(arr, i, version, sid, sessionEventId, undone) {
    var movedId = parseInt(arr[i++]);
    var fromIndex = parseInt(arr[i++]);
    var toIndex = parseInt(arr[i++]);
    var pictureEvent = new BufferMoveEvent(sid, sessionEventId, undone,
                                           movedId, fromIndex, toIndex);
    return pictureEvent;
};

/**
 * @return {string} A serialization of the event.
 */
BufferMoveEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + this.movedId;
    eventMessage += ' ' + this.fromIndex;
    eventMessage += ' ' + this.toIndex;
    return eventMessage;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
BufferMoveEvent.prototype.getBoundingBox = function(clipRect) {
    return new Rect(clipRect.left, clipRect.right,
                    clipRect.top, clipRect.bottom);
};


/**
 * Event that draws a merged buffer's contents to a target buffer, and also
 * removes the merged buffer from the main buffer stack. This is different from
 * simply pushing the merged buffer's events on top of the target buffer, rather
 * the merged buffer's contents are first composited together independent of the
 * target buffer.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {number} opacity Alpha value controlling blending the merged buffer to
 * the target buffer. Range 0 to 1.
 * @param {CanvasBuffer|GLBuffer} mergedBuffer The merged buffer.
 */
var BufferMergeEvent = function(sid, sessionEventId, undone, opacity, mergedBuffer) {
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.opacity = opacity;
    this.mergedBuffer = mergedBuffer;
};

BufferMergeEvent.prototype = new PictureEvent('bufferMerge');

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
BufferMergeEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * @return {boolean} Whether the event is a buffer stack change.
 */
BufferMergeEvent.prototype.isBufferStackChange = function() {
    return true;
};

/**
 * Parse a BufferMergeEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {BufferMergeEvent} The parsed event or null.
 */
BufferMergeEvent.parse = function(arr, i, version, sid, sessionEventId,
                                  undone) {
    var opacity = parseFloat(arr[i++]);
    var mergedBufferId = parseInt(arr[i++]);
    var pictureEvent = new BufferMergeEvent(sid, sessionEventId, undone,
                                            opacity,
                                           {id: mergedBufferId, isDummy: true});
    return pictureEvent;
};

/**
 * @return {string} A serialization of the event.
 */
BufferMergeEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + this.opacity;
    eventMessage += ' ' + this.mergedBuffer.id;
    return eventMessage;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
BufferMergeEvent.prototype.getBoundingBox = function(clipRect) {
    return new Rect(clipRect.left, clipRect.right,
                    clipRect.top, clipRect.bottom);
};


/**
 * Event that hides an another event in an undoable way.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {number} hiddenSid The session identifier of the hidden event.
 * @param {number} hiddenSessionEventId Event/session specific identifier of the
 * hidden event.
 */
var EventHideEvent = function(sid, sessionEventId, undone, hiddenSid,
                              hiddenSessionEventId) {
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.hiddenSid = hiddenSid;
    this.hiddenSessionEventId = hiddenSessionEventId;
};

EventHideEvent.prototype = new PictureEvent('eventHide');

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
EventHideEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * Parse an EventHideEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {EventHideEvent} The parsed event or null.
 */
EventHideEvent.parse = function(arr, i, version, sid, sessionEventId, undone) {
    var hiddenSid = parseInt(arr[i++]);
    var hiddenSessionEventId = parseInt(arr[i++]);
    var pictureEvent = new EventHideEvent(sid, sessionEventId, undone,
                                          hiddenSid, hiddenSessionEventId);
    return pictureEvent;
};

/**
 * @return {string} A serialization of the event.
 */
EventHideEvent.prototype.serialize = function() {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + this.hiddenSid;
    eventMessage += ' ' + this.hiddenSessionEventId;
    return eventMessage;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
EventHideEvent.prototype.getBoundingBox = function(clipRect) {
    return new Rect(clipRect.left, clipRect.right,
                    clipRect.top, clipRect.bottom);
};
