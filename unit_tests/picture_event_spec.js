/*
 * Copyright Olli Etuaho 2013.
 */

describe('PictureEvent', function() {
    var commonEventTests = function(creator, tester) {
        it('initializes', function() {
            var event = creator();
            tester(event);
        });

        it('is the same after serialization and parsing', function() {
            var event = creator();
            var serialization = event.serialize(1.0);
            var splitSerialization = serialization.split(' ');
            var parsedEvent = PictureEvent.parse(splitSerialization, 0,
                                                 Picture.formatVersion);
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
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            testEvent.pushCoordTriplet(3, 0, 1);
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
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
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            testEvent.translate(new Vec2(2, 1));
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            expect(box).toBe(oldBox);
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
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            var oldLeft = oldBox.left;
            var oldRight = oldBox.right;
            var oldTop = oldBox.top;
            var oldBottom = oldBox.bottom;
            testEvent.scale(2.0);
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            expect(box).not.toBe(oldBox);
            expect(box.right).toBeGreaterThan(oldRight + radius - 0.1);
            expect(box.left).toBeLessThan(oldLeft - radius + 0.1);
            expect(box.top).toBeLessThan(oldTop - radius + 0.1);
            expect(box.bottom).toBeGreaterThan(oldBottom + radius - 0.1);
        });

        it('normalizes its pressure', function() {
            var testEvent = creator();
            var radius = 3;
            testEvent.radius = radius;
            testEvent.pushCoordTriplet(0, 0, 10);
            testEvent.pushCoordTriplet(1, 1, 1);
            testEvent.normalizePressure();
            expect(testEvent.radius).toBeNear(30, 0.0001);
            expect(testEvent.coords[2]).toBeNear(1.0, 0.0001);
            expect(testEvent.coords[BrushEvent.coordsStride + 2]).toBeNear(0.1, 0.0001);
        });
    };

    var serializeLegacyBrushEvent = function(scale, version) {
        var eventMessage = this.serializePictureEvent();
        eventMessage += ' ' + colorUtil.serializeRGB(this.color);
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
            eventMessage += ' ' + this.coords[i++];
        }
        return eventMessage;
    };

    describe('BrushEvent', function() {
        commonEventTests(testBrushEvent, expectTestBrushEvent);

        commonBrushEventTests(testBrushEvent);

        it('parses a version 1 event', function() {
            var version = 1;
            var testEvent = testBrushEvent();
            testEvent.serializeLegacy = serializeLegacyBrushEvent;
            var serialization = testEvent.serializeLegacy(1.0, version);
            var splitSerialization = serialization.split(' ');
            var parsedEvent = PictureEvent.parse(splitSerialization, 0, version);
            expectTestBrushEvent(parsedEvent);
        });
    });

    describe('ScatterEvent', function() {
        commonEventTests(testScatterEvent, expectTestScatterEvent);

        commonBrushEventTests(testScatterEvent);

        it('updates its bounding box if its generation is changed', function() {
            var testEvent = testScatterEvent();
            testEvent.radius = 3;
            testEvent.pushCoordTriplet(0, 0, 1);
            var oldBox = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            testEvent.radius = 5;
            ++testEvent.generation;
            var box = testEvent.getBoundingBox(new Rect(-10, 10, -10, -10));
            expect(box).not.toBe(oldBox);
            expect(box.right).toBeNear(oldBox.right + 2, 0.01);
            expect(box.left).toBeNear(oldBox.left - 2, 0.01);
            expect(box.top).toBeNear(oldBox.top - 2, 0.01);
            expect(box.bottom).toBeNear(oldBox.bottom + 2, 0.01);
        });

        it('parses a version 1 event', function() {
            var version = 1;
            var testEvent = testScatterEvent();
            testEvent.serializeLegacy = serializeLegacyBrushEvent;
            var serialization = testEvent.serializeLegacy(1.0, version);
            var splitSerialization = serialization.split(' ');
            var parsedEvent = PictureEvent.parse(splitSerialization, 0, version);
            expectTestScatterEvent(parsedEvent);
        });
    });

    describe('GradientEvent', function() {
        commonEventTests(testGradientEvent, expectTestGradientEvent);
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
