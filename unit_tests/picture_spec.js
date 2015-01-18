/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

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
        expect(pic.pictureTransform.scale).toBe(2.0);
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

    it('composits a transparent event into a transparent buffer', function() {
        // Bottom buffer is opaque. Two buffers are needed since otherwise potentially inf/NaN rgb color values
        // from the top buffer's blending result could not affect a subsequent blending operation.
        var clearColor = [255, 255, 255];
        pic.addBuffer(1336, clearColor, false);
        // Top buffer is transparent.
        clearColor = [0, 0, 0, 0];
        pic.addBuffer(1337, clearColor, true);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 0.0, 10, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
        pic.setCurrentEventAttachment(1337);
        pic.setCurrentEvent(brushEvent);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(255);
        expect(samplePixel[1]).toBe(255);
        expect(samplePixel[2]).toBe(255);
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

    it('resizes when being copied', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var pic2;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        }, 3.0);
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
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
    });

    it('resizes to the maximum scale', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        pic.crop(pic.boundsRect, pic.maxBitmapScale());
        expect(pic.width()).toBe(width);
        expect(pic.height()).toBe(height);
        var maxWidth = glUtils.maxFramebufferSize;
        expect(pic.bitmapWidth()).toBeLessThan(maxWidth + 1);
        expect(pic.bitmapHeight()).toBeLessThan(maxWidth + 1);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('handles bitmapScale as relative to the picture dimensions, not bitmap dimensions', function() {
        // The picture is copied twice with the same bitmapScale, and we check that the dimensions are the same
        // in both of the two copies.
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.width(), pic.height(), 1.0);
        var update = new PictureUpdate('add_picture_event');
        update.setPictureEvent(1337, brushEvent);
        pic.pushUpdate(update);
        var pic2;
        var pic3;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        }, 0.5);
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
            Picture.copy(pic2, function(p3) {
                pic3 = p3;
                pic2.destroy();
            }, 0.5);
        });
        waitsFor(function() {
            return pic3 !== undefined;
        });
        runs(function() {
            expect(pic3.width()).toBe(pic.width());
            expect(pic3.height()).toBe(pic.height());
            expect(pic3.bitmapWidth()).toBe(pic3.width() * 0.5);
            expect(pic3.bitmapHeight()).toBe(pic3.height() * 0.5);
            expect(pic3.pictureTransform.scale).toBe(0.5);
            var samplePixel = pic3.getPixelRGBA(new Vec2(pic3.bitmapWidth() - 1,
                                                         pic3.bitmapHeight() - 1));
            expect(samplePixel[0]).toBe(56);
            expect(samplePixel[1]).toBe(67);
            expect(samplePixel[2]).toBe(78);
            expect(samplePixel[3]).toBe(255);
            var event = pic3.buffers[0].events[1];
            expect(event.coords[3]).toBeNear(pic3.width(), 1);
            expect(event.coords[4]).toBeNear(pic3.height(), 1);
            pic3.destroy();
        });
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
        var pic2;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        });
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
            expect(pic2.buffers[1].opacity()).toBe(0.5);
            var samplePixel = pic2.getPixelRGBA(new Vec2(0, 0));
            expect(samplePixel[0]).toBeNear(127, 5);
            expect(samplePixel[1]).toBeNear(127, 5);
            expect(samplePixel[2]).toBeNear(127, 5);
            expect(samplePixel[3]).toBe(255);
            pic2.destroy();
        });
    });

    it('serializes buffer merges', function() {
        var clearColor = [254, 254, 254];
        pic.addBuffer(1337, clearColor, false);
        var clearColor2 = [0, 0, 0];
        pic.addBuffer(1338, clearColor2, false);
        var mergeEvent = pic.createMergeEvent(1, 0.7);
        var update = new PictureUpdate('add_picture_event');
        update.setPictureEvent(1337, mergeEvent);
        pic.pushUpdate(update);
        expect(pic.buffers[1].mergedTo).toBe(pic.buffers[0]);

        var pic2;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        });
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
            expect(pic2.buffers[1].mergedTo).toBe(pic2.buffers[0]);
            pic2.destroy();
        });
    });

    it('can undo the latest event', function() {
        var clearColor = [12, 23, 34];
        pic.addBuffer(1337, clearColor, false);
        var brushEvent = pic.createBrushEvent([56, 67, 78], 1.0, 1.0, 10, 0, 0,
                                              PictureEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.width(), pic.height(), 1.0);
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
        brushEvent.pushCoordTriplet(pic.width(), pic.height(), 1.0);
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
        brushEvent.pushCoordTriplet(pic.width(), pic.height(), 1.0);
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
        var jsonStr = serializeToString(mergeEvent);
        var parsedJson = JSON.parse(jsonStr);
        mergeEvent = PictureEvent.fromJS(parsedJson);
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
        var pic2;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        });
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
            expect(pic2.buffers[0].isRemoved()).toBe(true);
            pic2.destroy();
        });
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
        brushEvent.pushCoordTriplet(pic.width(), pic.height(), 1.0);
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
        var pic2;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        });
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
            expect(pic2.buffers[0].id).toBe(pic.buffers[0].id);
            expect(pic2.buffers[1].id).toBe(pic.buffers[1].id);
            expect(pic2.buffers[2].id).toBe(pic.buffers[2].id);
            pic2.moveBuffer(9001, 0);
            expect(pic2.buffers[0].id).toBe(9001);
            pic2.destroy();
        });
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
        var pic2;
        Picture.copy(pic, function(p2) {
            pic2 = p2;
        });
        waitsFor(function() {
            return pic2 !== undefined;
        });
        runs(function() {
            expect(pic2.buffers[0].insertionPoint).toBe(2);
            pic2.destroy();
        });
    });

    it('places app-specific metadata into an array when parsing', function() {
        var parsed;
        var serialization = pic.serialize();
        serialization += '\nmetadata\nappdata';
        Picture.parse(0, serialization, 1.0, [pic.mode], undefined, function(p) {
            parsed = p;
        });
        waitsFor(function() {
            return parsed !== undefined;
        });
        runs(function() {
            expect(parsed.metadata[0]).toBe('metadata');
            expect(parsed.metadata[1]).toBe('appdata');
        });
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

    if (mode.indexOf('webgl') !== -1) {
        it('has a global flag for failing webgl initialization', function() {
            expect(Picture.hasFailedWebGLSanity).toBe(false);

            // Break the rasterizers
            var oldDoubleBufferedFillCircle = GLDoubleBufferedRasterizer.prototype.fillCircle;
            var oldFloatFillCircle = GLFloatRasterizer.prototype.fillCircle;
            var oldFloatTexDataFillCircle = GLFloatTexDataRasterizer.prototype.fillCircle;
            GLDoubleBufferedRasterizer.prototype.fillCircle = function() {};
            GLFloatRasterizer.prototype.fillCircle = function() {};
            GLFloatTexDataRasterizer.prototype.fillCircle = function() {};

            var pic = testPicture();
            expect(Picture.hasFailedWebGLSanity).toBe(true);
            pic.destroy();

            // Restore the rasterizers
            GLDoubleBufferedRasterizer.prototype.fillCircle = oldDoubleBufferedFillCircle;
            GLFloatRasterizer.prototype.fillCircle = oldFloatFillCircle;
            GLFloatTexDataRasterizer.prototype.fillCircle = oldFloatTexDataFillCircle;
            Picture.hasFailedWebGLSanity = false;
        });
    }

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

            pic.destroy();
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
        var pic = null;
        var blob = null;
        var clearColor = [12, 23, 34];
        var img = null;
        var blobCallback = function(b) {
            blob = b;
        };
        runs(function() {
            pic = testPicture();
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

            pic.destroy();
        });
    });
};

