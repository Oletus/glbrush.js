/*
 * Copyright Olli Etuaho 2012-2013.
 */


import { Rect } from '../math/rect.js';

import * as colorUtil from '../util/color_util.js';

import { PictureEvent } from './picture_event.js';

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
 * @param {PictureBuffer} mergedBuffer The merged buffer.
 * @param {number} targetLayerId Id of the target layer.
 */
var BufferMergeEvent = function(sid, sessionEventId, undone, opacity, mergedBuffer, targetLayerId) {
    if (sid !== undefined) {
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.opacity = opacity;
        this.mergedBuffer = mergedBuffer;
        this.targetLayerId = targetLayerId;
    }
};

BufferMergeEvent.prototype = new PictureEvent('bufferMerge');

PictureEvent.types[BufferMergeEvent.prototype.eventType] = BufferMergeEvent;

/**
 * @param {Object} json JS object to parse values from.
 */
BufferMergeEvent.prototype.fromJS = function(json) {
    this.opacity = json['opacity'];
    this.mergedBuffer = {
        id: json['mergedBufferId'],
        isDummy: true
    };
    this.targetLayerId = json['targetLayerId'];
};

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
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
BufferMergeEvent.parseLegacy = function(json, arr, i, version) {
    json['opacity'] = parseFloat(arr[i++]);
    json['mergedBufferId'] = parseInt(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
BufferMergeEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['opacity'] = this.opacity;
    json['mergedBufferId'] = this.mergedBuffer.id;
    json['targetLayerId'] = this.targetLayerId;
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

export { BufferMergeEvent };
