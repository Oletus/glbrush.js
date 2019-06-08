/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

import * as colorUtil from '../util/color_util.js';

import { PictureEvent } from './picture_event.js';

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
var BufferMoveEvent = function(sid, sessionEventId, undone, movedId, fromIndex, toIndex) {
    if (sid !== undefined) {
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.movedId = movedId;
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }
};

BufferMoveEvent.prototype = new PictureEvent('bufferMove');

PictureEvent.types[BufferMoveEvent.prototype.eventType] = BufferMoveEvent;

/**
 * @param {Object} json JS object to parse values from.
 */
BufferMoveEvent.prototype.fromJS = function(json) {
    this.movedId = json['movedId'];
    this.fromIndex = json['fromIndex'];
    this.toIndex = json['toIndex'];
};

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
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BufferMoveEvent.parseLegacy = function(json, arr, i, version) {
    json['movedId'] = parseInt(arr[i++]);
    json['fromIndex'] = parseInt(arr[i++]);
    json['toIndex'] = parseInt(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
BufferMoveEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['movedId'] = this.movedId;
    json['fromIndex'] = this.fromIndex;
    json['toIndex'] = this.toIndex;

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

export { BufferMoveEvent };
