/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

describe('PictureEvent', function() {
    var commonEventTests = function(creator, tester) {
        it('initializes', function() {
            var event = creator();
            tester(event);
        });

        it('is the same after serialization and parsing', function() {
            var event = creator();
            var serialization = serializeToString(event);
            console.log(serialization);
            var parsedEvent = PictureEvent.fromJS(JSON.parse(serialization));
            tester(parsedEvent);
        });

        it('gets copied', function() {
            var event = creator();
            var eventCopy = PictureEvent.copy(event);
            expect(eventCopy).not.toBe(event);
            tester(eventCopy);
        });

        it('has the minimum method set of an event of its type', function() {
            var event = creator();
            expect(typeof event.serialize).toBe('function');
            expect(typeof event.isBufferStackChange).toBe('function');
            expect(typeof event.isRasterized).toBe('function');
            expect(typeof event.getBoundingBox).toBe('function');
            expect(typeof event.boundsIntersectRect).toBe('function');
            expect(typeof event.scale).toBe('function');
            if (event.isRasterized()) {
                expect(typeof event.translate).toBe('function');
                expect(typeof event.drawTo).toBe('function');
            }
        });

        var event = creator();
        if (event.isRasterized()) {
            it('has a generation number', function() {
                var event = creator();
                expect(typeof event.generation).toBe(typeof 0);
                expect(event.generation).toBe(0);
                // The generation number is incremented whenever rasterizers
                // containing the event are invalidated.
                event.translate(new Vec2(5, 5));
                expect(event.generation).toBe(1);
            });

            it('initializes with a hideCount of 0', function() {
                var event = creator();
                expect(event.hideCount).toBe(0);
                event.hideCount = 1;
                var eventCopy = PictureEvent.copy(event);
                expect(eventCopy.hideCount).toBe(0);
            });
        }
    };

    var commonBrushEventTests = function(creator) {
        it('updates its bounding box if more coords are pushed', function() {
            var testEvent = creator();
            testEvent.radius = 3;
            testEvent.pushCoordTriplet(0, 0, 1);
            testEvent.pushCoordTriplet(1, 0, 1);
            var transform = new AffineTransform();
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), transform);
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            testEvent.pushCoordTriplet(3, 0, 1);
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), transform);
            expect(box).toBe(oldBox);
            expect(box.right).toBeNear(oldRight + 2, 0.01);
            expect(box.left).toBeNear(oldLeft, 0.01);
            expect(box.top).toBeNear(oldTop, 0.01);
            expect(box.bottom).toBeNear(oldBottom, 0.01);
        });

        it('updates its bounding box if it is translated', function() {
            var testEvent = creator();
            testEvent.radius = 3;
            testEvent.pushCoordTriplet(0, 0, 1);
            testEvent.pushCoordTriplet(1, 1, 1);
            var transform = new AffineTransform();
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), transform);
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            testEvent.translate(new Vec2(2, 1));
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), transform);
            expect(box).not.toBe(oldBox);
            expect(box.right).toBeNear(oldRight + 2, 0.01);
            expect(box.left).toBeNear(oldLeft + 2, 0.01);
            expect(box.top).toBeNear(oldTop + 1, 0.01);
            expect(box.bottom).toBeNear(oldBottom + 1, 0.01);
        });

        it('updates its bounding box if it is scaled', function() {
            var testEvent = creator();
            var radius = 3;
            testEvent.radius = radius;
            testEvent.pushCoordTriplet(0, 0, 1);
            testEvent.pushCoordTriplet(1, 1, 1);
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), new AffineTransform());
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            testEvent.scale(2.0);
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), new AffineTransform());
            expect(box).not.toBe(oldBox);
            expect(box.right).toBeGreaterThan(oldRight + radius - 0.1);
            expect(box.left).toBeLessThan(oldLeft - radius + 0.1);
            expect(box.top).toBeLessThan(oldTop - radius + 0.1);
            expect(box.bottom).toBeGreaterThan(oldBottom + radius - 0.1);
        });

        it('updates its bounding box if the transform changes', function() {
            var testEvent = creator();
            testEvent.radius = 3;
            testEvent.pushCoordTriplet(0, 0, 1);
            testEvent.pushCoordTriplet(1, 1, 1);
            var transform = new AffineTransform();
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), transform);
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            transform.translate.x += 2;
            transform.translate.y += 1;
            ++transform.generation;
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), transform);
            expect(box).not.toBe(oldBox);
            expect(box.right).toBeNear(oldRight + 2, 0.01);
            expect(box.left).toBeNear(oldLeft + 2, 0.01);
            expect(box.top).toBeNear(oldTop + 1, 0.01);
            expect(box.bottom).toBeNear(oldBottom + 1, 0.01);
        });
    };

    /**
     * Serialize an event with data of the current version mimicking an earlier version's format.
     * @param {number} scale Scale to multiply coordinates with.
     * @param {number} version Version of the resulting serialization.
     * @return {string} The serialization.
     */
    var serializeLegacyBrushEvent = function(scale, version) {
        var eventMessage = '' + this.eventType;
        eventMessage += ' ' + this.sid;
        eventMessage += ' ' + this.sessionEventId;
        eventMessage += ' ' + (this.undone ? '1' : '0');
        eventMessage += ' ' + this.color[0] + ' ' + this.color[1] + ' ' + this.color[2];
        eventMessage += ' ' + this.flow + ' ' + this.opacity;
        eventMessage += ' ' + (this.radius * scale);
        if (version > 1) {
            eventMessage += ' ' + this.textureId;
        }
        if (this.soft) {
            eventMessage += ' 1.0';
        } else {
            eventMessage += ' 0.0';
        }
        eventMessage += ' ' + this.mode;
        var i = 0;
        while (i < this.coords.length) {
            eventMessage += ' ' + this.coords[i++] * scale;
            eventMessage += ' ' + this.coords[i++] * scale;
            if (this.eventType === 'scatter') {
                if (version >= 4) {
                    eventMessage += ' ' + this.coords[i++] * scale; // radius
                    eventMessage += ' ' + this.coords[i++]; // flow
                    eventMessage += ' ' + this.coords[i++]; // rotation
                } else {
                    eventMessage += ' ' + this.coords[i++] / this.radius; // pressure
                    i += 2;
                }
            } else {
                eventMessage += ' ' + this.coords[i++]; // pressure
            }
        }
        return eventMessage;
    };

    describe('BrushEvent', function() {
        commonEventTests(testBrushEvent, expectTestBrushEvent);

        commonBrushEventTests(testBrushEvent);

        it('normalizes its pressure', function() {
            var testEvent = testBrushEvent();
            var radius = 3;
            var nBlends = Math.ceil(testEvent.radius * 2);
            var brushFlowAlpha = colorUtil.alphaForNBlends(testEvent.flow, nBlends);
            testEvent.radius = radius;
            testEvent.pushCoordTriplet(0, 0, 10);
            testEvent.pushCoordTriplet(1, 1, 1);
            testEvent.normalizePressure();
            expect(testEvent.radius).toBeNear(30, 0.0001);
            expect(testEvent.coords[2]).toBeNear(1.0, 0.0001);
            expect(testEvent.coords[BrushEvent.coordsStride + 2]).toBeNear(0.1, 0.0001);
            nBlends = Math.ceil(testEvent.radius * 2);
            var newFlowAlpha = colorUtil.alphaForNBlends(testEvent.flow, nBlends);
            expect(newFlowAlpha).toBeCloseTo(brushFlowAlpha, 0.02);
        });

        it('parses a version 1 event', function() {
            var version = 1;
            var testEvent = testBrushEvent();
            testEvent.serializeLegacy = serializeLegacyBrushEvent;
            var serialization = testEvent.serializeLegacy(1.0, version);
            var splitSerialization = serialization.split(' ');
            var json = {};
            PictureEvent.parseLegacy(json, splitSerialization, 0, version);
            var parsedEvent = PictureEvent.fromJS(json);
            expectTestBrushEvent(parsedEvent);
        });
    });

    describe('ScatterEvent', function() {
        commonEventTests(testScatterEvent, expectTestScatterEvent);

        it('handles fillCircle calls', function() {
            var testEvent = testScatterEvent();
            testEvent.fillCircle(1, 2, 3, 0.45, 3.141);
            expect(testEvent.coords.length).toBe(ScatterEvent.coordsStride);
            expect(testEvent.coords[0]).toBe(1);
            expect(testEvent.coords[1]).toBe(2);
            expect(testEvent.coords[2]).toBe(3);
            expect(testEvent.coords[3]).toBe(0.45);
            expect(testEvent.coords[4]).toBe(3.141);
        });

        it('handles pushCoordTriplet calls for testing', function() {
            var testEvent = testScatterEventWithPushCoordTriplet();
            testEvent.pushCoordTriplet(1, 2, 0.77);
            expect(testEvent.coords.length).toBe(ScatterEvent.coordsStride);
            expect(testEvent.coords[0]).toBe(1);
            expect(testEvent.coords[1]).toBe(2);
            expect(testEvent.coords[2]).toBeNear(testEvent.radius * 0.77, 0.001);
            // Default flow and rotation
            expect(testEvent.coords[3]).toBe(testEvent.flow);
            expect(testEvent.coords[4]).toBe(0);
        });

        commonBrushEventTests(testScatterEventWithPushCoordTriplet);

        it('updates its bounding box if its generation is changed', function() {
            var testEvent = testScatterEvent();
            testEvent.fillCircle(0, 0, 3, 1.0, 0);
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), new AffineTransform());
            testEvent.coords[2] = 5; // Increase radius manually
            ++testEvent.generation;
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10), new AffineTransform());
            expect(box).not.toBe(oldBox);
            expect(box.right).toBeNear(oldBox.right + 2, 0.01);
            expect(box.left).toBeNear(oldBox.left - 2, 0.01);
            expect(box.top).toBeNear(oldBox.top - 2, 0.01);
            expect(box.bottom).toBeNear(oldBox.bottom + 2, 0.01);
        });

        it('parses version 1, 2, and 3 events', function() {
            for (var version = 1; version <= 3; ++version) {
                var testEvent = testScatterEvent();
                testEvent.fillCircle(0.5, 1.6, 4.5, 0.411, 3.141);
                testEvent.serializeLegacy = serializeLegacyBrushEvent;
                var serialization = testEvent.serializeLegacy(1.0, version);
                var splitSerialization = serialization.split(' ');
                var json = {};
                PictureEvent.parseLegacy(json, splitSerialization, 0, version);
                var parsedEvent = PictureEvent.fromJS(json);
                expectTestScatterEvent(parsedEvent, 5);
                expect(parsedEvent.coords[0]).toBeNear(0.5, 0.001);
                expect(parsedEvent.coords[1]).toBeNear(1.6, 0.001);
                expect(parsedEvent.coords[2]).toBeNear(4.5, 0.001);
                // Flow and rotation should be set to their defaults in parsed legacy events:
                expect(parsedEvent.coords[3]).toBeNear(parsedEvent.flow, 0.001);
                expect(parsedEvent.coords[4]).toBeNear(0, 0.001);
            }
        });

        it('receives stroke data from BrushTipMover', function() {
            var testEvent = testScatterEvent();
            var tipMover = new BrushTipMover(false);
            tipMover.reset(testEvent, new AffineTransform(), 1, 2, 0.3, testEvent.radius, testEvent.flow, 0, 1, false,
                           BrushTipMover.Rotation.off);
            tipMover.move(2.5, 2, 0.3);
            var drawFlowAlpha = colorUtil.alphaForNBlends(testEvent.flow, testEvent.radius * 2);
            expect(testEvent.coords.length).toBe(2 * ScatterEvent.coordsStride);
            expect(testEvent.coords[0]).toBeNear(1, 0.001);
            expect(testEvent.coords[1]).toBeNear(2, 0.001);
            expect(testEvent.coords[2]).toBeNear(testEvent.radius * 0.3, 0.001);
            expect(testEvent.coords[3]).toBeNear(drawFlowAlpha, 0.001);
            expect(testEvent.coords[4]).toBe(0);
            expect(testEvent.coords[ScatterEvent.coordsStride]).toBeNear(2, 0.001);
            expect(testEvent.coords[ScatterEvent.coordsStride + 1]).toBeNear(2, 0.001);
            expect(testEvent.coords[ScatterEvent.coordsStride + 2]).toBeNear(testEvent.radius * 0.3, 0.001);
            expect(testEvent.coords[ScatterEvent.coordsStride + 3]).toBeNear(drawFlowAlpha, 0.001);
            expect(testEvent.coords[ScatterEvent.coordsStride + 4]).toBe(0);
        });

        it('receives stroke data with random rotations from BrushTipMover', function() {
            var testEvent = testScatterEvent();
            var tipMover = new BrushTipMover(false);
            tipMover.reset(testEvent, new AffineTransform(), 1, 2, 0.3, testEvent.radius, testEvent.flow, 0, 1, false,
                           BrushTipMover.Rotation.random);
            tipMover.move(200, 2, 0.3);
            var count = 0;
            var sum = 0;
            var deviation = 0;
            for (var i = 4; i < testEvent.coords.length; i += ScatterEvent.coordsStride) {
                expect(testEvent.coords[i]).toBeLessThan(Math.PI * 2);
                expect(testEvent.coords[i]).not.toBeLessThan(0);
                sum += testEvent.coords[i];
                deviation += Math.abs(testEvent.coords[i] - Math.PI);
                ++count;
            }
            // If this doesn't pass, congratulations, you've been very lucky.
            expect(sum / count).toBeNear(Math.PI, 0.5);
            expect(deviation / count).toBeNear(Math.PI * 0.5, 0.5);
        });
    });

    describe('GradientEvent', function() {
        commonEventTests(testGradientEvent, expectTestGradientEvent);
    });

    describe('RasterImportEvent', function() {
        commonEventTests(testRasterImportEvent, expectTestRasterImportEvent);
    });

    describe('BufferAddEvent', function() {
        commonEventTests(testBufferAddEvent, expectTestBufferAddEvent);
    });

    describe('BufferRemoveEvent', function() {
        commonEventTests(testBufferRemoveEvent, expectTestBufferRemoveEvent);
    });

    describe('BufferMoveEvent', function() {
        commonEventTests(testBufferMoveEvent, expectTestBufferMoveEvent);
    });

    describe('BufferMergeEvent', function() {
        commonEventTests(dummyBufferMergeEvent, expectDummyBufferMergeEvent);
    });

    describe('EventHideEvent', function() {
        commonEventTests(testEventHideEvent, expectTestEventHideEvent);
    });
});
