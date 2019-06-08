/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

/**
 * An event that is a part of the picture buffer's state.
 * @constructor
 * @param {string} eventType A short identifier for the type of the event. May
 * not contain spaces.
 */
var PictureEvent = function(eventType) {
    // TODO: Assert no spaces in eventType.
    this.eventType = eventType;
};

/**
 * @param {Object} json Json object to add event information to.
 */
PictureEvent.prototype.serializePictureEvent = function(json) {
    json['eventType'] = this.eventType;
    json['sid'] = this.sid;
    json['sessionEventId'] = this.sessionEventId;
    json['undone'] = this.undone;
};

/**
 * Parse values shared between different picture event classes from a JS object.
 * @param {Object} json JS object to parse values from.
 */
PictureEvent.prototype.pictureEventFromJS = function(json) {
    this.sid = json['sid'];
    this.sessionEventId = json['sessionEventId'];
    this.undone = json['undone'];
};

/**
 * Determine whether this event's bounding box intersects with the given
 * rectangle.
 * @param {Rect} rect The rectangle to intersect with.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @return {boolean} Does the event's axis-aligned bounding box intersect the
 * given rectangle?
 */
PictureEvent.prototype.boundsIntersectRect = function(rect, transform) {
    return this.getBoundingBox(rect, transform).intersectsRectRoundedOut(rect);
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

PictureEvent.types = {};

export { PictureEvent };
