/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import * as colorUtil from '../util/color_util.js';

import { PictureEvent } from './picture_event.js';

/**
 * Draw state for a gradient event. Used to determine whether a gradient is
 * already drawn in a rasterizer.
 * @constructor
 */
var GradientEventState = function() {
    this.drawn = false;
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
 * @param {BlendingMode} mode Blending mode to use.
 */
var GradientEvent = function(sid, sessionEventId, undone, color, opacity,
                             mode) {
    // TODO: assert(color.length == 3);
    if (sid !== undefined) {
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.color = color;
        this.opacity = opacity;
        this.coords0 = new Vec2(0, 0);
        this.coords1 = new Vec2(1, 1);
        this.mode = mode;
    }
    this.hideCount = 0;
    this.generation = 0;
};

GradientEvent.prototype = new PictureEvent('gradient');

/**
 * @param {Object} json JS object to parse values from.
 */
GradientEvent.prototype.fromJS = function(json) {
    this.color = json['color'];
    this.opacity = json['opacity'];
    this.coords0 = new Vec2(json['x0'], json['y0']);
    this.coords1 = new Vec2(json['x1'], json['y1']);
    this.mode = json['mode'];
};

/**
 * Parse a GradientEvent from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
GradientEvent.parseLegacy = function(json, arr, i, version) {
    var color = [];
    color[0] = parseInt(arr[i++]);
    color[1] = parseInt(arr[i++]);
    color[2] = parseInt(arr[i++]);
    json['color'] = color;
    json['opacity'] = parseFloat(arr[i++]);
    json['mode'] = parseInt(arr[i++]);
    json['x0'] = parseFloat(arr[i++]);
    json['y0'] = parseFloat(arr[i++]);
    json['x1'] = parseFloat(arr[i++]);
    json['y1'] = parseFloat(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
GradientEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['color'] = colorUtil.serializeRGB(this.color);
    json['opacity'] = this.opacity;
    json['mode'] = this.mode;
    json['x0'] = this.coords0.x;
    json['y0'] = this.coords0.y;
    json['x1'] = this.coords1.x;
    json['y1'] = this.coords1.y;
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
    coords0.copy(this.coords0);
    coords1.copy(this.coords1);
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
    var drawState = rasterizer.getDrawEventState(this, transform, GradientEventState);
    if (drawState.drawn) {
        return;
    }
    var coords0 = new Vec2();
    var coords1 = new Vec2();
    coords0.copy(this.coords0);
    coords1.copy(this.coords1);
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

export { GradientEvent };
