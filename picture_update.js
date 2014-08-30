/*
 * Copyright Olli Etuaho 2014.
 */

'use strict';

/**
 * A change to the picture state. Can either add or undo a PictureEvent.
 * @constructor
 * @param {string} updateType Type of the update.
 */
var PictureUpdate = function(updateType) {
    this.updateType = updateType;
};

/**
 * Set data for adding a picture event.
 * @param {number} targetLayerId Id of the layer where to add the event.
 * @param {PictureEvent} pictureEvent The event.
 */
PictureUpdate.prototype.setPictureEvent = function(targetLayerId, pictureEvent) {
    if (this.updateType !== 'add_picture_event') {
        console.log('Set picture event properties for "' + this.updateType + '" update');
        return;
    }
    this.targetLayerId = targetLayerId;
    this.pictureEvent = pictureEvent;
};

/**
 * @param {number} sid The session id.
 * @param {number} sessionEventId The session-specific event id.
 * @return {boolean} True if this update adds the picture event with the given
 * id.
 */
PictureUpdate.prototype.doesAddPictureEventWithSessionId = function(sid, sessionEventId) {
    if (this.updateType !== 'add_picture_event' || this.pictureEvent === undefined) {
        return false;
    }
    return this.pictureEvent.sid === sid && this.pictureEvent.sessionEventId === sessionEventId;
};

/**
 * Set data for undoing an event.
 * @param {number} undoneSid Session id of the undone event.
 * @param {number} undoneSessionEventId Session-specific even id of the undone
 * event.
 */
PictureUpdate.prototype.setUndoEvent = function(undoneSid, undoneSessionEventId) {
    if (this.updateType !== 'undo') {
        console.log('Set undo event properties for "' + this.updateType + '" update');
        return;
    }
    this.undoneSid = undoneSid;
    this.undoneSessionEventId = undoneSessionEventId;
};

/**
 * @return {string} A serialization of the update.
 */
PictureUpdate.prototype.serialize = function() {
    var eventMessage = '' + this.updateType;
    if (this.updateType === 'add_picture_event') {
        eventMessage += ' ' + this.targetLayerId + ' ' + this.pictureEvent.serialize();
    } else if (this.updateType === 'undo') {
        eventMessage += ' ' + this.undoneSid + ' ' + this.undoneSessionEventId;
    }
    return eventMessage;
};

/**
 * Create an update from its serialization.
 * @param {string} string String to parse.
 * @return {?PictureUpdate} The parsed update or null if could not parse.
 */
PictureUpdate.parse = function(string) {
    var arr = string.split(' ');
    if (arr.length < 1) {
        console.log('Malformed PictureUpdate read');
        return null;
    }
    var i = 0;
    var updateType = arr[i++];
    var update = new PictureUpdate(updateType);
    if (updateType === 'add_picture_event') {
        var targetLayerId = parseInt(arr[i++]);
        var pictureEvent = PictureEvent.parse(arr, i, Picture.formatVersion);
        if (pictureEvent === null) {
            return null;
        }
        update.setPictureEvent(targetLayerId, pictureEvent);
    } else if (updateType === 'undo') {
        var undoneSid = parseInt(arr[i++]);
        var undoneSessionEventId = parseInt(arr[i++]);
        update.setUndoEvent(undoneSid, undoneSessionEventId);
    } else {
        console.log('Unrecognized PictureUpdate type ' + updateType);
        return null;
    }
    return update;
};
