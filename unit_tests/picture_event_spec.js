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
