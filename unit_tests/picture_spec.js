/*
 * Copyright Olli Etuaho 2013.
 */

var doPictureTestWithCleanup = function(mode, width, height, testPicture) {
    var pic = null;
    beforeEach(function() {
        pic = testPicture();
    });
    afterEach(function() {
        pic.destroy();
        pic = null;
    });

    it('initializes', function() {
        expect(pic.id).toBe(-1);
        expect(pic.name).toBe('testpicturename');
        expect(pic.bitmapScale).toBe(2.0);
        expect(pic.mode).toEqual(mode);
        expect(pic.width()).toBe(width);
        expect(pic.height()).toBe(height);
        expect(pic.bitmapWidth()).toBe(width * 2.0);
        expect(pic.bitmapHeight()).toBe(height * 2.0);
        expect(pic.buffers.length).toBe(0);
    });

    it('contains buffers', function() {
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(123, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        expect(pic.findBufferIndex(pic.buffers, 123)).toBe(1);
        expect(pic.findBuffer(123)).toBe(pic.buffers[1]);
    });

    it('finds the buffer containing a specific event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(123, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 1, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.pushEvent(123, brushEvent);
        expect(pic.findBufferContainingEvent(brushEvent)).toBe(123);
    });

    it('counts the events it contains', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        expect(pic.getEventCount()).toBe(1);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 1, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.pushEvent(1337, brushEvent);
        expect(pic.getEventCount()).toBe(2);
    });

    it('handles pushing an undone buffer add event', function() {
        var memoryUseWas = pic.memoryUse;
        var clearColor = [12, 23, 34];
        var addEvent = pic.createBufferAddEvent(1337, false, clearColor);
        addEvent.undone = true;
        pic.pushEvent(1337, addEvent);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[0].events[0].clearColor[0]).toBe(12);
        expect(pic.buffers[0].events[0].clearColor[1]).toBe(23);
        expect(pic.buffers[0].events[0].clearColor[2]).toBe(34);
        expect(pic.buffers[0].events[0].clearColor.length).toBe(3);
        expect(pic.buffers[0].hasAlpha).toBe(false);
        expect(pic.buffers[0].width()).toBe(pic.bitmapWidth());
        expect(pic.buffers[0].height()).toBe(pic.bitmapHeight());

        expect(pic.buffers[0].events[0].undone).toBe(true);
        expect(pic.buffers[0].isRemoved()).toBe(true);
        expect(pic.buffers[0].freed).toBe(true);
        expect(pic.memoryUse).toBe(memoryUseWas);

        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);
    });

    it('determines the id of the top composited buffer', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(123, clearColor, false);
        expect(pic.topCompositedBufferId()).toBe(123);
        pic.setBufferVisible(123, false);
        expect(pic.topCompositedBufferId()).toBe(1337);
    });

    it('composits a current event in addition to buffers', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.setCurrentEventAttachment(1337);
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 0.5, 10, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.setCurrentEventAttachment(1337);
        pic.setCurrentEvent(brushEvent);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(56 * 0.5 + 12 * 0.5, 5);
        expect(samplePixel[1]).toBeNear(67 * 0.5 + 23 * 0.5, 5);
        expect(samplePixel[2]).toBeNear(78 * 0.5 + 34 * 0.5, 5);
        expect(samplePixel[3]).toBe(255);
    });

    it('composits two buffers together', function() {
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

    it('composits more buffers than there are texture units', function() {
        var clearColor = [60, 120, 240, 45];
        var id = 0;
        var blendedPixel = [0, 0, 0, 0];
        while (pic.buffers.length <= glUtils.maxTextureUnits) {
            pic.addBuffer(id, clearColor, true);
            blendedPixel = colorUtil.blend(blendedPixel, clearColor);
        }
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(blendedPixel[0], 10);
        expect(samplePixel[1]).toBeNear(blendedPixel[1], 10);
        expect(samplePixel[2]).toBeNear(blendedPixel[2], 10);
        expect(samplePixel[3]).toBeNear(blendedPixel[3], 10);
    });

    it('changes the order of two buffers', function() {
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

    it('handles pushing an undone buffer move event', function() {
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true);
        var clearColor2 = [35, 46, 57, 68];
        pic.addBuffer(1338, clearColor2, true);
        var moveEvent = pic.createBufferMoveEvent(1338, 0);
        moveEvent.undone = true;
        pic.pushEvent(1338, moveEvent);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(1338);
        var blendedPixel = colorUtil.blend(clearColor, clearColor2);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(blendedPixel[0], 8);
        expect(samplePixel[1]).toBeNear(blendedPixel[1], 8);
        expect(samplePixel[2]).toBeNear(blendedPixel[2], 8);
        expect(samplePixel[3]).toBeNear(blendedPixel[3], 8);
    });

    it('resizes', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var pic2 = Picture.resize(pic, 3.0);
        expect(pic2.parsedVersion).toBe(Picture.formatVersion);
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
        pic2.destroy();
    });

    it('resizes to the maximum scale', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var pic2 = Picture.resize(pic, pic.maxBitmapScale());
        expect(pic2.width()).toBe(pic.width());
        expect(pic2.height()).toBe(pic.height());
        var maxWidth = glUtils.maxFramebufferSize;
        expect(pic2.bitmapWidth()).toBeLessThan(maxWidth + 1);
        expect(pic2.bitmapHeight()).toBeLessThan(maxWidth + 1);
        var samplePixel = pic2.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
        pic2.destroy();
    });

    it('does not change if it is resized to the same size twice', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
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
        pic2.destroy();
    });

    it('composits buffers with opacity', function() {
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        pic.setBufferOpacity(1338, 0.5);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(127, 5);
        expect(samplePixel[1]).toBeNear(127, 5);
        expect(samplePixel[2]).toBeNear(127, 5);
        expect(samplePixel[3]).toBe(255);
    });

    it('serializes buffer opacities', function() {
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        pic.setBufferOpacity(1338, 0.5);
        pic = Picture.resize(pic, pic.bitmapScale);
        expect(pic.buffers[1].opacity()).toBe(0.5);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(127, 5);
        expect(samplePixel[1]).toBeNear(127, 5);
        expect(samplePixel[2]).toBeNear(127, 5);
        expect(samplePixel[3]).toBe(255);
    });

    it('serializes buffer merges', function() {
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.pushEvent(1337, mergeEvent);
        expect(pic.buffers[1].mergedTo).toBe(pic.buffers[0]);

        var pic2 = Picture.resize(pic, pic.bitmapScale);

        expect(pic2.buffers[1].mergedTo).toBe(pic2.buffers[0]);
        pic2.destroy();
    });

    it('can undo the latest event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        var realMergedBuffer = mergeEvent.mergedBuffer;
        var serialization = mergeEvent.serialize(1.0);
        var splitSerialization = serialization.split(' ');
        mergeEvent = PictureEvent.parse(splitSerialization, 0,
                                        Picture.formatVersion);
        expect(mergeEvent.mergedBuffer).not.toBe(realMergedBuffer);
        expect(mergeEvent.mergedBuffer.isDummy).toBe(true);
        pic.pushEvent(1337, mergeEvent);
        expect(mergeEvent.mergedBuffer).toBe(realMergedBuffer);
        expect(mergeEvent.mergedBuffer.isDummy).toBe(false);
    });

    it('undoes a merge event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.pushEvent(1337, mergeEvent);
        expect(pic.buffers[1].mergedTo).toBe(pic.buffers[0]);
        pic.undoLatest();
        expect(pic.buffers[1].mergedTo).toBe(null);
    });

    it('does not act on an undone merge event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        mergeEvent.undone = true;
        pic.pushEvent(1337, mergeEvent);
        expect(pic.buffers.length).toBe(2);
        expect(pic.buffers[0].events[1]).toBe(mergeEvent);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(9001);
        expect(pic.buffers[1].mergedTo).toBe(null);
        mergeEvent = pic.createMergeEvent(1, 0.7);
        mergeEvent.undone = true;
        pic.insertEvent(1337, mergeEvent);
        expect(pic.buffers.length).toBe(2);
        expect(pic.buffers[0].events[1]).toBe(mergeEvent);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(9001);
        expect(pic.buffers[1].mergedTo).toBe(null);
    });

    it('inserts a buffer merge event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.insertEvent(1337, mergeEvent);
        expect(pic.buffers[1].mergedTo).toBe(pic.buffers[0]);
        pic.undoLatest();
        expect(pic.buffers[1].mergedTo).toBe(null);
    });

    it('inserts a buffer remove event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var removeEvent = pic.createBufferRemoveEvent(9001);
        pic.insertEvent(9001, removeEvent);
        expect(pic.buffers.length).toBe(2);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[1].id).toBe(9001);
        expect(pic.buffers[1].isRemoved()).toBe(true);
        expect(pic.buffers[1].freed).toBe(true);
    });

    it('does not display buffers whose creation has been undone', function() {
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
        pic.removeBuffer(1337);
        expect(pic.buffers[0].isRemoved()).toBe(true);
        // The buffer didn't have many events, so it should have been freed
        expect(pic.buffers[0].freed).toBe(true);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);
    });

    it('undoes buffer removal', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.removeBuffer(1337);
        expect(pic.buffers[0].isRemoved()).toBe(true);
        expect(pic.buffers[0].freed).toBe(true);
        pic.undoLatest(); // Undo the buffer removal
        expect(pic.buffers[0].isRemoved()).toBe(false);
        expect(pic.buffers[0].freed).toBe(false);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('redoes buffer removal', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.removeBuffer(1337);
        pic.undoLatest(); // Undo the buffer removal
        pic.redoEventSessionId(pic.activeSid, pic.activeSessionEventId - 1);
        expect(pic.buffers[0].isRemoved()).toBe(true);
        expect(pic.buffers[0].freed).toBe(true);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);
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
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var undone = pic.undoEventSessionId(pic.activeSid,
                                            pic.activeSessionEventId - 1);
        expect(undone).toBe(pic.buffers[0].events[0]);
        expect(pic.buffers[0].events[0].undone).toBe(true);
    });

    it('frees buffers whose creation has been undone and replays them if creation is redone', function() {
        var memoryUseBeforeBuffers = pic.memoryUse;
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var memoryUseWas = pic.memoryUse;
        var undone = pic.undoEventSessionId(pic.activeSid,
                                            pic.activeSessionEventId - 1);
        expect(pic.buffers[0].events[0].undone).toBe(true);
        expect(pic.buffers[0].freed).toBe(true);
        expect(pic.memoryUse).toBeLessThan(memoryUseWas);
        expect(pic.memoryUse).toBe(memoryUseBeforeBuffers);
        // Freed buffers' contents may still be changed, test that:
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.bitmapWidth(), pic.bitmapHeight(), 1.0);
        pic.pushEvent(1337, brushEvent);
        pic.redoEventSessionId(pic.activeSid, pic.activeSessionEventId - 2);
        expect(pic.buffers[0].freed).toBe(false);
        expect(pic.memoryUse).toBe(memoryUseWas);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(56);
        expect(samplePixel[1]).toBe(67);
        expect(samplePixel[2]).toBe(78);
        expect(samplePixel[3]).toBe(255);
    });

    it('undoes an event according to session id from a merged buffer', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.addBuffer(9001, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 5, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(5, 5, 1.0);
        pic.pushEvent(9001, brushEvent);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        pic.pushEvent(1337, mergeEvent);
        var undone = pic.undoEventSessionId(pic.activeSid,
                                            pic.activeSessionEventId - 2);
        expect(undone).toBe(pic.buffers[1].events[1]);
        expect(pic.buffers[1].events[1].undone).toBe(true);
    });

    it('undoes buffer moves', function() {
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
        pic2.destroy();
    });

    it('serializes buffer insertion points', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 5, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(5, 5, 1.0);
        pic.insertEvent(1337, brushEvent);
        expect(pic.buffers[0].insertionPoint).toBe(2);
        var pic2 = Picture.resize(pic, 1.0);
        expect(pic2.buffers[0].insertionPoint).toBe(2);
        pic2.destroy();
    });

    it('places app-specific metadata into an array when parsing', function() {
        var serialization = pic.serialize();
        serialization += '\nmetadata\nappdata';
        var parsed = Picture.parse(0, serialization, 1.0, [pic.mode]);
        expect(parsed.metadata[0]).toBe('metadata');
        expect(parsed.metadata[1]).toBe('appdata');
    });

    it('calculates its memory usage', function() {
        var rasterizerUse = pic.currentEventRasterizer.getMemoryBytes() +
                            pic.genericRasterizer.getMemoryBytes();
        var compositorUse = pic.bitmapWidth() * pic.bitmapHeight() * 4;
        expect(pic.memoryUse).toBe(rasterizerUse + compositorUse);
        var clearColor = [12, 23, 34, 0];
        pic.addBuffer(1337, clearColor, true);
        var states = pic.buffers[0].undoStateBudget + 1;
        var bufferUse = pic.bitmapWidth() * pic.bitmapHeight() * 4 * states;
        expect(pic.memoryUse).toBe(rasterizerUse + compositorUse + bufferUse);
    });

    it('limits its memory usage to meet the given budget', function() {
        var threeStates = pic.bitmapWidth() * pic.bitmapHeight() * 4 * 3;
        pic.memoryBudget = pic.memoryUse + threeStates;
        var clearColor = [12, 23, 34, 0];
        pic.addBuffer(1337, clearColor, true);
        expect(pic.buffers[0].undoStateBudget).toBeLessThan(3);
        expect(pic.memoryUse).toBe(pic.memoryBudget);
    });
};

