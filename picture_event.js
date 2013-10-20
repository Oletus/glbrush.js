/*
 * Copyright Olli Etuaho 2012-2013.
 */

/**
 * Draw state for a brush event. Used to resume drawTo() from a point along
 * the brush stroke.
 * @constructor
 * @param {number} coordsInd Index in the coords array. Must be an integer.
 * @param {Vec2} direction Tangent of the brush stroke at the beginning of the
 * current segment.
 */
var BrushEventState = function(coordsInd, direction) {
    if (coordsInd === undefined) {
        coordsInd = 0;
    }
    if (direction === undefined) {
        direction = new Vec2(0, 0);
    }
    this.coordsInd = coordsInd;
    this.direction = direction;
    this.useDirection = false;
};

/**
 * Draw state for a gradient event. Used to determine whether a gradient is
 * already drawn in a rasterizer.
 * @constructor
 */
var GradientEventState = function() {
    this.coords0 = new Vec2(0, 0);
    this.coords1 = new Vec2(0, 0);
};

/**
 * An event that changes a picture buffer's state.
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
        return GradientEvent.parse(arr, i, version, sid, sessionEventId,
                                   undone);
    } else if (eventType === 'bufferMerge') {
        return BufferMergeEvent.parse(arr, i, version, sid, sessionEventId,
                                      undone);
    } else if (eventType === 'bufferAdd') {
        return BufferAddEvent.parse(arr, i, version, sid, sessionEventId,
                                    undone);
    } else if (eventType === 'bufferRemove') {
        return BufferRemoveEvent.parse(arr, i, version, sid, sessionEventId,
                                       undone);
    } else if (eventType === 'bufferMove') {
        return BufferMoveEvent.parse(arr, i, version, sid, sessionEventId,
                                     undone);
    } else if (eventType === 'eventHide') {
        return EventHideEvent.parse(arr, i, version, sid, sessionEventId,
                                    undone);
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
 * rectangle. Returns undefined if this event's bounding box is not up to date.
 * @param {Rect} rect The rectangle to intersect with.
 * @return {boolean} Does the event's axis-aligned bounding box intersect the
 * given rectangle?
 */
PictureEvent.prototype.boundsIntersectRect = function(rect) {
    return this.getBoundingBox(rect).intersectsRectRoundedOut(rect);
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
    screen: 3
};

/**
 * Generate a constructor for an event conforming to the brush event format.
 * @return {function(number, number, boolean, Uint8Array|Array.<number>, number,
 * number, number, number, PictureEvent.Mode)} Constructor for the event.
 */
