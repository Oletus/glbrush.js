/*
 * Copyright Olli Etuaho 2012-2013.
 */


import { Rect } from '../math/rect.js';

import * as colorUtil from '../util/color_util.js';

import { PictureEvent } from './picture_event.js';

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
    if (sid !== undefined) {
        // TODO: assert(clearColor.length === (hasAlpha ? 4 : 3));
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.bufferId = bufferId;
        this.hasAlpha = hasAlpha;
        this.clearColor = clearColor;
        this.opacity = opacity;

        // TODO: storing this is necessary for restoring complete picture state,
        // but might not really logically belong in the add event.
        // Note that this is not used when the event is pushed to a picture the
        // usual way, only when a whole picture is parsed / serialized!
        this.insertionPoint = insertionPoint;
    }
};

BufferAddEvent.prototype = new PictureEvent('bufferAdd');

PictureEvent.types[BufferAddEvent.prototype.eventType] = BufferAddEvent;

/**
 * @param {Object} json JS object to parse values from.
 */
BufferAddEvent.prototype.fromJS = function(json) {
    this.bufferId = json['bufferId'];
    this.hasAlpha = json['hasAlpha'];
    this.clearColor = json['backgroundColor'];
    if (this.hasAlpha) {
        this.clearColor[3] = json['backgroundAlpha'];
    }
    this.opacity = json['opacity'];
    this.insertionPoint = json['insertionPoint'];
};

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
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BufferAddEvent.parseLegacy = function(json, arr, i, version) {
    json['bufferId'] = parseInt(arr[i++]);
    json['hasAlpha'] = arr[i++] === '1';
    var clearColor = [];
    clearColor[0] = parseInt(arr[i++]);
    clearColor[1] = parseInt(arr[i++]);
    clearColor[2] = parseInt(arr[i++]);
    json['backgroundColor'] = clearColor;
    if (json['hasAlpha']) {
        json['backgroundAlpha'] = parseInt(arr[i++]);
    }
    json['opacity'] = parseFloat(arr[i++]);
    json['insertionPoint'] = parseInt(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
BufferAddEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['bufferId'] = this.bufferId;
    json['hasAlpha'] = this.hasAlpha;
    json['backgroundColor'] = colorUtil.serializeRGB(this.clearColor);
    if (this.hasAlpha) {
        json['backgroundAlpha'] = this.clearColor[3];
    }
    json['opacity'] = this.opacity;
    json['insertionPoint'] = this.insertionPoint;

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

export { BufferAddEvent };
