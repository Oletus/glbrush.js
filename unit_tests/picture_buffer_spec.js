/*
 * Copyright Olli Etuaho 2013.
 */

var testBufferParams = {
    id: 0,
    width: 100,
    height: 100,
    clearColor: [60, 120, 180, 150],
    hasUndoStates: true,
    hasAlpha: true
};

var testBuffer = function(createBuffer, createRasterizer, params) {
    it('initializes', function() {
        var buffer = createBuffer(params);
        expect(buffer.id).toBe(params.id);
        expect(buffer.width()).toBe(params.width);
        expect(buffer.height()).toBe(params.height);
        expect(buffer.events[0].clearColor).toBe(params.clearColor);
        expect(buffer.hasAlpha).toBe(params.hasAlpha);
        expect(buffer.undoStates).toEqual([]);

        buffer.free();
    });

    it('is cleared during initialization and playback', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        expectBufferCorrect(buffer, rasterizer, 0);
        buffer.clear(buffer.events[0].clearColor);
        expectBufferCorrect(buffer, rasterizer, 0);

        rasterizer.free();
        buffer.free();
    });

    it('clamps a pushed clip rect', function() {
        var buffer = createBuffer(params);
        buffer.pushClipRect(new Rect(-100, buffer.width() + 100,
                                     -100, buffer.height() + 100));
        var currentClip = buffer.getCurrentClipRect();
        expect(currentClip.left).toBe(0);
        expect(currentClip.top).toBe(0);
        expect(currentClip.right).toBe(buffer.width());
        expect(currentClip.bottom).toBe(buffer.height());

        buffer.free();
    });

    it('clamps the clip rect after popping', function() {
        var buffer = createBuffer(params);
        buffer.pushClipRect(new Rect(-100, 45, -100, 56));
        buffer.pushClipRect(new Rect(0, 20, 0, 20));
        buffer.popClip();
        var currentClip = buffer.getCurrentClipRect();
        expect(currentClip.left).toBe(0);
        expect(currentClip.top).toBe(0);
        expect(currentClip.right).toBe(45);
        expect(currentClip.bottom).toBe(56);

        buffer.free();
    });

    it('gives the color of one pixel', function() {
        var buffer = createBuffer(params);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(params.clearColor[0], 8);
        expect(samplePixel[1]).toBeNear(params.clearColor[1], 8);
        expect(samplePixel[2]).toBeNear(params.clearColor[2], 8);
        expect(samplePixel[3]).toBe(params.clearColor[3]);

        buffer.free();
    });

    it('plays back one event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = testBrushEvent();
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(buffer.width(), buffer.height(), 0.5);
        buffer.pushEvent(brushEvent, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 0);

        rasterizer.free();
        buffer.free();
    });

    it('erases from the bitmap', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0, 0, 0], 1.0,
                                           PictureEvent.Mode.erase);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);

        rasterizer.free();
        buffer.free();
    });

    it('blends an event to the bitmap with the normal mode, opacity and flow',
       function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var opacity = 0.5;
        var flow = 0.5;
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           opacity, PictureEvent.Mode.normal,
                                           flow);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(params.width * 0.5,
                                                       params.height * 0.5));
        var sAlpha = opacity * flow;
        expect(samplePixel[0]).toBeNear(params.clearColor[0] * (1.0 - sAlpha) +
                                        0.2 * 255 * sAlpha, 10);
        expect(samplePixel[1]).toBeNear(params.clearColor[1] * (1.0 - sAlpha) +
                                        0.4 * 255 * sAlpha, 10);
        expect(samplePixel[2]).toBeNear(params.clearColor[2] * (1.0 - sAlpha) +
                                        0.8 * 255 * sAlpha, 10);
        var targetAlpha = params.clearColor[3] / 255;
        var alpha = (targetAlpha + sAlpha - targetAlpha * sAlpha) * 255;
        expect(samplePixel[3]).toBeNear(alpha, 15);

        rasterizer.free();
        buffer.free();
    });

    it('blends an event to the bitmap with the multiply mode', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var opacity = 0.5;
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           opacity, PictureEvent.Mode.multiply);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(params.clearColor[0] *
                                        (0.2 + (1.0 - 0.2) * opacity), 10);
        expect(samplePixel[1]).toBeNear(params.clearColor[1] *
                                        (0.4 + (1.0 - 0.4) * opacity), 10);
        expect(samplePixel[2]).toBeNear(params.clearColor[2] *
                                        (0.8 + (1.0 - 0.8) * opacity), 10);
        var targetAlpha = params.clearColor[3] / 255;
        var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
        expect(samplePixel[3]).toBeNear(alpha, 15);

        rasterizer.free();
        buffer.free();
    });

    it('blends an event to the bitmap with the screen mode', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var opacity = 0.5;
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           opacity, PictureEvent.Mode.screen);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        var cc = params.clearColor;
        expect(samplePixel[0]).toBeNear((255 - (255 - cc[0]) * (1.0 - 0.2)) *
                                        opacity + (1.0 - opacity) * cc[0], 10);
        expect(samplePixel[1]).toBeNear((255 - (255 - cc[1]) * (1.0 - 0.4)) *
                                        opacity + (1.0 - opacity) * cc[1], 10);
        expect(samplePixel[2]).toBeNear((255 - (255 - cc[2]) * (1.0 - 0.8)) *
                                        opacity + (1.0 - opacity) * cc[2], 10);
        var targetAlpha = params.clearColor[3] / 255;
        var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
        expect(samplePixel[3]).toBeNear(alpha, 10);

        rasterizer.free();
        buffer.free();
    });

    it('erases from an opaque buffer', function() {
        var hadAlpha = params.hasAlpha;
        var oldClearAlpha = params.clearColor[3];
        params.hasAlpha = false;
        params.clearColor[3] = 255;
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var opacity = 1.0;
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           opacity, PictureEvent.Mode.normal);
        buffer.pushEvent(brushEvent, rasterizer);
        // The erase event color should be ignored and clear color should be
        // used instead.
        brushEvent = fillingBrushEvent(params.width, params.height,
                                       [255, 255, 255], opacity,
                                       PictureEvent.Mode.erase);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        var cc = params.clearColor;
        expect(samplePixel[0]).toBeNear(cc[0], 5);
        expect(samplePixel[1]).toBeNear(cc[1], 5);
        expect(samplePixel[2]).toBeNear(cc[2], 5);
        expect(samplePixel[3]).toBe(255);

        rasterizer.free();
        buffer.free();
        params.hasAlpha = hadAlpha;
        params.clearColor[3] = oldClearAlpha;
    });

    var generateBrushEvent = function(seed, width, height) {
        var event = testBrushEvent();
        for (var j = 0; j < 10; ++j) {
            event.pushCoordTriplet((Math.sin(seed * j * 0.8) + 1.0) *
                                   width * 0.5,
                                   (Math.cos(seed * j * 0.7) + 1.0) *
                                   height * 0.5,
                                   0.6);
        }
        return event;
    };

    var fillBuffer = function(buffer, rasterizer, eventCountTarget) {
        var eventCountStart = buffer.events.length;
        for (var i = eventCountStart; i < eventCountTarget; ++i) {
            var brushEvent = generateBrushEvent(i, buffer.width(),
                                                buffer.height());
            buffer.pushEvent(brushEvent, rasterizer);
        }
        expect(buffer.events.length).toBe(eventCountTarget);
    };

    it('plays back several events', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, 10);
        expectBufferCorrect(buffer, rasterizer, 0);

        rasterizer.free();
        buffer.free();
    });

    var singleEventTests = function(createSpecialEvent, specialEventName) {
        it('undoes ' + specialEventName, function() {
            var undoIndex = 5;
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            if (createSpecialEvent !== null) {
                fillBuffer(buffer, rasterizer, undoIndex);
                buffer.pushEvent(createSpecialEvent(), rasterizer);
            }
            fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 1);

            // so that the test works as intended:
            expect(buffer.undoStateInterval).toBeGreaterThan(undoIndex + 1);

            expect(buffer.undoStates).toEqual([]);
            buffer.undoEventIndex(undoIndex, rasterizer, true);
            expectBufferCorrect(buffer, rasterizer, 3);
            buffer.events.splice(undoIndex, 1);
            expectBufferCorrect(buffer, rasterizer, 3);

            rasterizer.free();
            buffer.free();
        });

        it('undoes ' + specialEventName + ' using an undo state', function() {
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var undoIndex = buffer.undoStateInterval + 1;
            if (createSpecialEvent !== null) {
                fillBuffer(buffer, rasterizer, undoIndex);
                buffer.pushEvent(createSpecialEvent(), rasterizer);
            }
            fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
            expect(buffer.undoStates.length).toBe(1);
            buffer.undoEventIndex(undoIndex, rasterizer, true);
            expectBufferCorrect(buffer, rasterizer, 3);
            buffer.events.splice(undoIndex, 1);
            expectBufferCorrect(buffer, rasterizer, 3);

            rasterizer.free();
            buffer.free();
        });

        it('removes ' + specialEventName, function() {
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var removeIndex = 5;
            if (createSpecialEvent !== null) {
                fillBuffer(buffer, rasterizer, removeIndex);
                buffer.pushEvent(createSpecialEvent(), rasterizer);
            }
            fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 1);
            if (buffer.events[removeIndex].eventType === 'bufferMerge') {
                buffer.undoEventIndex(removeIndex, rasterizer, true);
            }
            buffer.removeEventIndex(removeIndex, rasterizer);
            expect(buffer.events.length).toBe(buffer.undoStateInterval - 2);
            expectBufferCorrect(buffer, rasterizer, 3);

            rasterizer.free();
            buffer.free();
        });

        it('inserts ' + specialEventName, function() {
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 2);
            buffer.setInsertionPoint(5);
            var event;
            if (createSpecialEvent === null) {
                event = generateBrushEvent(9001, buffer.width(),
                                           buffer.height());
            } else {
                event = createSpecialEvent();
            }
            buffer.insertEvent(event, rasterizer);
            expectBufferCorrect(buffer, rasterizer, 3);

            rasterizer.free();
            buffer.free();
        });
    };

    var createTestMergeEvent = function() {
        var mergedBuffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var event = fillingBrushEvent(params.width, params.height, [12, 23, 34],
                                      1.0);
        mergedBuffer.pushEvent(event, rasterizer);
        // TODO: using this sessionEventId value is not actually correct,
        // and same goes for events generated in fillBuffer().
        var mergeEvent = new BufferMergeEvent(0, 1, false, 0.7, mergedBuffer);
        return mergeEvent;
    };

    singleEventTests(null, 'a brush event');
    singleEventTests(createTestMergeEvent, 'a buffer merge event');

    it('does not use an invalid undo state', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        expect(buffer.undoStates.length).toBe(1);
        buffer.undoEventIndex(buffer.undoStateInterval - 2, rasterizer, true);
        buffer.undoEventIndex(buffer.events.length - 2, rasterizer, true);
        expectBufferCorrect(buffer, rasterizer, 3);
        buffer.events.splice(buffer.undoStateInterval - 2, 1);
        buffer.events.splice(buffer.events.length - 2, 1);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('removes an event using an undo state', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        buffer.removeEventIndex(buffer.events.length - 2, rasterizer);
        expect(buffer.events.length).toBe(buffer.undoStateInterval + 2);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates undo state index when removing events', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        var undoState = buffer.undoStates[0];
        var undoStateStartIndex = undoState.index;
        buffer.removeEventIndex(5, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex - 1);

        // Corner cases: events near the state border
        buffer.removeEventIndex(buffer.undoStates[0].index - 1, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex - 2);
        buffer.removeEventIndex(buffer.undoStates[0].index, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex - 2);

        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates undo state index when inserting events', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        var undoState = buffer.undoStates[0];
        var undoStateStartIndex = undoState.index;

        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           0.5, PictureEvent.Mode.normal);
        buffer.setInsertionPoint(5);
        buffer.insertEvent(brushEvent, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex + 1);

        // Corner cases: events near the state border
        buffer.setInsertionPoint(undoState.index - 1);
        brushEvent = fillingBrushEvent(params.width, params.height,
                                       [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                       0.5, PictureEvent.Mode.normal);
        buffer.insertEvent(brushEvent, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex + 2);

        buffer.setInsertionPoint(undoState.index);
        brushEvent = fillingBrushEvent(params.width, params.height,
                                       [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                       0.5, PictureEvent.Mode.normal);
        buffer.insertEvent(brushEvent, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex + 2);

        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates undo state cost when doing operations', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        var undoState = buffer.undoStates[0];
        var undoStateStartCost = undoState.cost;

        // Non-corner cases
        buffer.undoEventIndex(4, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 1);
        buffer.removeEventIndex(5, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);
        buffer.redoEventIndex(4, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 1);

        // Corner cases: events near the state border
        buffer.undoEventIndex(undoState.index - 1, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);
        buffer.undoEventIndex(undoState.index, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);

        // Remove an already undone event, should have no effect on cost
        buffer.removeEventIndex(undoState.index - 1, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);

        rasterizer.free();
        buffer.free();
    });

    it('maintains undo state cost when redoing the last event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var events = 1;
        while (buffer.undoStates.length === 0) {
            fillBuffer(buffer, rasterizer, events);
            ++events;
        }
        var undoState = buffer.undoStates[0];
        var undoStateStartCost = undoState.cost;
        buffer.undoEventIndex(buffer.events.length - 1, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 1);
        buffer.redoEventIndex(buffer.events.length - 1, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost);

        rasterizer.free();
        buffer.free();
    });

    it('maintains undo state data when inserting an undone event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        var undoState = buffer.undoStates[0];
        var undoStateStartIndex = undoState.index;
        var undoStateStartCost = undoState.cost;

        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           0.5, PictureEvent.Mode.normal);
        brushEvent.undone = true;
        buffer.setInsertionPoint(5);
        buffer.insertEvent(brushEvent, rasterizer);
        expect(undoState.index).toBe(undoStateStartIndex + 1);
        expect(undoState.cost).toBe(undoStateStartCost);

        rasterizer.free();
        buffer.free();
    });

    it('removes redundant undo states', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval * 2);
        expect(buffer.undoStates.length).toBe(2);
        while (buffer.events.length > buffer.undoStateInterval + 1) {
            buffer.removeEventIndex(buffer.undoStateInterval, rasterizer);
        }
        expect(buffer.undoStates.length).toBe(2);
        expect(buffer.undoStates[1].cost).toBe(1);
        buffer.removeEventIndex(buffer.undoStateInterval, rasterizer);
        expect(buffer.undoStates.length).toBe(1);
        expect(buffer.undoStates[0].cost).toBeGreaterThan(1);

        rasterizer.free();
        buffer.free();
    });

    it('has its contents replaced by an event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 1);
        var event = generateBrushEvent(9001, buffer.width(), buffer.height());
        buffer.replaceWithEvent(event, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 0);
        expect(buffer.events.length).toBe(2);
        if (buffer.undoStateInterval > 2) {
            expect(buffer.undoStates.length).toBe(0);
        }

        rasterizer.free();
        buffer.free();
    });

    it('updates if an event is pushed to a merged buffer', function() {
        var mergeEvent = createTestMergeEvent();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        buffer.pushEvent(mergeEvent);
        var event = generateBrushEvent(9001, params.width, params.height);
        mergeEvent.mergedBuffer.pushEvent(event, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates if an event is inserted into a merged buffer', function() {
        var mergeEvent = createTestMergeEvent();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        buffer.pushEvent(mergeEvent);
        var event = generateBrushEvent(9001, params.width, params.height);
        mergeEvent.mergedBuffer.insertEvent(event, rasterizer);
        expect(mergeEvent.mergedBuffer.events[1]).toBe(event);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates if an event is undone in a merged buffer', function() {
        var mergeEvent = createTestMergeEvent();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        buffer.pushEvent(mergeEvent);
        mergeEvent.mergedBuffer.undoEventIndex(1, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('does not draw an undone merged buffer', function() {
        var mergeEvent = createTestMergeEvent();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        buffer.pushEvent(mergeEvent);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).not.toBeNear(60, 5);
        expect(samplePixel[1]).not.toBeNear(120, 5);
        expect(samplePixel[2]).not.toBeNear(180, 5);
        expect(samplePixel[3]).not.toBeNear(150, 5);
        mergeEvent.mergedBuffer.undoEventIndex(0, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);
        samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(60, 5);
        expect(samplePixel[1]).toBeNear(120, 5);
        expect(samplePixel[2]).toBeNear(180, 5);
        expect(samplePixel[3]).toBeNear(150, 5);

        rasterizer.free();
        buffer.free();
    });

    it('does not blame its creator', function() {
        var buffer = createBuffer(params);
        expect(buffer.blamePixel(new Vec2(1, 1)).length).toBe(0);

        buffer.free();
    });

    it('does not blame its removal', function() {
        var buffer = createBuffer(params);
        var removal = new BufferRemoveEvent(0, 2, false, buffer.id);
        buffer.pushEvent(removal);
        expect(buffer.blamePixel(new Vec2(1, 1)).length).toBe(0);

        buffer.free();
    });

    it('can be removed multiple times through redo', function() {
        var buffer = createBuffer(params);
        var removal = new BufferRemoveEvent(0, 2, false, buffer.id);
        buffer.pushEvent(removal);
        buffer.undoEventIndex(1, null, false);
        removal = new BufferRemoveEvent(1, 2, false, buffer.id);
        buffer.pushEvent(removal);
        expect(buffer.removeCount).toBe(1);
        expect(buffer.isRemoved()).toBe(true);
        buffer.redoEventIndex(1, null, false);
        expect(buffer.removeCount).toBe(2);
        expect(buffer.isRemoved()).toBe(true);
        buffer.undoEventIndex(2, null, false);
        expect(buffer.removeCount).toBe(1);
        expect(buffer.isRemoved()).toBe(true);
        buffer.undoEventIndex(1, null, false);
        expect(buffer.removeCount).toBe(0);
        expect(buffer.isRemoved()).toBe(false);

        buffer.free();
    });

    it('blames a brush event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0, 0, 0], 0.7,
                                           PictureEvent.Mode.normal);
        buffer.pushEvent(brushEvent, rasterizer);
        var blame = buffer.blamePixel(new Vec2(1, 1));
        expect(blame.length).toBe(1);
        expect(blame[0].event).toBe(brushEvent);
        expect(blame[0].alpha).toBeNear(0.7, 0.03);
        // Check blaming the same event twice, there has been a bug related to
        // this
        blame = buffer.blamePixel(new Vec2(1, 1));
        expect(blame.length).toBe(1);
        expect(blame[0].event).toBe(brushEvent);
        expect(blame[0].alpha).toBe(0.7, 0.03);

        rasterizer.free();
        buffer.free();
    });

    it('blames multiple brush events', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, 10);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0, 0, 0], 0.7,
                                           PictureEvent.Mode.normal);
        buffer.pushEvent(brushEvent, rasterizer);
        var brushEvent2 = fillingBrushEvent(params.width, params.height,
                                            [0, 0, 0], 0.7,
                                            PictureEvent.Mode.normal);
        buffer.pushEvent(brushEvent2, rasterizer);
        var blame = buffer.blamePixel(new Vec2(1, 1));
        expect(blame.length).toBeGreaterThan(1);
        expect(blame[0].event).toBe(brushEvent2);
        expect(blame[1].event).toBe(brushEvent);
        expect(blame[0].alpha).toBeNear(0.7, 0.03);
        expect(blame[1].alpha).toBeNear(0.7, 0.03);

        rasterizer.free();
        buffer.free();
    });

    it('regenerates after freeing', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 1);
        buffer.free();
        expect(buffer.undoStates[0].invalid).toBe(true);
        buffer.regenerate(true, rasterizer);
        expect(buffer.undoStates[0].invalid).toBe(false);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });
};

