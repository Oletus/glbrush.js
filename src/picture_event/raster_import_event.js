/*
 * Copyright Olli Etuaho 2012-2013.
 */

'use strict';

import { Rect } from '../math/rect.js';

import { Vec2 } from '../math/vec2.js';

import { PictureEvent } from './picture_event.js';

/**
 * Event that adds an imported raster image into a buffer.
 * @constructor
 * @param {number} sid Session identifier. Must be an integer.
 * @param {number} sessionEventId An event/session specific identifier. The idea
 * is that the sid/sessionEventId pair is unique for this event, and that newer
 * events will have greater sessionEventIds. Must be an integer.
 * @param {boolean} undone Whether this event is undone.
 * @param {HTMLImageElement} importedImage The imported image.
 * @param {Rect} rect Rectangle defining the position and scale of the imported image in the buffer.
 */
var RasterImportEvent = function(sid, sessionEventId, undone, importedImage, rect) {
    if (sid !== undefined) {
        this.sid = sid;
        this.sessionEventId = sessionEventId;
        this.undone = undone;
        this.rect = rect;
        this.loadImg(importedImage);
    }
};

RasterImportEvent.prototype = new PictureEvent('rasterImport');

/**
 * Load an image element. this.loaded will be set to true once loading is complete.
 * @param {HTMLImageElement} importedImage Image to load.
 */
RasterImportEvent.prototype.loadImg = function(importedImage) {
    this.importedImage = document.createElement('img');
    this.loaded = false;
    var that = this;
    this.importedImage.onload = function() {
        that.loaded = true;
    };
    if (importedImage.src.substring(0, 4) === 'data') {
        this.importedImage.src = importedImage.src;
    } else {
        var c = document.createElement('canvas');
        c.width = importedImage.width;
        c.height = importedImage.height;
        var ctx = c.getContext('2d');
        ctx.drawImage(importedImage, 0, 0);
        this.importedImage.src = c.toDataURL();
    }
};

/**
 * @param {Object} json JS object to parse values from.
 */
RasterImportEvent.prototype.fromJS = function(json) {
    this.rect = new Rect();
    this.rect.left = json['left'];
    this.rect.right = json['right'];
    this.rect.top = json['top'];
    this.rect.bottom = json['bottom'];
    var img = document.createElement('img');
    img.src = json['src'];
    this.loadImg(img);
};

/**
 * Parse a RasterImportEvent from a tokenized serialization.
 * @param {Object} json JS object corresponding to the event to add parsed information to.
 * @param {Array.<string>} arr Array containing the tokens, split at spaces from
 * the original serialization.
 * @param {number} i Index of the first token to deserialize.
 * @param {number} version Version number of the serialization format.
 */
RasterImportEvent.parseLegacy = function(json, arr, i, version) {
    json['src'] = arr[i++]; // data URI
    json['left'] = parseFloat(arr[i++]);
    json['right'] = parseFloat(arr[i++]);
    json['top'] = parseFloat(arr[i++]);
    json['bottom'] = parseFloat(arr[i++]);
};

/**
 * @param {Object} json JS object to serialize the event data to, that can then be stringified.
 */
RasterImportEvent.prototype.serialize = function(json) {
    this.serializePictureEvent(json);
    json['src'] = this.importedImage.src;
    json['left'] = this.rect.left;
    json['right'] = this.rect.right;
    json['top'] = this.rect.top;
    json['bottom'] = this.rect.bottom;

};

/**
 * @param {Rect} clipRect Canvas bounds that can be used to intersect the
 * bounding box against, though this is not mandatory.
 * @param {AffineTransform} transform Transform for the event coordinates.
 * @return {Rect} The event's bounding box. This function is not allowed to
 * change its earlier return values as a side effect.
 */
RasterImportEvent.prototype.getBoundingBox = function(clipRect, transform) {
    var bbRect = new Rect();
    // TODO: Support AffineTransforms that do rotating - this assumes that the AffineTransform only does scaling and translating.
    bbRect.left = transform.transformX(this.rect.left, this.rect.top);
    bbRect.right = transform.transformX(this.rect.right, this.rect.top);
    bbRect.top = transform.transformY(this.rect.left, this.rect.top);
    bbRect.bottom = transform.transformY(this.rect.left, this.rect.bottom);
    return bbRect;
};

/**
 * @return {boolean} Is the event drawn using a rasterizer?
 */
RasterImportEvent.prototype.isRasterized = function() {
    return false;
};

/**
 * Scale this event. This will change the coordinates of the bitmap.
 * @param {number} scale Scaling factor. Must be larger than 0.
 */
RasterImportEvent.prototype.scale = function(scale) {
    //TODO: assert(scale > 0)
    this.rect.scale(scale);
};

/**
 * Translate this event. This will change the coordinates of the bitmap.
 * @param {Vec2} offset The vector to translate with.
 */
RasterImportEvent.prototype.translate = function(offset) {
    this.rect.translate(offset);
};

export { RasterImportEvent };
