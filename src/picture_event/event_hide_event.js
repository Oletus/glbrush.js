/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

import { PictureEvent } from './picture_event.js';

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
var EventHideEvent = function(sid, sessionEventId, undone, hiddenSid, hiddenSessionEventId) {
    if (sid !== undefined) {
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.hiddenSid = hiddenSid;
        this.hiddenSessionEventId = hiddenSessionEventId;
    }
};

EventHideEvent.prototype = new PictureEvent('eventHide');

/**
 * @param {Object} json JS object to parse values from.
 */
EventHideEvent.prototype.fromJS = function(json) {
    this.hiddenSid = json['hiddenSid'];
    this.hiddenSessionEventId = json['hiddenSessionEventId'];
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
EventHideEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * Parse an EventHideEvent from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
EventHideEvent.parseLegacy = function(json, arr, i, version) {
    json['hiddenSid'] = parseInt(arr[i++]);
    json['hiddenSessionEventId'] = parseInt(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
EventHideEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['hiddenSid'] = this.hiddenSid;
    json['hiddenSessionEventId'] = this.hiddenSessionEventId;
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

export { EventHideEvent };