describe('CanvasBuffer', function() {
    var createBuffer = function(params) {
        var createEvent = new BufferAddEvent(-1, -1, false, params.id,
                                             params.hasAlpha, params.clearColor,
                                             1.0, 0);
        return new CanvasBuffer(createEvent, params.width, params.height,
                                params.hasUndoStates);
    };
    var createRasterizer = function(params) {
        return new Rasterizer(params.width, params.height);
    };
    testBuffer(createBuffer, createRasterizer, testBufferParams);
});

describe('GLBuffer', function() {
    var canvas = document.createElement('canvas');
    var params = testBufferParams;
    canvas.width = params.width;
    canvas.height = params.height;
    var gl = Picture.initWebGL(canvas);
    var glManager = glStateManager(gl);
    var compositor = new GLCompositor(glManager, gl, 8);
    var texBlitProgram = glManager.shaderProgram(blitShader.blitSrc,
                                                 blitShader.blitVertSrc,
                                                 {uSrcTex: 'tex2d'});
    var texBlitUniforms = {
        uSrcTex: null
    };

    var createBuffer = function(params) {
        var createEvent = new BufferAddEvent(-1, -1, false, params.id,
                                             params.hasAlpha, params.clearColor,
                                             1.0, 0);
        return new GLBuffer(gl, glManager, compositor, texBlitProgram,
                            createEvent, params.width, params.height,
                            params.hasUndoStates);
    };
    var createRasterizer = function(params) {
        return new GLDoubleBufferedRasterizer(gl, glManager, params.width,
                                              params.height);
    };

    testBuffer(createBuffer, createRasterizer, params);
});
