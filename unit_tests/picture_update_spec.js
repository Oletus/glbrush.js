/*
 * Copyright Olli Etuaho 2014.
 */


import { serializeToString } from '../src/util/serialization.js';

import { PictureUpdate } from '../src/picture_update.js';

import { testBrushEvent, expectTestBrushEvent } from './test_util.js';

describe('PictureUpdate', function() {
    it('initializes', function() {
        var testUpdate = new PictureUpdate('add_picture_event');
        expect(testUpdate.updateType).toBe('add_picture_event');
    });

    it('can contain a PictureEvent', function() {
        var testUpdate = new PictureUpdate('add_picture_event');
        testUpdate.setPictureEvent(testBrushEvent());
        expect(testUpdate.updateType).toBe('add_picture_event');
        expectTestBrushEvent(testUpdate.pictureEvent);
    });

    it('adds the same PictureEvent after a round of serialization and parsing', function() {
        var testUpdate = new PictureUpdate('add_picture_event');
        testUpdate.setPictureEvent(testBrushEvent());
        var jsonStr = serializeToString(testUpdate);
        var parsedJson = JSON.parse(jsonStr);
        var parsedUpdate = PictureUpdate.fromJS(parsedJson);
        expect(parsedUpdate.updateType).toBe('add_picture_event');
        expectTestBrushEvent(parsedUpdate.pictureEvent);
    });

    it('can contain undo data', function() {
        var testUpdate = new PictureUpdate('undo');
        testUpdate.setUndoEvent(3, 4);
        expect(testUpdate.updateType).toBe('undo');
        expect(testUpdate.undoneSid).toBe(3);
        expect(testUpdate.undoneSessionEventId).toBe(4);
    });

    it('contains the same undo data after a round of serialization and parsing', function() {
        var testUpdate = new PictureUpdate('undo');
        testUpdate.setUndoEvent(3, 4);
        var jsonStr = serializeToString(testUpdate);
        var parsedJson = JSON.parse(jsonStr);
        var parsedUpdate = PictureUpdate.fromJS(parsedJson);
        expect(parsedUpdate.updateType).toBe('undo');
        expect(parsedUpdate.undoneSid).toBe(3);
        expect(parsedUpdate.undoneSessionEventId).toBe(4);
    });
});
