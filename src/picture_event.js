/*
 * Copyright Olli Etuaho 2019.
 */

'use strict';

import { serializeToString } from './util/serialization.js';

import { PictureEvent } from './picture_event/picture_event.js';

import { BrushEvent } from './picture_event/brush_event.js';
import { BufferAddEvent } from './picture_event/buffer_add_event.js';
import { BufferMergeEvent } from './picture_event/buffer_merge_event.js';
import { BufferMoveEvent } from './picture_event/buffer_move_event.js';
import { BufferRemoveEvent } from './picture_event/buffer_remove_event.js';
import { EventHideEvent } from './picture_event/event_hide_event.js';
import { GradientEvent } from './picture_event/gradient_event.js';
import { RasterImportEvent } from './picture_event/raster_import_event.js';
import { ScatterEvent } from './picture_event/scatter_event.js';

/**
 * Parse a json representation of a PictureEvent from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 * @return {boolean} True if parsing succeeded.
 */
PictureEvent.parseLegacy = function(json, arr, i, version) {
    json['eventType'] = arr[i++];
    json['sid'] = parseInt(arr[i++]);
    json['sessionEventId'] = parseInt(arr[i++]);
    json['undone'] = (parseInt(arr[i++]) !== 0);

    var eventType = json['eventType'];
    if (eventType === 'brush') {
        BrushEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'scatter') {
        ScatterEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'gradient') {
        GradientEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'rasterImport') {
        RasterImportEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'bufferMerge') {
        BufferMergeEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'bufferAdd') {
        BufferAddEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'bufferRemove') {
        BufferRemoveEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'bufferMove') {
        BufferMoveEvent.parseLegacy(json, arr, i, version);
        return true;
    } else if (eventType === 'eventHide') {
        EventHideEvent.parseLegacy(json, arr, i, version);
        return true;
    } else {
        console.log('Unexpected picture event type ' + eventType);
        return false;
    }
};

/**
 * @param {Object} json JS object to parse values from.
 * @return {PictureEvent} The parsed event or null if the event was not recognized.
 */
PictureEvent.fromJS = function(json) {
    var eventType = json['eventType'];
    if (eventType === 'brush') {
        var event = new BrushEvent();
    } else if (eventType === 'scatter') {
        var event = new ScatterEvent();
    } else if (eventType === 'gradient') {
        var event = new GradientEvent();
    } else if (eventType === 'rasterImport') {
        var event = new RasterImportEvent();
    } else if (eventType === 'bufferMerge') {
        var event = new BufferMergeEvent();
    } else if (eventType === 'bufferAdd') {
        var event = new BufferAddEvent();
    } else if (eventType === 'bufferRemove') {
        var event = new BufferRemoveEvent();
    } else if (eventType === 'bufferMove') {
        var event = new BufferMoveEvent();
    } else if (eventType === 'eventHide') {
        var event = new EventHideEvent();
    } else {
        console.log('Unexpected picture event type ' + eventType);
        return null;
    }
    event.pictureEventFromJS(json);
    event.fromJS(json);
    return event;
};

/**
 * Create an identical copy of the given PictureEvent.
 * @param {PictureEvent} event Event to copy.
 * @return {PictureEvent} A copy of the event.
 */
PictureEvent.copy = function(event) {
    var serialization = serializeToString(event);
    return PictureEvent.fromJS(JSON.parse(serialization));
};

export {
    BrushEvent,
    BufferAddEvent,
    BufferMergeEvent,
    BufferMoveEvent,
    BufferRemoveEvent,
    EventHideEvent,
    GradientEvent,
    PictureEvent,
    RasterImportEvent,
    ScatterEvent
};