var brushEventConstructor = function() {
    return function(sid, sessionEventId, undone, color, flow, opacity, radius,
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
        this.soft = softness > 0.5;
        this.mode = mode;
        this.hideCount = 0;
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
 * @param {number} softness Value controlling the softness. Range 0 to 1.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 */
var BrushEvent = brushEventConstructor();

BrushEvent.prototype = new PictureEvent('brush');

/**
 * @const
 * @protected
 */
BrushEvent.coordsStride = 3; // x, y and pressure coordinates belong together

/**
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
BrushEvent.prototype.serialize = function(scale) {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + colorUtil.serializeRGB(this.color);
    eventMessage += ' ' + this.flow + ' ' + this.opacity;
    eventMessage += ' ' + (this.radius * scale);
    if (this.soft) {
        eventMessage += ' 1.0';
    } else {
        eventMessage += ' 0.0';
    }
    eventMessage += ' ' + this.mode;
    var i = 0;
    while (i < this.coords.length) {
        eventMessage += ' ' + this.coords[i++] * scale;
        eventMessage += ' ' + this.coords[i++] * scale;
        eventMessage += ' ' + this.coords[i++];
    }
    return eventMessage;
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
        var softness = parseFloat(arr[i++]);
        var mode = parseInt(arr[i++]);
        var pictureEvent = new constructor(sid, sessionEventId, undone, color,
                                           flow, opacity, radius, softness,
                                           mode);
        while (i <= arr.length - BrushEvent.coordsStride) {
            var x = parseFloat(arr[i++]);
            var y = parseFloat(arr[i++]);
            var pressure = parseFloat(arr[i++]);
            pictureEvent.pushCoordTriplet(x, y, pressure);
        }
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
 * Scale this event. This will change the coordinates of the stroke. Note that
 * the event is not cleared from any rasterizers, clear any rasterizers that
 * have this event manually before calling this function.
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
    this.boundingBoxRasterizer.boundingBox = null;
};

/**
 * Translate this event. This will change the coordinates of the stroke. Note
 * that the event is not cleared from any rasterizers, clear any rasterizers
 * that have this event manually before calling this function.
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
    this.boundingBoxRasterizer.translate(offset);
};

/**
 * @const
 */
BrushEvent.lineSegmentLength = 5.0;

/**
 * A rasterizer that does not rasterize, but computes bounding boxes for a brush
 * event. Only implements functions necessary for drawing a brush event.
 * @constructor
 */
BrushEvent.BBRasterizer = function() {
    this.state = null;
    this.boundingBox = null;
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
BrushEvent.BBRasterizer.prototype.getDrawEventState = function(event,
                                                             stateConstructor) {
    if (this.boundingBox === null) {
        this.state = new stateConstructor();
        this.boundingBox = new Rect();
    }
    return this.state;
};

/**
 * Do nothing.
 */
BrushEvent.BBRasterizer.prototype.beginCircleLines = function() {};

/**
 * Add a circle line to the bounding box.
 * @param {number} centerX The x coordinate of the center of the circle at the
 * end of the line.
 * @param {number} centerY The y coordinate of the center of the circle at the
 * end of the line.
 * @param {number} radius The radius at the end of the line.
 */
BrushEvent.BBRasterizer.prototype.circleLineTo = function(centerX, centerY,
                                                          radius) {
    this.boundingBox.unionCircle(centerX, centerY, Math.max(radius, 1.0) + 1.0);
};

/**
 * Add a circle to the bounding box.
 * @param {number} centerX The x coordinate of the center of the circle.
 * @param {number} centerY The y coordinate of the center of the circle.
 * @param {number} radius The radius of the circle.
 */
BrushEvent.BBRasterizer.prototype.fillCircle = function(centerX, centerY,
                                                        radius) {
    this.boundingBox.unionCircle(centerX, centerY, Math.max(radius, 1.0) + 1.0);
};

/**
 * Translate the bounding box.
 * @param {Vec2} offset Amount to translate with.
 */
BrushEvent.BBRasterizer.prototype.translate = function(offset) {
    if (this.boundingBox !== null) {
        this.boundingBox.left += offset.x;
        this.boundingBox.right += offset.x;
        this.boundingBox.top += offset.y;
        this.boundingBox.bottom += offset.y;
    }
};

/**
 * Do nothing.
 */
BrushEvent.BBRasterizer.prototype.flushCircles = function() {};

/**
 * Draw the brush event to the given rasterizer's bitmap.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @param {number} untilCoord Maximum coordinate index to draw + 1.
 */
BrushEvent.prototype.drawTo = function(rasterizer, untilCoord) {
    var drawState = rasterizer.getDrawEventState(this, BrushEventState);
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    } else {
        if (drawState.coordsInd + BrushEvent.coordsStride > untilCoord) {
            rasterizer.clearDirty();
            drawState = rasterizer.getDrawEventState(this, BrushEventState);
        }
    }
    // TODO: assert(untilCoord % BrushEvent.coordsStride === 0);
    if (this.coords.length % BrushEvent.coordsStride !== 0) {
        // TODO: turn this into an assert.
        console.log('Tried to apply event with odd number of coordinates');
        return;
    }

    var i = drawState.coordsInd;
    var prevDirection = drawState.direction;

    if (i === 0) {
        var nBlends = Math.ceil(this.radius * 2);
        var alpha = colorUtil.alphaForNBlends(this.flow, nBlends);
        rasterizer.beginCircleLines(this.soft, alpha);
    }

    var r = this.radius;
    var x1 = this.coords[i++];
    var y1 = this.coords[i++];
    var p1 = this.coords[i++]; // pressure
    var xd, yd, pd, rd;

    while (i + BrushEvent.coordsStride <= untilCoord) {
        var x2 = this.coords[i++];
        var y2 = this.coords[i++];
        var p2 = this.coords[i++];
        var dx = x2 - x1;
        var dy = y2 - y1;
        var d = Math.sqrt(dx * dx + dy * dy);

        if (d < 1.0) {
            if (p2 > p1) {
                // Avoid leaving high-pressure events undrawn
                // even if the x/y points are close to each other.
                p1 = p2;
            }
            continue;
        }

        // Brush smoothing. By default, make a straight line.
        var bezierX = x1 + dx * 0.5;
        var bezierY = y1 + dy * 0.5;
        // There's not much sense to do smoothing if intervals are short
        if (drawState.usePrevDirection && d > BrushEvent.lineSegmentLength) {
            // dot product check to ensure that the direction is similar enough
            if (dx * prevDirection.x + dy * prevDirection.y > d * 0.5) {
                // ad-hoc weighing of points to get a visually pleasing result
                bezierX = x1 + prevDirection.x * d * 0.25 + dx * 0.25;
                bezierY = y1 + prevDirection.y * d * 0.25 + dy * 0.25;
            }
        }

        // we'll split the smoothed stroke segment to line segments with approx
        // length of BrushEvent.lineSegmentLength, trying to fit them nicely
        // between the two stroke segment endpoints
        var t = 0;
        var tSegment = 0.99999 / Math.ceil(d / BrushEvent.lineSegmentLength);
        while (t < 1.0) {
            xd = x1 * Math.pow(1.0 - t, 2) + bezierX * t * (1.0 - t) * 2 +
                 x2 * Math.pow(t, 2);
            yd = y1 * Math.pow(1.0 - t, 2) + bezierY * t * (1.0 - t) * 2 +
                 y2 * Math.pow(t, 2);
            pd = p1 + (p2 - p1) * t;
            rd = r * pd;
            rasterizer.circleLineTo(xd, yd, rd);
            t += tSegment;
        }
        if (d < BrushEvent.lineSegmentLength) {
            drawState.usePrevDirection = false;
        } else {
            // The tangent of the bezier curve at the end of the curve
            // intersects with the control point, we get the next iteration's
            // direction from there.
            prevDirection.x = x2 - bezierX;
            prevDirection.y = y2 - bezierY;
            prevDirection.normalize();
            drawState.usePrevDirection = true;
        }
        x1 = x2;
        y1 = y2;
        p1 = p2;
        drawState.coordsInd = i - BrushEvent.coordsStride;
    }
    rasterizer.flushCircles();
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
BrushEvent.prototype.getBoundingBox = function(clipRect) {
    if (this.boundingBoxRasterizer.boundingBox === null ||
        this.boundingBoxRasterizer.state.coordsInd !==
        this.coords.length - BrushEvent.coordsStride) {
        this.drawTo(this.boundingBoxRasterizer);
    }
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
 * @param {number} softness Value controlling the softness. Range 0 to 1.
 * @param {PictureEvent.Mode} mode Blending mode to use.
 */
var ScatterEvent = brushEventConstructor();

ScatterEvent.prototype = new PictureEvent('scatter');

/** @inheritDoc */
ScatterEvent.prototype.serialize = BrushEvent.prototype.serialize;

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

/** @inheritDoc */
ScatterEvent.prototype.scale = BrushEvent.prototype.scale;

/** @inheritDoc */
ScatterEvent.prototype.translate = BrushEvent.prototype.translate;

/** @inheritDoc */
ScatterEvent.prototype.getBoundingBox = BrushEvent.prototype.getBoundingBox;

/**
 * Draw the brush event to the given rasterizer's bitmap.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @param {number} untilCoord Maximum coordinate index to draw + 1.
 */
ScatterEvent.prototype.drawTo = function(rasterizer, untilCoord) {
    var drawState = rasterizer.getDrawEventState(this, BrushEventState);
    var needsClear = false;
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    } else {
        if (drawState.coordsInd + BrushEvent.coordsStride > untilCoord) {
            needsClear = true;
        }
    }
    // TODO: Maybe make it possible to change arbitrary parameters in the event
    // and be able to determine if the rasterizer state is the same.
    if (needsClear || drawState.radius !== this.radius) {
        rasterizer.clearDirty();
        drawState = rasterizer.getDrawEventState(this, BrushEventState);
        drawState.radius = this.radius;
    }
    var i = drawState.coordsInd;
    if (i === 0) {
        rasterizer.beginCircleLines(this.soft, this.flow);
    }
    while (i + BrushEvent.coordsStride <= untilCoord) {
        var x = this.coords[i++];
        var y = this.coords[i++];
        var p = this.coords[i++];
        rasterizer.fillCircle(x, y, p * this.radius);
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
 * Add a triplet of coordinates for a circle.
 * @param {number} x The x center of the circle.
 * @param {number} y The y center of the circle.
 * @param {number} pressure Used as a multiplier for the circle radius. Must be
 * larger than zero.
 */
ScatterEvent.prototype.pushCoordTriplet = function(x, y, pressure) {
    // Limit pressure to 5 decimals to cut on file size a bit. This rounding
    // method should be okay as long as pressure stays within reasonable bounds.
    pressure = Math.round(pressure * 100000) / 100000;
    this.coords.push(x);
    this.coords.push(y);
    this.coords.push(pressure);
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
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
GradientEvent.prototype.serialize = function(scale) {
    var eventMessage = this.serializePictureEvent();
    eventMessage += ' ' + colorUtil.serializeRGB(this.color);
    eventMessage += ' ' + this.opacity;
    eventMessage += ' ' + this.mode;
    var i = 0;
    eventMessage += ' ' + this.coords0.x * scale;
    eventMessage += ' ' + this.coords0.y * scale;
    eventMessage += ' ' + this.coords1.x * scale;
    eventMessage += ' ' + this.coords1.y * scale;
    return eventMessage;
};

/**
 * Scale this event. This will change the coordinates of the gradient. Note that
 * the event is not cleared from any rasterizers, clear any rasterizers that
 * have this event manually before calling this function.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
GradientEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.coords0.x *= scale;
    this.coords0.y *= scale;
    this.coords1.x *= scale;
    this.coords1.y *= scale;
};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
GradientEvent.prototype.getBoundingBox = function(clipRect) {
    var boundingBox = new Rect(clipRect.left, clipRect.right,
                               clipRect.top, clipRect.bottom);
    if (this.coords0.y === this.coords1.y) {
        if (this.coords1.x > this.coords0.x) {
            boundingBox.limitLeft(this.coords0.x - 1);
        } else if (this.coords1.x < this.coords0.x) {
            boundingBox.limitRight(this.coords0.x + 1);
        } else {
            boundingBox.makeEmpty();
        }
    } else {
        // y = slope * x + b
        var normalSlope = -1.0 / this.coords0.slope(this.coords1);
        var normalB = this.coords0.y - normalSlope * this.coords0.x;
        if (normalSlope === 0.0) {
            if (this.coords0.y < this.coords1.y) {
                boundingBox.limitTop(this.coords0.y - 1);
            } else {
                boundingBox.limitBottom(this.coords0.y + 1);
            }
        } else if (normalSlope < 0 && this.coords1.y < this.coords0.y) {
            // the covered area is in the top left corner
            // intersection with left edge
            boundingBox.limitBottom(normalSlope * boundingBox.left +
                                    normalB + 1);
            // intersection with top edge
            boundingBox.limitRight((boundingBox.top - normalB) /
                                   normalSlope + 1);
        } else if (normalSlope > 0 && this.coords1.y < this.coords0.y) {
            // the covered area is in the top right corner
            // intersection with right edge
            boundingBox.limitBottom(normalSlope * boundingBox.right +
                                    normalB + 1);
            // intersection with top edge
            boundingBox.limitLeft((boundingBox.top - normalB) /
                                  normalSlope - 1);
        } else if (normalSlope < 0 && this.coords1.y > this.coords0.y) {
            // the covered area is in the bottom right corner
            // intersection with right edge
            boundingBox.limitTop(normalSlope * boundingBox.right + normalB - 1);
            // intersection with bottom edge
            boundingBox.limitLeft((boundingBox.bottom - normalB) /
                                  normalSlope - 1);
        } else {
            // TODO: assert(normalSlope > 0 && this.coords1.y > this.coords0.y);
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
 */
GradientEvent.prototype.drawTo = function(rasterizer) {
    var drawState = rasterizer.getDrawEventState(this, GradientEventState);
    if (drawState.coords0.x === this.coords0.x &&
        drawState.coords0.y === this.coords0.y &&
        drawState.coords1.x === this.coords1.x &&
        drawState.coords1.y === this.coords1.y) {
        return;
    }
    rasterizer.clearDirty();
    drawState = rasterizer.getDrawEventState(this, GradientEventState);
    drawState.coords0.x = this.coords0.x;
    drawState.coords0.y = this.coords0.y;
    drawState.coords1.x = this.coords1.x;
    drawState.coords1.y = this.coords1.y;
    rasterizer.linearGradient(this.coords1, this.coords0);
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
GradientEvent.prototype.isRasterized = function() {
    return true;
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
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
BufferAddEvent.prototype.serialize = function(scale) {
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
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
BufferRemoveEvent.prototype.serialize = function(scale) {
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
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
BufferMoveEvent.prototype.serialize = function(scale) {
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
var BufferMergeEvent = function(sid, sessionEventId, undone, opacity,
                                mergedBuffer) {
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
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
BufferMergeEvent.prototype.serialize = function(scale) {
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
 * @param {number} scale Scale to multiply serialized coordinates with.
 * @return {string} A serialization of the event.
 */
EventHideEvent.prototype.serialize = function(scale) {
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