var doPictureTest = function(mode) {
    var width = 122;
    var height = 234;
    var testPicture = function() {
        return new Picture(-1, 'testpicturename', new Rect(0, width, 0, height), 2.0, mode, 0);
    };

    describe('tests with cleanup', function() {
        doPictureTestWithCleanup(mode, width, height, testPicture);
    });

    it('parses a picture without a version number', function() {
        var parsed = Picture.parse(-1, 'picture 122 234', 2.0, [mode]);
        var pic = parsed.picture;
        expect(pic.parsedVersion).toBe(0);
        expect(pic.id).toBe(-1);
        expect(pic.name).toBe(null);
        expect(pic.bitmapScale).toBe(2.0);
        expect(pic.mode).toEqual(mode);
        expect(pic.width()).toBe(122);
        expect(pic.height()).toBe(234);
        expect(pic.bitmapWidth()).toBe(width * 2.0);
        expect(pic.bitmapHeight()).toBe(height * 2.0);
        expect(pic.buffers.length).toBe(0);
    });

    it('converts to a dataURL', function() {
        var clearColor = [12, 23, 34];
        var img = null;
        runs(function() {
            var pic = testPicture();
            pic.addBuffer(1337, clearColor, false);
            var dataURL = pic.toDataURL();
            var i = document.createElement('img');
            i.onload = function() {
                img = i;
            };
            i.src = dataURL;
        });
        waitsFor(function() {
            return img !== null;
        });
        runs(function() {
            clearColor.push(255); // imageData is always RGBA
            expect(clearColor.length).toBe(4);
            expect(countColoredPixelsInImage(img, clearColor, 4)).toBe(img.width * img.height);
        });
    });

    it('converts to a Blob', function() {
        var blob = null;
        var clearColor = [12, 23, 34];
        var img = null;
        var blobCallback = function(b) {
            blob = b;
        };
        runs(function() {
            var pic = testPicture();
            pic.addBuffer(1337, clearColor, false);
            // Make this test always asynchronous since toBlob is allowed to be asynchronous.
            setTimeout(function() {
                pic.toBlob(blobCallback);
            }, 0);
        });
        waitsFor(function() {
            return blob !== null;
        });
        runs(function() {
            var i;
            expect(blob instanceof Blob).toBe(true);
            expect(blob.type).toBe('image/png');
            var i = document.createElement('img');
            i.onload = function() {
                img = i;
            };
            // TODO: Check the spec of createObjectURL once it's stable (also revokeObjectURL below)
            var createObjectURL = null;
            try {
                createObjectURL = URL.createObjectURL;
            } catch (e) {}
            if (!createObjectURL) {
                createObjectURL = webkitURL.createObjectURL;
            }
            i.src = createObjectURL(blob);
        });
        waitsFor(function() {
            return img !== null;
        });
        runs(function() {
            clearColor.push(255); // imageData is always RGBA
            expect(clearColor.length).toBe(4);
            expect(countColoredPixelsInImage(img, clearColor, 4)).toBe(img.width * img.height);
            var objURL = img.src;
            img.src = '';
            var revokeObjectURL = null;
            try {
                revokeObjectURL = URL.revokeObjectURL;
            } catch (e) {}
            if (!revokeObjectURL) {
                revokeObjectURL = webkitURL.revokeObjectURL;
            }
            revokeObjectURL(objURL);
        });
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
