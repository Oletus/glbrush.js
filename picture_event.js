/*
 * Copyright Olli Etuaho 2012-2013.
 */

/**
 * Draw state for a brush event. Used to resume updateTo() from a point along
 * the brush stroke.
 * @constructor
 * @param {number} coordsInd Index in the coords array. Must be an integer.
 * @param {Vec2} direction Tangent of the brush stroke at the beginning of the
 * current segment.
 */
var BrushEventState = function(coordsInd, direction) {
    if (coordsInd === undefined)
        coordsInd = 0;
    this.coordsInd = coordsInd;
    this.direction = direction;
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
 * @return {PictureEvent} The parsed event or null.
 */
PictureEvent.parse = function(arr, i) {
    var eventType = arr[i++];
    var sid = parseInt(arr[i++]);
    var sessionEventId = parseInt(arr[i++]);
    var undone = (parseInt(arr[i++]) !== 0);
    if (eventType === 'brush') {
        return BrushEvent.parse(arr, i, sid, sessionEventId, undone);
    } else {
        console.log('Unexpected picture event type ' + eventType);
        return null;
    }
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
 * @param {BrushEvent.Mode} mode Blending mode to use.
 */
var BrushEvent = function(sid, sessionEventId, undone, color, flow, opacity,
                          radius, softness, mode) {
    // TODO: assert(color.length == 3);
    this.undone = undone;
    this.sid = sid;
    this.sessionEventId = sessionEventId;
    this.color = color;
    this.flow = flow;
    this.opacity = opacity;
    this.radius = radius;
    this.coords = []; // holding x,y,pressure triplets
    this.boundingBox = null;
    this.boundingBoxUpTo = null;
    this.soft = softness > 0.5;
    this.mode = mode;
};

BrushEvent.prototype = new PictureEvent('brush');

/**
 * @enum {number}
 */
BrushEvent.Mode = {
    erase: 0,
    normal: 1,
    multiply: 2,
    screen: 3
};

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
    eventMessage += ' ' + color.serializeRGB(this.color);
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
 * Parse a BrushEvent from a tokenized serialization.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event. Must be an
 * integer.
 * @param {boolean} undone Whether this event is undone.
 * @return {BrushEvent} The parsed event or null.
 */
BrushEvent.parse = function(arr, i, sid, sessionEventId, undone) {
    var color = [];
    color[0] = parseInt(arr[i++]);
    color[1] = parseInt(arr[i++]);
    color[2] = parseInt(arr[i++]);
    var flow = parseFloat(arr[i++]);
    var opacity = parseFloat(arr[i++]);
    var radius = parseFloat(arr[i++]);
    var softness = parseFloat(arr[i++]);
    var mode = parseInt(arr[i++]);
    pictureEvent = new BrushEvent(sid, sessionEventId, undone, color, flow,
                                  opacity, radius, softness, mode);
    while (i <= arr.length - BrushEvent.coordsStride) {
        var x = parseFloat(arr[i++]);
        var y = parseFloat(arr[i++]);
        var pressure = parseFloat(arr[i++]);
        pictureEvent.pushCoordTriplet(x, y, pressure);
    }
    return pictureEvent;
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
    this.boundingBox = null;
    this.boundingBoxUpTo = null;
};

/**
 * Determine whether this event's bounding box intersects with the given
 * rectangle. Returns undefined if this event's bounding box is not up to date.
 * @param {Rect} rect The rectangle to intersect with.
 * @return {boolean} Does the event's axis-aligned bounding box intersect the
 * given rectangle?
 */
BrushEvent.prototype.boundsIntersectRect = function(rect) {
    if (this.boundingBox === null) {
        // TODO: use an assert instead
        console.log('boundsIntersectRect from an event with no bounding box');
        return undefined;
    }
    return this.boundingBox.intersectsRectRoundedOut(rect);
};

/**
 * @const
 */
BrushEvent.lineSegmentLength = 5.0;

/**
 * Draw the brush event to the given rasterizer's bitmap.
 * @param {Object} rasterizer The rasterizer to use.
 * @param {number} untilCoord Maximum coordinate index to draw + 1.
 */
BrushEvent.prototype.updateTo = function(rasterizer, untilCoord) {
    var drawState = rasterizer.getDrawEventState(this, BrushEventState);
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    } else {
        if (drawState.coordsInd + BrushEvent.coordsStride > untilCoord) {
            rasterizer.clear();
            drawState = new BrushEventState();
        }
    }
    // TODO: assert(untilCoord % BrushEvent.coordsStride == 0);
    if (this.coords.length % BrushEvent.coordsStride != 0) {
        // TODO: turn this into an assert.
        console.log('Tried to apply event with odd number of coordinates');
        return;
    }

    var i = drawState.coordsInd;
    var prevDirection = drawState.direction;

    if (i === 0) {
        var nBlends = Math.ceil(this.radius * 2);
        var alpha = color.alphaForNBlends(this.flow, nBlends);
        rasterizer.beginLines(this.soft, alpha);
    }

    var r = this.radius;
    var x1 = this.coords[i++];
    var y1 = this.coords[i++];
    var p1 = this.coords[i++]; // pressure
    var xd, yd, pd, rd;

    if (this.boundingBoxUpTo === null) {
        this.boundingBoxUpTo = 0;
        this.boundingBox = Rect.fromCircle(x1, y1, Math.max(r * p1, 1.0) + 1.0);
    }
    while (i + BrushEvent.coordsStride <= untilCoord) {
        var x2 = this.coords[i++];
        var y2 = this.coords[i++];
        var p2 = this.coords[i++];
        var direction = new Vec2(x2 - x1, y2 - y1);
        var d = direction.length();

        if (d < 1.0) {
            if (p2 > p1) {
                // Avoid leaving high-pressure events undrawn
                // even if the x/y points are close to each other.
                p1 = p2;
            }
            if (this.boundingBoxUpTo < i - BrushEvent.coordsStride) {
                this.boundingBoxUpTo = i - BrushEvent.coordsStride;
            }
            continue;
        }

        // Brush smoothing. By default, make a straight line.
        var bezier_x = x1 + direction.x * 0.5;
        var bezier_y = y1 + direction.y * 0.5;
        // There's not much sense to do smoothing if intervals are short
        if (prevDirection !== undefined && d > BrushEvent.lineSegmentLength) {
            // dot product check to ensure that the direction is similar enough
            if (direction.x * prevDirection.x + direction.y * prevDirection.y >
                d * 0.5) {
                // ad-hoc weighing of points to get a visually pleasing result
                bezier_x = x1 + prevDirection.x * d * 0.25 + direction.x * 0.25;
                bezier_y = y1 + prevDirection.y * d * 0.25 + direction.y * 0.25;
            }
        }

        // we'll split the smoothed stroke segment to line segments with approx
        // length of BrushEvent.lineSegmentLength, trying to fit them nicely
        // between the two stroke segment endpoints
        var t = 0;
        var tSegment = 0.99999 / Math.ceil(d / BrushEvent.lineSegmentLength);
        while (t < 1.0) {
            xd = x1 * Math.pow(1.0 - t, 2) + bezier_x * t * (1.0 - t) * 2 +
                 x2 * Math.pow(t, 2);
            yd = y1 * Math.pow(1.0 - t, 2) + bezier_y * t * (1.0 - t) * 2 +
                 y2 * Math.pow(t, 2);
            pd = p1 + (p2 - p1) * t;
            rd = r * pd;
            rasterizer.lineTo(xd, yd, rd);
            if (this.boundingBoxUpTo < i - BrushEvent.coordsStride) {
                this.boundingBox.unionCircle(xd, yd, Math.max(rd, 1.0) + 1.0);
            }
            t += tSegment;
        }
        if (d < BrushEvent.lineSegmentLength)
            prevDirection = undefined;
        else {
            // The tangent of the bezier curve at the end of the curve
            // intersects with the control point, we get the next iteration's
            // direction from there.
            prevDirection = new Vec2(x2 - bezier_x, y2 - bezier_y);
            prevDirection.normalize();
        }
        x1 = x2;
        y1 = y2;
        p1 = p2;
        drawState.coordsInd = i - BrushEvent.coordsStride;
    }
    rasterizer.flush();
    drawState.direction = prevDirection;
    if (this.boundingBoxUpTo < drawState.coordsInd) {
        this.boundingBoxUpTo = drawState.coordsInd;
    }
};

/**
 * @return {boolean} Does the bounding box of this event contain all of the
 * segments along the complete brush stroke?
 */
BrushEvent.prototype.hasCompleteBoundingBox = function() {
    return this.boundingBoxUpTo === this.coords.length -
                                    BrushEvent.coordsStride;
};
