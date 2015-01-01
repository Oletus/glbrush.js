/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

var testBufferParams = {
    id: 0,
    width: 100,
    height: 100,
    clearColor: [60, 120, 180, 150],
    hasUndoStates: true,
    hasAlpha: true
};

var testBuffer = function(initTestCanvas, resizeTestCanvas, createBuffer, createRasterizer, params, premultiplied) {
    it('initializes', function() {
        // This is a hacky way of doing global setup for this group of tests.
        // But just running global setup before any tests are run doesn't work
        // here, since the context created beforehand might be lost when other
        // tests are running.
        initTestCanvas();

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
        initTestCanvas();

        var buffer = createBuffer(params);
        expectBufferCorrect(buffer, null, 0);
        buffer.clear(buffer.events[0].clearColor);
        expectBufferCorrect(buffer, null, 0);

        buffer.free();
    });

    it('clamps a pushed clip rect', function() {
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

        var buffer = createBuffer(params);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(params.clearColor[0], 8);
        expect(samplePixel[1]).toBeNear(params.clearColor[1], 8);
        expect(samplePixel[2]).toBeNear(params.clearColor[2], 8);
        expect(samplePixel[3]).toBe(params.clearColor[3]);

        buffer.free();
    });

    it('plays back one event', function() {
        initTestCanvas();

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
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0, 0, 0], 1.0,
                                           PictureEvent.Mode.erase);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[3]).toBe(0);

        rasterizer.free();
        buffer.free();
    });

    it('blends an event to the bitmap with the normal mode, opacity and flow', function() {
        initTestCanvas();

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

    var generalizedBlendModeTest = function(testName, blendMode, testAgainst) {
        it('blends an event to the bitmap with the ' + testName + ' blend mode', function() {
            initTestCanvas();

            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var opacity = 0.6;
            var brushColor = [0.2 * 255, 0.4 * 255, 0.8 * 255];
            var brushEvent = fillingBrushEvent(params.width, params.height, brushColor, opacity, blendMode);
            buffer.pushEvent(brushEvent, rasterizer);
            var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
            var targetAlpha = params.clearColor[3] / 255;
            for (var chan = 0; chan < 3; chan++) {
                var channelShouldBe = colorUtil.blendWithFunction(
                    testAgainst, params.clearColor[chan], brushColor[chan], targetAlpha, opacity);
                expect(samplePixel[chan]).toBeNear(channelShouldBe, 3.0);
            }
            var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
            expect(samplePixel[3]).toBeNear(alpha, 10);
            rasterizer.free();
            buffer.free();
        });

        it('blends an event to a completely transparent bitmap with the ' + testName + ' blend mode', function() {
            initTestCanvas();

            var oldClearColor = params.clearColor;
            params.clearColor = [0, 0, 0, 0];
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var opacity = 0.6;
            var brushColor = [0.2 * 255, 0.4 * 255, 0.8 * 255];
            var brushEvent = fillingBrushEvent(params.width, params.height, brushColor, opacity, blendMode);
            buffer.pushEvent(brushEvent, rasterizer);
            var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
            var targetAlpha = params.clearColor[3] / 255;
            for (var chan = 0; chan < 3; chan++) {
                expect(samplePixel[chan]).toBeNear(brushColor[chan], 2.0);
            }
            var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
            expect(samplePixel[3]).toBeNear(alpha, 10);
            rasterizer.free();
            buffer.free();
            params.clearColor = oldClearColor;
        });

        it('blends an event to a nearly transparent bitmap with the ' + testName + ' blend mode', function() {
            initTestCanvas();

            var oldClearColor = params.clearColor;
            params.clearColor = [0, 0, 0, 1];
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var opacity = 0.6;
            var brushColor = [0.2 * 255, 0.4 * 255, 0.8 * 255];
            var brushEvent = fillingBrushEvent(params.width, params.height, brushColor, opacity, blendMode);
            buffer.pushEvent(brushEvent, rasterizer);
            var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
            var targetAlpha = params.clearColor[3] / 255;
            for (var chan = 0; chan < 3; chan++) {
                expect(samplePixel[chan]).toBeNear(brushColor[chan], 4.0);
            }
            var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
            expect(samplePixel[3]).toBeNear(alpha, 10);
            rasterizer.free();
            buffer.free();
            params.clearColor = oldClearColor;
        });
    };

    generalizedBlendModeTest('multiply', PictureEvent.Mode.multiply, colorUtil.blendMultiply);
    generalizedBlendModeTest('screen', PictureEvent.Mode.screen, colorUtil.blendScreen);
    generalizedBlendModeTest('overlay', PictureEvent.Mode.overlay, colorUtil.blendOverlay);
    generalizedBlendModeTest('hardlight', PictureEvent.Mode.hardlight, colorUtil.blendHardLight);
    generalizedBlendModeTest('softlight', PictureEvent.Mode.softlight, colorUtil.blendSoftLight);
    generalizedBlendModeTest('darken', PictureEvent.Mode.darken, colorUtil.blendDarken);
    generalizedBlendModeTest('lighten', PictureEvent.Mode.lighten, colorUtil.blendLighten);
    generalizedBlendModeTest('difference', PictureEvent.Mode.difference, colorUtil.blendDifference);
    generalizedBlendModeTest('exclusion', PictureEvent.Mode.exclusion, colorUtil.blendExclusion);
    generalizedBlendModeTest('colorburn', PictureEvent.Mode.colorburn, colorUtil.blendColorBurn);
    generalizedBlendModeTest('linearburn', PictureEvent.Mode.linearburn, colorUtil.blendLinearBurn);
    generalizedBlendModeTest('vividlight', PictureEvent.Mode.vividlight, colorUtil.blendVividLight);
    generalizedBlendModeTest('linearlight', PictureEvent.Mode.linearlight, colorUtil.blendLinearLight);
    generalizedBlendModeTest('pinlight', PictureEvent.Mode.pinlight, colorUtil.blendPinLight);
    generalizedBlendModeTest('colordodge', PictureEvent.Mode.colordodge, colorUtil.blendColorDodge);
    generalizedBlendModeTest('lineardodge', PictureEvent.Mode.lineardodge, colorUtil.blendLinearDodge);

    it('erases from an opaque buffer', function() {
        initTestCanvas();

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

    it('blends a scatter event', function() {
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var scatterEvent = testScatterEvent();
        // Assumptions this test makes:
        expect(scatterEvent.radius).toBeLessThan(params.width / 2);
        expect(scatterEvent.mode).toBe(PictureEvent.Mode.normal);

        scatterEvent.fillCircle(0, 0, scatterEvent.radius, scatterEvent.flow, 0);
        scatterEvent.fillCircle(params.width, params.height, scatterEvent.radius, scatterEvent.flow, 0);
        buffer.pushEvent(scatterEvent, rasterizer);
        var scatterEventColor = [scatterEvent.color[0], scatterEvent.color[1],
                                 scatterEvent.color[2], scatterEvent.flow *
                                 scatterEvent.opacity * 255];
        var blendedColor = colorUtil.blend(params.clearColor,
                                           scatterEventColor);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(blendedColor[0], 10);
        expect(samplePixel[1]).toBeNear(blendedColor[1], 10);
        expect(samplePixel[2]).toBeNear(blendedColor[2], 10);
        expect(samplePixel[3]).toBeNear(blendedColor[3], 10);

        samplePixel = buffer.getPixelRGBA(new Vec2(params.width / 2,
                                                   params.height / 2));
        expect(samplePixel[0]).toBeNear(params.clearColor[0], 5);
        expect(samplePixel[1]).toBeNear(params.clearColor[1], 5);
        expect(samplePixel[2]).toBeNear(params.clearColor[2], 5);
        expect(samplePixel[3]).toBeNear(params.clearColor[3], 5);

        samplePixel = buffer.getPixelRGBA(new Vec2(params.width - 1,
                                                   params.height - 1));
        expect(samplePixel[0]).toBeNear(blendedColor[0], 10);
        expect(samplePixel[1]).toBeNear(blendedColor[1], 10);
        expect(samplePixel[2]).toBeNear(blendedColor[2], 10);
        expect(samplePixel[3]).toBeNear(blendedColor[3], 10);

        rasterizer.free();
        buffer.free();
    });

    it('blends a bitmap image', function() {
        initTestCanvas();
        var buffer = createBuffer(params);
        var rasterImportEvent = testRasterImportEvent();

        waitsFor(function() {
            return rasterImportEvent.loaded;
        });

        runs(function() {
            buffer.pushEvent(rasterImportEvent, null);

            var samplePixel = buffer.getPixelRGBA(new Vec2(8, 18));
            expect(samplePixel[0]).toBeNear(params.clearColor[0], 10);
            expect(samplePixel[1]).toBeNear(params.clearColor[1], 10);
            expect(samplePixel[2]).toBeNear(params.clearColor[2], 10);
            expect(samplePixel[3]).toBeNear(params.clearColor[3], 10);

            samplePixel = buffer.getPixelRGBA(new Vec2(11, 21));
            expect(samplePixel[0]).toBeNear(0, 10);
            expect(samplePixel[1]).toBeNear(255, 10);
            expect(samplePixel[2]).toBeNear(0, 10);
            expect(samplePixel[3]).toBeNear(255, 10);

            buffer.free();
        });
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
            brushEvent.sessionEventId = i;
            buffer.pushEvent(brushEvent, rasterizer);
        }
        expect(buffer.events.length).toBe(eventCountTarget);
    };

    it('plays back several events', function() {
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, 10);
        expectBufferCorrect(buffer, rasterizer, 0);

        rasterizer.free();
        buffer.free();
    });

    var singleEventTests = function(createSpecialEvent, specialEventName) {
        it('undoes ' + specialEventName, function() {
            initTestCanvas();

            var undoIndex = 5;
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            if (createSpecialEvent !== null) {
                fillBuffer(buffer, rasterizer, undoIndex);
                buffer.pushEvent(createSpecialEvent(buffer), rasterizer);
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
            initTestCanvas();

            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var undoIndex = buffer.undoStateInterval + 1;
            if (createSpecialEvent !== null) {
                fillBuffer(buffer, rasterizer, undoIndex);
                buffer.pushEvent(createSpecialEvent(buffer), rasterizer);
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
            initTestCanvas();

            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var removeIndex = 5;
            if (createSpecialEvent !== null) {
                fillBuffer(buffer, rasterizer, removeIndex);
                buffer.pushEvent(createSpecialEvent(buffer), rasterizer);
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
            initTestCanvas();

            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 2);
            buffer.setInsertionPoint(5);
            var event;
            if (createSpecialEvent === null) {
                event = generateBrushEvent(9001, buffer.width(),
                                           buffer.height());
            } else {
                event = createSpecialEvent(buffer);
            }
            buffer.insertEvent(event, rasterizer);
            expectBufferCorrect(buffer, rasterizer, 3);

            rasterizer.free();
            buffer.free();
        });
    };

    var createTestMergeEvent = function(buffer) {
        var mergedBuffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var event = fillingBrushEvent(params.width, params.height, [12, 23, 34],
                                      1.0);
        mergedBuffer.pushEvent(event, rasterizer);
        // Create the event with a different sid to not mess up event order when
        // inserting.
        var mergeEvent = new BufferMergeEvent(1338, 0, false, 0.7,
                                              mergedBuffer);
        return mergeEvent;
    };

    var createTestRemoveEvent = function(buffer) {
        return new BufferRemoveEvent(1338, 0, false, buffer.id);
    };

    var createTestHideEvent = function(buffer) {
        var lastEvent = buffer.events[buffer.events.length - 1];
        return new EventHideEvent(1338, 0, false,
                                  lastEvent.sid, lastEvent.sessionEventId);
    };

    singleEventTests(null, 'a brush event');
    singleEventTests(createTestMergeEvent, 'a buffer merge event');
    singleEventTests(createTestRemoveEvent, 'a buffer remove event');
    singleEventTests(createTestHideEvent, 'an event hiding event');

    it('does not use an invalid undo state', function() {
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        buffer.undoStateInterval = 8; // Reduce interval to make test faster
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval * 2 + 3);
        var undoState = buffer.undoStates[0];
        var undoStateStartCost = undoState.cost;
        var undoState2 = buffer.undoStates[1];
        var undoState2StartCost = undoState2.cost;

        // Non-corner cases
        buffer.undoEventIndex(4, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 1);
        expect(undoState2.cost).toBe(undoState2StartCost);
        buffer.removeEventIndex(5, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);
        expect(undoState2.cost).toBe(undoState2StartCost);
        buffer.redoEventIndex(4, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 1);
        expect(undoState2.cost).toBe(undoState2StartCost);

        // Corner cases: events near the state border
        buffer.undoEventIndex(undoState.index - 1, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);
        expect(undoState2.cost).toBe(undoState2StartCost);
        buffer.undoEventIndex(undoState.index, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);
        expect(undoState2.cost).toBe(undoState2StartCost - 1);

        // Remove an already undone event, should have no effect on cost
        buffer.removeEventIndex(undoState.index - 1, rasterizer);
        expect(undoState.cost).toBe(undoStateStartCost - 2);

        rasterizer.free();
        buffer.free();
    });

    it('maintains undo state cost when redoing the last event', function() {
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var mergeEvent = createTestMergeEvent(buffer);
        buffer.pushEvent(mergeEvent);
        var event = generateBrushEvent(9001, params.width, params.height);
        mergeEvent.mergedBuffer.pushEvent(event, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates if an event is inserted into a merged buffer', function() {
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var mergeEvent = createTestMergeEvent(buffer);
        buffer.pushEvent(mergeEvent);
        var event = generateBrushEvent(9001, params.width, params.height);
        mergeEvent.mergedBuffer.insertEvent(event, rasterizer);
        expect(mergeEvent.mergedBuffer.events[1]).toBe(event);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('updates if an event is undone in a merged buffer', function() {
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var mergeEvent = createTestMergeEvent(buffer);
        buffer.pushEvent(mergeEvent);
        mergeEvent.mergedBuffer.undoEventIndex(1, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);

        rasterizer.free();
        buffer.free();
    });

    it('does not draw an undone merged buffer', function() {
        initTestCanvas();

        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var mergeEvent = createTestMergeEvent(buffer);
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
        initTestCanvas();

        var buffer = createBuffer(params);
        expect(buffer.blamePixel(new Vec2(1, 1)).length).toBe(0);

        buffer.free();
    });

    it('does not blame its removal', function() {
        initTestCanvas();

        var buffer = createBuffer(params);
        var removal = new BufferRemoveEvent(0, 2, false, buffer.id);
        buffer.pushEvent(removal);
        expect(buffer.blamePixel(new Vec2(1, 1)).length).toBe(0);

        buffer.free();
    });

    it('can be removed multiple times through redo', function() {
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

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
        initTestCanvas();

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

    it('is cropped', function() {
        initTestCanvas();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0, 0, 0], 0.5,
                                           PictureEvent.Mode.normal);
        buffer.pushEvent(brushEvent, rasterizer);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                       [90, 30, 60], 1.0,
                                       PictureEvent.Mode.normal);
        brushEvent.translate(new Vec2(-params.width * 3, -params.height * 3));
        buffer.pushEvent(brushEvent, rasterizer);

        var newWidth = Math.ceil(params.width * 0.5);
        var newHeight = Math.ceil(params.height * 0.5);
        resizeTestCanvas(newWidth, newHeight);
        rasterizer = createRasterizer({width: newWidth, height: newHeight});

        buffer.transform.translate.x = params.width * 3;
        buffer.transform.translate.y = params.width * 3;
        ++buffer.transform.generation;
        buffer.crop(newWidth, newHeight, rasterizer);

        expect(buffer.width()).toBe(newWidth);
        expect(buffer.height()).toBe(newHeight);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(90, 4);
        expect(samplePixel[1]).toBeNear(30, 4);
        expect(samplePixel[2]).toBeNear(60, 4);

        rasterizer.free();
        buffer.free();
    });

    it('blames an event after being cropped to a larger size', function() {
        initTestCanvas();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                       [90, 30, 60], 1.0,
                                       PictureEvent.Mode.normal);
        brushEvent.translate(new Vec2(params.width, params.height));
        buffer.pushEvent(brushEvent, rasterizer);

        var newWidth = Math.ceil(params.width + 1);
        var newHeight = Math.ceil(params.height + 1);
        resizeTestCanvas(newWidth, newHeight);
        rasterizer = createRasterizer({width: newWidth, height: newHeight});
        buffer.crop(newWidth, newHeight, rasterizer);

        var blame = buffer.blamePixel(new Vec2(params.width, params.height));
        expect(blame.length).toBe(1);
        expect(blame[0].event).toBe(brushEvent);
        expect(blame[0].alpha).toBe(1.0);

        rasterizer.free();
        buffer.free();
    });

    it('undoes an event after being cropped', function() {
        initTestCanvas();
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 1); // We want to hit an undo state in this test.
        var brushEvent = fillingBrushEvent(params.width, params.height, [90, 30, 60], 1.0, PictureEvent.Mode.normal);
        brushEvent.translate(new Vec2(-params.width * 3, -params.height * 3));
        buffer.pushEvent(brushEvent, rasterizer);

        var newWidth = Math.ceil(params.width * 0.5);
        var newHeight = Math.ceil(params.height * 0.5);
        resizeTestCanvas(newWidth, newHeight);
        rasterizer = createRasterizer({width: newWidth, height: newHeight});

        buffer.transform.translate.x = params.width * 3;
        buffer.transform.translate.y = params.width * 3;
        ++buffer.transform.generation;
        buffer.crop(newWidth, newHeight, rasterizer);

        var undoneEvent = buffer.undoEventIndex(buffer.events.length - 1, rasterizer, false);
        expect(undoneEvent).toBe(brushEvent);

        expect(buffer.width()).toBe(newWidth);
        expect(buffer.height()).toBe(newHeight);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeNear(params.clearColor[0], 4);
        expect(samplePixel[1]).toBeNear(params.clearColor[1], 4);
        expect(samplePixel[2]).toBeNear(params.clearColor[2], 4);

        rasterizer.free();
        buffer.free();
    });

    if (!premultiplied) {
        it('blends an event with very low alpha accurately', function() {
            initTestCanvas();
            var oldClearColor = params.clearColor;
            params.clearColor = [0, 0, 0, 0];
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            var brushEvent = fillingBrushEvent(params.width, params.height, [90, 30, 60], 0.02,
                                               PictureEvent.Mode.normal);
            buffer.pushEvent(brushEvent, rasterizer);
            var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
            expect(samplePixel[0]).toBeNear(90, 4);
            expect(samplePixel[1]).toBeNear(30, 4);
            expect(samplePixel[2]).toBeNear(60, 4);
            params.clearColor = oldClearColor;

            rasterizer.free();
            buffer.free();
        });

        it('blends several events with very low alpha accurately', function() {
            initTestCanvas();
            var oldClearColor = params.clearColor;
            params.clearColor = [0, 0, 0, 0];
            var buffer = createBuffer(params);
            var rasterizer = createRasterizer(params);
            for (var i = 0; i < 50; ++i) {
                var brushEvent = fillingBrushEvent(params.width, params.height, [90, 30, 60], 0.02,
                                                   PictureEvent.Mode.normal);
                brushEvent.sessionEventId = i + 1;
                buffer.pushEvent(brushEvent, rasterizer);
            }
            var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
            expect(samplePixel[0]).toBeNear(90, 4);
            expect(samplePixel[1]).toBeNear(30, 4);
            expect(samplePixel[2]).toBeNear(60, 4);
            params.clearColor = oldClearColor;

            rasterizer.free();
            buffer.free();
        });
    }
};

describe('CanvasBuffer', function() {
    var createBuffer = function(params) {
        var createEvent = new BufferAddEvent(-1, -1, false, params.id,
                                             params.hasAlpha, params.clearColor,
                                             1.0, 0);
        return new CanvasBuffer(createEvent, params.width, params.height, new AffineTransform(),
                                params.hasUndoStates);
    };
    var createRasterizer = function(params) {
        return new Rasterizer(params.width, params.height, null);
    };
    testBuffer(function() {}, function() {}, createBuffer, createRasterizer, testBufferParams, true);
});

describe('GLBuffer', function() {
    var testsInitialized = false;
    var params = testBufferParams;

    var canvas;
    var gl;
    var glManager;
    var compositor;
    var texBlitProgram;
    var rectBlitProgram;
    var initTestCanvas = function() {
        if (testsInitialized) {
            resizeTestCanvas(params.width, params.height);
            return;
        }
        testsInitialized = true;
        canvas = document.createElement('canvas');
        canvas.width = params.width;
        canvas.height = params.height;
        gl = Picture.initWebGL(canvas, debugGLSettingFromURL());
        glManager = glStateManager(gl);
        glManager.useQuadVertexBuffer();
        compositor = new GLCompositor(glManager, gl, 8);
        texBlitProgram = glManager.shaderProgram(blitShader.blitSrc, blitShader.blitVertSrc, {'uSrcTex': 'tex2d'});
        rectBlitProgram = glManager.shaderProgram(blitShader.blitSrc, blitShader.blitScaledTranslatedVertSrc,
                                                  {'uSrcTex': 'tex2d', 'uScale': '2fv', 'uTranslate': '2fv'});
    };

    var resizeTestCanvas = function(width, height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
    };

    var createBuffer = function(params) {
        var createEvent = new BufferAddEvent(-1, -1, false, params.id,
                                             params.hasAlpha, params.clearColor,
                                             1.0, 0);
        return new GLBuffer(gl, glManager, compositor, texBlitProgram, rectBlitProgram,
                            createEvent, params.width, params.height, new AffineTransform(), params.hasUndoStates);
    };
    var createRasterizer = function(params) {
        return new GLDoubleBufferedRasterizer(gl, glManager, params.width, params.height, null);
    };

    testBuffer(initTestCanvas, resizeTestCanvas, createBuffer, createRasterizer, params, false);
});
