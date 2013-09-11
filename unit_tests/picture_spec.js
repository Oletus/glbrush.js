/*
 * Copyright Olli Etuaho 2013.
 */

var doPictureTest = function(mode) {
    var width = 122;
    var height = 234;
    function testPicture() {
        return new Picture(-1, new Rect(0, width, 0, height), 2.0, mode, 0);
    }

    it('initializes', function() {
        var pic = testPicture();
        expect(pic.id).toBe(-1);
        expect(pic.bitmapScale).toBe(2.0);
        expect(pic.mode).toEqual(mode);
        expect(pic.width()).toBe(width);
        expect(pic.height()).toBe(height);
        expect(pic.bitmapWidth()).toBe(width * 2.0);
        expect(pic.bitmapHeight()).toBe(height * 2.0);
    });

    it('contains buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[0].events[0].clearColor[0]).toBe(12);
        expect(pic.buffers[0].events[0].clearColor[1]).toBe(23);
        expect(pic.buffers[0].events[0].clearColor[2]).toBe(34);
        expect(pic.buffers[0].events[0].clearColor.length).toBe(3);
        expect(pic.buffers[0].undoStates).toEqual([]);
        expect(pic.buffers[0].hasAlpha).toBe(false);
        expect(pic.buffers[0].width()).toBe(pic.bitmapWidth());
        expect(pic.buffers[0].height()).toBe(pic.bitmapHeight());
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('finds a buffer according to id', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(123, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        expect(pic.findBufferIndex(pic.buffers, 123)).toBe(1);
        expect(pic.findBuffer(123)).toBe(pic.buffers[1]);
    });

    it('composits a current event in addition to buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.setCurrentEvent(brushEvent);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(56);
        expect(samplePixel[1]).toBe(67);
        expect(samplePixel[2]).toBe(78);
        expect(samplePixel[3]).toBe(255);
        pic.setCurrentEvent(null);
        samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('composits a current event with opacity', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 0.5, 10, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.setCurrentEvent(brushEvent);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(56 * 0.5 + 12 * 0.5, 5);
        expect(samplePixel[1]).toBeNear(67 * 0.5 + 23 * 0.5, 5);
        expect(samplePixel[2]).toBeNear(78 * 0.5 + 34 * 0.5, 5);
        expect(samplePixel[3]).toBe(255);
    });

    it('composits two buffers together', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true);
        var clearColor2 = [35, 46, 57, 68];
        pic.addBuffer(1338, clearColor2, true);
        var blendedPixel = colorUtil.blend(clearColor, clearColor2);
        pic.display(); // test that displaying twice doesn't leave underlying
        // pixels visible
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(blendedPixel[0], 8);
        expect(samplePixel[1]).toBeNear(blendedPixel[1], 8);
        expect(samplePixel[2]).toBeNear(blendedPixel[2], 8);
        expect(samplePixel[3]).toBeNear(blendedPixel[3], 8);
    });

    it('changes the order of two buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true);
        var clearColor2 = [35, 46, 57, 68];
        pic.addBuffer(1338, clearColor2, true);
        pic.moveBuffer(1338, 0);
        expect(pic.buffers[0].id).toBe(1338);
        expect(pic.buffers[1].id).toBe(1337);
        var blendedPixel = colorUtil.blend(clearColor2, clearColor);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(blendedPixel[0], 8);
        expect(samplePixel[1]).toBeNear(blendedPixel[1], 8);
        expect(samplePixel[2]).toBeNear(blendedPixel[2], 8);
        expect(samplePixel[3]).toBeNear(blendedPixel[3], 8);
    });

    it('resizes', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var pic2 = Picture.resize(pic, 3.0);
        expect(pic2.width()).toBe(pic.width());
        expect(pic2.height()).toBe(pic.height());
        expect(pic2.bitmapWidth()).toNotBe(pic.bitmapWidth());
        expect(pic2.bitmapHeight()).toNotBe(pic.bitmapHeight());
        expect(pic2.bitmapWidth()).toBe(pic2.width() * 3.0);
        expect(pic2.bitmapHeight()).toBe(pic2.height() * 3.0);
        var samplePixel = pic2.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('resizes to the maximum scale', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var pic2 = Picture.resize(pic, pic.maxBitmapScale());
        expect(pic2.width()).toBe(pic.width());
        expect(pic2.height()).toBe(pic.height());
        expect(pic2.bitmapWidth()).toBeLessThan(glUtils.maxFramebufferSize + 1);
        expect(pic2.bitmapHeight()).toBeLessThan(glUtils.maxFramebufferSize + 1);
        var samplePixel = pic2.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('does not change if it is resized to the same size twice', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.bitmapWidth(), pic.bitmapHeight(), 1.0);
        pic.pushEvent(1337, brushEvent);
        var pic2 = Picture.resize(pic, 0.5);
        pic2 = Picture.resize(pic2, 0.5);
        expect(pic2.width()).toBe(pic.width());
        expect(pic2.height()).toBe(pic.height());
        expect(pic2.bitmapWidth()).toBe(pic2.width() * 0.5);
        expect(pic2.bitmapHeight()).toBe(pic2.height() * 0.5);
        var samplePixel = pic2.getPixelRGBA(new Vec2(pic2.bitmapWidth() - 1,
                                                     pic2.bitmapHeight() - 1));
        expect(samplePixel[0]).toBe(56);
        expect(samplePixel[1]).toBe(67);
        expect(samplePixel[2]).toBe(78);
        expect(samplePixel[3]).toBe(255);
        var event = pic2.buffers[0].events[1];
        expect(event.coords[3]).toBeNear(pic2.bitmapWidth(), 1);
        expect(event.coords[4]).toBeNear(pic2.bitmapHeight(), 1);
    });

    it('composits buffers with opacity', function() {
        var pic = testPicture();
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        pic.setBufferOpacity(1, 0.5);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(127, 5);
        expect(samplePixel[1]).toBeNear(127, 5);
        expect(samplePixel[2]).toBeNear(127, 5);
        expect(samplePixel[3]).toBe(255);
    });

    it('serializes buffer opacities', function() {
        var pic = testPicture();
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        pic.setBufferOpacity(1, 0.5);
        pic = Picture.resize(pic, pic.bitmapScale);
        expect(pic.buffers[1].opacity()).toBe(0.5);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(127, 5);
        expect(samplePixel[1]).toBeNear(127, 5);
        expect(samplePixel[2]).toBeNear(127, 5);
        expect(samplePixel[3]).toBe(255);
    });
    
    it('serializes buffer merges', function() {
        var pic = testPicture();
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.pushEvent(1337, mergeEvent);
        expect(pic.buffers.length).toBe(1);
        expect(pic.mergedBuffers.length).toBe(1);
        expect(pic.mergedBuffers[0].mergedTo).toBe(pic.buffers[0]);

        pic = Picture.resize(pic, pic.bitmapScale);

        expect(pic.buffers.length).toBe(1);
        expect(pic.mergedBuffers.length).toBe(1);
        expect(pic.mergedBuffers[0].mergedTo).toBe(pic.buffers[0]);
    });

    it('can undo the latest event', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.bitmapWidth(), pic.bitmapHeight(), 1.0);
        pic.pushEvent(1337, brushEvent);
        var undoneEvent = pic.undoLatest();
        expect(undoneEvent).toBe(brushEvent);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });
    
    it('removes an event which is already undone', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.bitmapWidth(), pic.bitmapHeight(), 1.0);
        pic.pushEvent(1337, brushEvent);
        var undoneEvent = pic.undoLatest();
        expect(pic.buffers[0].events.length).toBe(2);
        expect(undoneEvent).toBe(brushEvent);
        expect(pic.removeEventSessionId(0, 0)).toBe(true);
        expect(pic.buffers[0].events.length).toBe(1);
    });

    it('only undoes events from the current active session', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.bitmapWidth(), pic.bitmapHeight(), 1.0);
        pic.pushEvent(1337, brushEvent);
        pic.setActiveSession(pic.activeSid + 1);
        var undoneEvent = pic.undoLatest();
        expect(undoneEvent).toBe(null);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(56);
        expect(samplePixel[1]).toBe(67);
        expect(samplePixel[2]).toBe(78);
        expect(samplePixel[3]).toBe(255);
    });

    it('applies a parsed merge event', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        var realMergedBuffer = mergeEvent.mergedBuffer;
        var serialization = mergeEvent.serialize(1.0);
        var splitSerialization = serialization.split(' ');
        mergeEvent = PictureEvent.parse(splitSerialization, 0);
        expect(mergeEvent.mergedBuffer).not.toBe(realMergedBuffer);
        expect(mergeEvent.mergedBuffer.isDummy).toBe(true);
        pic.pushEvent(1337, mergeEvent);
        expect(mergeEvent.mergedBuffer).toBe(realMergedBuffer);
        expect(mergeEvent.mergedBuffer.isDummy).toBe(false);
    });

    it('undoes a merge event', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.pushEvent(1337, mergeEvent);
        expect(pic.buffers.length).toBe(1);
        pic.undoLatest();
        expect(pic.buffers.length).toBe(2);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(9001);
    });

    it('inserts a merge event', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.insertEvent(1337, mergeEvent);
        expect(pic.buffers.length).toBe(1);
        pic.undoLatest();
        expect(pic.buffers.length).toBe(2);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(9001);
    });

    it('does not display buffers whose creation has been undone', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
        pic.undoLatest(false); // Don't keep last buffer
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);
    });

    it('does not display removed buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
        pic.removeBuffer(1337);
        expect(pic.buffers[0].isRemoved()).toBe(true);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);
    });

    it('can undo buffer removal', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.removeBuffer(1337);
        pic.undoLatest(); // Undo the buffer removal
        expect(pic.buffers[0].isRemoved()).toBe(false);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('serializes buffer removes', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.removeBuffer(1337);
        var pic2 = Picture.resize(pic, 1.0);
        expect(pic2.buffers[0].isRemoved()).toBe(true);
    });

    it('keeps the last buffer when undoing if told so', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.undoLatest(true); // Keep last buffer
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('undoes an event according to session id', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.undoEventSessionId(pic.activeSid, pic.activeSessionEventId - 1);
        expect(pic.buffers[0].events[0].undone).toBe(true);
    });

    it('undoes buffer moves', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        pic.addBuffer(1338, clearColor, false);
        pic.moveBuffer(9001, 0);
        pic.moveBuffer(1338, 0);
        pic.moveBuffer(1337, 0);
        pic.undoLatest();
        expect(pic.buffers[0].id).toBe(1338);
        expect(pic.buffers[1].id).toBe(9001);
        expect(pic.buffers[2].id).toBe(1337);
        pic.undoLatest();
        expect(pic.buffers[0].id).toBe(9001);
        expect(pic.buffers[1].id).toBe(1337);
        expect(pic.buffers[2].id).toBe(1338);
        pic.undoLatest();
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(9001);
        expect(pic.buffers[2].id).toBe(1338);
    });

    it('serializes and parses a picture with buffer moves', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        pic.addBuffer(1338, clearColor, false);
        pic.moveBuffer(9001, 0);
        pic.moveBuffer(1338, 0);
        var pic2 = Picture.resize(pic, 1.0);
        expect(pic2.buffers[0].id).toBe(pic.buffers[0].id);
        expect(pic2.buffers[1].id).toBe(pic.buffers[1].id);
        expect(pic2.buffers[2].id).toBe(pic.buffers[2].id);
        pic2.moveBuffer(9001, 0);
        expect(pic2.buffers[0].id).toBe(9001);
    });

    it('serializes buffer insertion points', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 5, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(5, 5, 1.0);
        pic.insertEvent(1337, brushEvent);
        expect(pic.buffers[0].insertionPoint).toBe(2);
        var pic2 = Picture.resize(pic, 1.0);
        expect(pic2.buffers[0].insertionPoint).toBe(2);
    });
};
 
describe('Picture', function() {
    var modes = ['canvas', 'webgl', 'no-texdata-webgl', 'no-float-webgl'];
    for (var i = 0; i < modes.length; ++i) {
        describe('in mode ' + modes[i], function() {
            doPictureTest(modes[i]);
        });
    }
});
