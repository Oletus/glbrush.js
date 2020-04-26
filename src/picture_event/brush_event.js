/*
 * Copyright Olli Etuaho 2012-2013.
 */


import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import * as colorUtil from '../util/color_util.js';

import { BrushTipMover } from '../brush_tip_mover.js';

import { PictureEvent } from './picture_event.js';

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
 * A PictureEvent representing a brush stroke.
 * @constructor
 */
var BrushEvent = function() {
    // True if needs brush tip movement interpolation. Can be set to false in inheriting objects.
    this.needsTipMovers = true;
};

/**
 * @const
 * @protected
 */
var coordsStride = 3; // x, y and pressure coordinates belong together

BrushEvent.prototype = new PictureEvent('brush');

PictureEvent.types[BrushEvent.prototype.eventType] = BrushEvent;

/**
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
 * @param {BlendingMode} mode Blending mode to use.
 * @param {number} targetLayerId Id of the target layer.
 */
BrushEvent.prototype.init = function(sid, sessionEventId, undone, color, flow, opacity, radius, textureId, softness,
                                     mode, targetLayerId) {
    if (sid !== undefined) {
        // TODO: assert(color.length == 3);
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.color = color;
        this.flow = flow;
        this.opacity = opacity;
        this.radius = radius;
        this.textureId = textureId; // Id 0 is a circle, others are bitmap textures.
        this.soft = softness > 0.5;
        this.mode = mode;
        this.targetLayerId = targetLayerId;
    }
    this.coords = []; // holding x,y,pressure triplets
    this.boundingBoxRasterizer = new BrushEvent.BBRasterizer();
    this.hideCount = 0;
    this.generation = 0;
    if (this.needsTipMovers) {
        this.bbTip = new BrushTipMover(true);
        this.brushTip = new BrushTipMover(true);
    }
};

/**
 * @param {Object} json JS object to parse values from.
 */
BrushEvent.prototype.fromJS = function(json) {
    this.init();
    this.targetLayerId = json['targetLayerId'];
    this.color = json['color'];
    this.flow = json['flow'];
    this.opacity = json['opacity'];
    this.radius = json['radius'];
    this.textureId = json['textureId']; // Id 0 is a circle, others are bitmap textures.
    this.soft = json['softness'] > 0.5;
    this.mode = json['mode'];
    var coords = json['coordinates'];
    for (var i = 0; i < coords.length; ++i) {
        this.coords.push(coords[i]);
    }
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
BrushEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['targetLayerId'] = this.targetLayerId;
    json['color'] = colorUtil.serializeRGB(this.color);
    json['flow'] = this.flow;
    json['opacity'] = this.opacity;
    json['radius'] = this.radius;
    json['textureId'] = this.textureId;
    json['softness'] = this.soft ? 1.0 : 0.0;
    json['mode'] = this.mode;
    var coords = [];
    var i = 0;
    while (i < this.coords.length) {
        coords.push(this.coords[i++]);
    }
    json['coordinates'] = coords;
};

/**
 * Parse event attributes conforming to a legacy brush event format.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @return {number} Index to continue parsing the brush event coordinates from.
 */
BrushEvent.parseLegacyAttributes = function(json, arr, i, version) {
    var color = [];
    color[0] = parseInt(arr[i++]);
    color[1] = parseInt(arr[i++]);
    color[2] = parseInt(arr[i++]);
    json['color'] = color;
    json['flow'] = parseFloat(arr[i++]);
    json['opacity'] = parseFloat(arr[i++]);
    json['radius'] = parseFloat(arr[i++]);
    json['textureId'] = 0;
    if (version > 1) {
        json['textureId'] = parseInt(arr[i++]);
    }
    json['softness'] = parseFloat(arr[i++]);
    json['mode'] = parseInt(arr[i++]);
    return i;
};

/**
 * Parse a BrushEvent from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BrushEvent.parseLegacy = function(json, arr, i, version) {
    i = BrushEvent.parseLegacyAttributes(json, arr, i, version);
    BrushEvent.parseLegacyCoords(json, arr, i, version);
};

/**
 * Parse BrushEvent coordinates from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BrushEvent.parseLegacyCoords = function(json, arr, i, version) {
    var coords = [];
    while (i <= arr.length - coordsStride) {
        coords.push(parseFloat(arr[i++]));
        coords.push(parseFloat(arr[i++]));
        coords.push(parseFloat(arr[i++]));
    }
    json['coordinates'] = coords;
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
        if (x === this.coords[this.coords.length - coordsStride] &&
          y === this.coords[this.coords.length - coordsStride - 1]) {
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
        if (i % coordsStride < 2) {
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
        if (i % coordsStride === 0) {
            this.coords[i] += offset.x;
        } else if (i % coordsStride === 1) {
            this.coords[i] += offset.y;
        }
    }
    ++this.generation; // This invalidates any rasterizers (including BBRasterizer) which have this event cached.
};

/**
 * Normalize pressure to the range 0 to 1. Adjusts the radius accordingly.
 */
BrushEvent.prototype.normalizePressure = function() {
    var i;
    var maxPressure = 0;
    for (i = 0; i < this.coords.length; i += coordsStride) {
        if (this.coords[i + 2] > maxPressure) {
            maxPressure = this.coords[i + 2];
        }
    }
    if (maxPressure <= 1.0) {
        return;
    }
    for (i = 0; i < this.coords.length; i += coordsStride) {
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
 * @extends {BaseRasterizer}
 */
BrushEvent.BBRasterizer = function() {
    this.state = null;
    this.boundingBox = null;
    this.generation = -1;
    this.transform = null;
    this.transformGeneration = 0;
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
 * @param {AffineTransform} transform The transform to check to determine whether a
 * clear needs to be performed. Does not affect the rasterizer's operation.
 * @param {function()} stateConstructor Constructor for creating a new draw
 * event state object unless the event already has been rasterized to this
 * rasterizer's bitmap.
 * @return {Object} Draw event state for the given event.
 */
BrushEvent.BBRasterizer.prototype.getDrawEventState = function(event, transform, stateConstructor) {
    if (this.boundingBox === null || event.generation !== this.generation || transform !== this.transform ||
        transform.generation !== this.transformGeneration) {
        this.state = new stateConstructor();
        this.boundingBox = new Rect();
        this.generation = event.generation;
        this.transform = transform;
        this.transformGeneration = transform.generation;
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
    var drawState = rasterizer.getDrawEventState(this, transform, BrushEventState);
    // Use different tips for BB and normal drawing to avoid clearing the rasterizer all the time while drawing
    var brushTip = rasterizer === this.boundingBoxRasterizer ? this.bbTip : this.brushTip;
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    }
    // TODO: Reset also if transform has changed
    if (drawState.coordsInd > untilCoord || brushTip.target !== rasterizer) {
        rasterizer.clearDirty();
        drawState = rasterizer.getDrawEventState(this, transform, BrushEventState);
    }
    // TODO: assert(this.coords.length % coordsStride === 0);
    // TODO: assert(untilCoord % coordsStride === 0);

    var i = drawState.coordsInd;

    if (i === 0) {
        rasterizer.beginCircles(this.soft, this.textureId);
        var x = this.coords[i++];
        var y = this.coords[i++];
        var pressure = this.coords[i++];
        brushTip.reset(rasterizer, transform, x, y, pressure, this.radius, this.flow, 0, 1, false,
                       BrushTipMover.Rotation.off);
    }

    while (i + coordsStride <= untilCoord) {
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

BrushEvent.coordsStride = coordsStride;  // Only for unit tests.

export { BrushEvent, BrushEventState };