describe('Picture', function() {
    var modes = ['webgl', 'canvas', 'no-texdata-webgl', 'no-float-webgl'];
    for (var i = 0; i < modes.length; ++i) {
        describe('in mode ' + modes[i], function() {
            doPictureTest(modes[i]);
        });
    }

    var mode = modes[0]; // Do these remaining tests with only one mode, since they don't test rendering

    it('parses a serialization without a version number', function() {
        var parsed;
        Picture.parse(-1, 'picture 122 234', 2.0, [mode], undefined, function(p) {
            parsed = p;
        });
        waitsFor(function() {
            return parsed !== undefined;
        });
        runs(function() {
            var pic = parsed.picture;
            expect(pic.parsedVersion).toBe(0);
            expect(pic.id).toBe(-1);
            expect(pic.name).toBe(null);
            expect(pic.pictureTransform.scale).toBe(2.0);
            expect(pic.mode).toEqual(mode);
            expect(pic.width()).toBe(122);
            expect(pic.height()).toBe(234);
            expect(pic.bitmapWidth()).toBe(pic.width() * 2.0);
            expect(pic.bitmapHeight()).toBe(pic.height() * 2.0);
            expect(pic.buffers.length).toBe(0);

            pic.destroy();
        });
    });

    it('parses a serialization of version 4', function() {
        var picSerialization = [
        'picture version 4 840 970 named YmxhY2tkcmFnb24=',
        'bufferAdd 1 0 0 0 0 255 255 255 1 4383',
        'brush 1 1 1 27 28 29 0.42 0.9 1.93 0 0.0 2 482.66 322.37 0.20626 482.62 322.37 0.20626 ' +
            '479.12 322.37 0.23656 473.12 322.37 0.26197 464.74 325.99 0.39687',
        'gradient 1 2 0 101 198 255 0.875 1 523 986 575 34'
        ].join('\n');
        var parsed;
        Picture.parse(-1, picSerialization, 1.0, [mode], undefined, function(p) {
            parsed = p;
        });
        waitsFor(function() {
            return parsed !== undefined;
        });
        runs(function() {
            var pic = parsed.picture;
            expect(pic.parsedVersion).toBe(4);
            expect(pic.id).toBe(-1);
            expect(pic.buffers.length).toBe(1);
            expect(pic.buffers[0].events.length).toBe(3);
            expect(pic.name).toBe('blackdragon');
            expect(pic.width()).toBe(840);
            expect(pic.height()).toBe(970);
            expect(pic.boundsRect.left).toBe(0);
            expect(pic.boundsRect.top).toBe(0);
            expect(pic.bitmapWidth()).toBe(840);
            expect(pic.bitmapHeight()).toBe(970);

            var event = pic.buffers[0].events[1];
            expect(event.eventType).toBe('brush');
            expect(event.sid).toBe(1);
            expect(event.sessionEventId).toBe(1);
            expect(event.undone).toBe(true);
            expect(event.color[0]).toBe(27);
            expect(event.color[1]).toBe(28);
            expect(event.color[2]).toBe(29);
            expect(event.flow).toBe(0.42);
            expect(event.opacity).toBe(0.9);
            expect(event.radius).toBe(1.93);
            expect(event.textureId).toBe(0);
            expect(event.mode).toBe(PictureEvent.Mode.multiply);
            expect(event.coords.length).toBe(5 * 3);

            event = pic.buffers[0].events[2];
            expect(event.eventType).toBe('gradient');
            expect(event.sid).toBe(1);
            expect(event.sessionEventId).toBe(2);
            expect(event.undone).toBe(false);
            expect(event.color[0]).toBe(101);
            expect(event.color[1]).toBe(198);
            expect(event.color[2]).toBe(255);
            expect(event.opacity).toBe(0.875);
            expect(event.mode).toBe(PictureEvent.Mode.normal);
            expect(event.coords0.x).toBe(523);
            expect(event.coords0.y).toBe(986);
            expect(event.coords1.x).toBe(575);
            expect(event.coords1.y).toBe(34);

            pic.destroy();
        });
    });

    it('parses a serialization of version 6', function() {
        var picSerialization = [
        'picture version 6 277.46 46.48 347.75 526.31 named bWljcm9mbG93ZXJz',
        'add_picture_event 0 bufferAdd 1 0 0 0 0 255 255 255 1 2932',
        'add_picture_event 0 brush 1 1 1 27 28 29 0.42 0.9 1.93 0 0.0 2 554 294 0.08504 548 294 0.09775 ' +
            '544 292 0.12708 541 290 0.16325 541 286 0.1955 542 281 0.23167',
        'undo 1 1',
        'add_picture_event 0 gradient 1 2 0 23 68 34 0.75 1 406 695 405 668',
        'add_picture_event 0 scatter 1 3 0 27 28 29 0.42 0.9 0 0 1.0 3 253 22 571 0.1439999999999999 0',
        'add_picture_event 0 eventHide 1 4 0 1 3'
        ].join('\n');
        var parsed;
        Picture.parse(-1, picSerialization, 1.0, [mode], undefined, function(p) {
            parsed = p;
        });
        waitsFor(function() {
            return parsed !== undefined;
        });
        runs(function() {
            var pic = parsed.picture;
            expect(pic.parsedVersion).toBe(6);
            expect(pic.id).toBe(-1);
            expect(pic.buffers.length).toBe(1);
            expect(pic.buffers[0].events.length).toBe(5);
            expect(pic.name).toBe('microflowers');
            expect(pic.width()).toBeNear(347.75, 0.01);
            expect(pic.height()).toBeNear(526.31, 0.01);
            expect(pic.boundsRect.left).toBeNear(277.46, 0.01);
            expect(pic.boundsRect.top).toBeNear(46.48, 0.01);
            expect(pic.bitmapWidth()).toBe(347);
            expect(pic.bitmapHeight()).toBe(526);

            var event = pic.buffers[0].events[1];
            expect(event.eventType).toBe('brush');
            expect(event.sid).toBe(1);
            expect(event.sessionEventId).toBe(1);
            expect(event.undone).toBe(true);
            expect(event.color[0]).toBe(27);
            expect(event.color[1]).toBe(28);
            expect(event.color[2]).toBe(29);
            expect(event.flow).toBe(0.42);
            expect(event.opacity).toBe(0.9);
            expect(event.radius).toBe(1.93);
            expect(event.textureId).toBe(0);
            expect(event.soft).toBe(false);
            expect(event.mode).toBe(PictureEvent.Mode.multiply);
            expect(event.coords.length).toBe(6 * 3);

            event = pic.buffers[0].events[2];
            expect(event.eventType).toBe('gradient');
            expect(event.sid).toBe(1);
            expect(event.sessionEventId).toBe(2);
            expect(event.undone).toBe(false);
            expect(event.color[0]).toBe(23);
            expect(event.color[1]).toBe(68);
            expect(event.color[2]).toBe(34);
            expect(event.opacity).toBe(0.75);
            expect(event.mode).toBe(PictureEvent.Mode.normal);
            expect(event.coords0.x).toBe(406);
            expect(event.coords0.y).toBe(695);
            expect(event.coords1.x).toBe(405);
            expect(event.coords1.y).toBe(668);

            event = pic.buffers[0].events[3];
            expect(event.eventType).toBe('scatter');
            expect(event.sid).toBe(1);
            expect(event.sessionEventId).toBe(3);
            expect(event.undone).toBe(false);
            expect(event.color[0]).toBe(27);
            expect(event.color[1]).toBe(28);
            expect(event.color[2]).toBe(29);
            expect(event.flow).toBe(0.42);
            expect(event.opacity).toBe(0.9);
            expect(event.radius).toBe(0);
            expect(event.textureId).toBe(0);
            expect(event.soft).toBe(true);
            expect(event.mode).toBe(PictureEvent.Mode.screen);
            expect(event.coords.length).toBe(5);

            event = pic.buffers[0].events[4];
            expect(event.eventType).toBe('eventHide');
            expect(event.sid).toBe(1);
            expect(event.sessionEventId).toBe(4);
            expect(event.undone).toBe(false);
            expect(event.hiddenSid).toBe(1);
            expect(event.hiddenSessionEventId).toBe(3);

            pic.destroy();
        });
    });
});
