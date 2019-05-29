/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import * as colorUtil from '../util/color_util.js';

import { BrushEvent, BrushEventState } from './brush_event.js';

/**
 * A PictureEvent representing a bunch of individually positioned circles.
 * @constructor
 */
var ScatterEvent = function() {
    this.eventType = 'scatter';
    this.needsTipMovers = false;
};

var coordsStride = 5; // x, y, radius, flow and rotation coordinates belong together

ScatterEvent.prototype = new BrushEvent();

/**
 * Parse a ScatterEvent from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
ScatterEvent.parseLegacy = function(json, arr, i, version) {
    i = BrushEvent.parseLegacyAttributes(json, arr, i, version);
    ScatterEvent.parseLegacyCoords(json, arr, i, version);
};

/**
 * Parse ScatterEvent coordinates from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
ScatterEvent.parseLegacyCoords = function(json, arr, i, version) {
    var coords = [];
    var eventRadius = json['radius'];
    var eventFlow = json['flow'];
    while (i < arr.length) {
        coords.push(parseFloat(arr[i++]));
        coords.push(parseFloat(arr[i++]));
        var pressure = parseFloat(arr[i++]);
        if (version >= 4) {
            coords.push(pressure); // interpreted as radius
            coords.push(parseFloat(arr[i++]));
            coords.push(parseFloat(arr[i++]));
        } else {
            coords.push(pressure * eventRadius);
            coords.push(eventFlow);
            coords.push(0);
        }
    }
    json['coordinates'] = coords;
};


/**
 * Scale this event. This will change the coordinates of the stroke.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
ScatterEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.radius *= scale;
    for (var i = 0; i < this.coords.length; ++i) {
        if (i % coordsStride < 3) {
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
        if (i % coordsStride === 0) {
            this.coords[i] += offset.x;
        } else if (i % coordsStride === 1) {
            this.coords[i] += offset.y;
        }
    }
    ++this.generation; // This invalidates any rasterizers (including BBRasterizer) which have this event cached.
};

/**
 * Normalize pressure (does not apply to scatter event).
 */
ScatterEvent.prototype.normalizePressure = function() {};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
ScatterEvent.prototype.getBoundingBox = function(clipRect, transform) {
    this.drawTo(this.boundingBoxRasterizer, transform);
    return this.boundingBoxRasterizer.boundingBox;
};

/**
 * Draw the brush event to the given rasterizer's bitmap.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @param {number} untilCoord Maximum coordinate index to draw + 1.
 */
ScatterEvent.prototype.drawTo = function(rasterizer, transform, untilCoord) {
    var drawState = rasterizer.getDrawEventState(this, transform, BrushEventState);
    if (untilCoord === undefined) {
        untilCoord = this.coords.length;
    } else {
        if (drawState.coordsInd > untilCoord) {
            rasterizer.clearDirty();
            drawState = rasterizer.getDrawEventState(this, transform, BrushEventState);
        }
    }
    var i = drawState.coordsInd;
    if (i === 0) {
        rasterizer.beginCircles(this.soft, this.textureId);
    }
    while (i + coordsStride <= untilCoord) {
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

ScatterEvent.coordsStride = coordsStride;  // Just for unit tests.

export { ScatterEvent };
