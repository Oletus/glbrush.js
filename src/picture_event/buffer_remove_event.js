/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

import * as colorUtil from '../util/color_util.js';

import { PictureEvent } from './picture_event.js';

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
    if (sid !== undefined) {
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.bufferId = bufferId;
    }
};

BufferRemoveEvent.prototype = new PictureEvent('bufferRemove');

PictureEvent.types[BufferRemoveEvent.prototype.eventType] = BufferRemoveEvent;

/**
 * @param {Object} json JS object to parse values from.
 */
BufferRemoveEvent.prototype.fromJS = function(json) {
    this.bufferId = json['removedBufferId'];
};

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
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BufferRemoveEvent.parseLegacy = function(json, arr, i, version) {
    json['removedBufferId'] = parseInt(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
BufferRemoveEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['removedBufferId'] = this.bufferId;

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

export { BufferRemoveEvent };
