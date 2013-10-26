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

    describe('BrushEvent', function() {
        commonEventTests(testBrushEvent, expectTestBrushEvent);
    });

    describe('ScatterEvent', function() {
        commonEventTests(testScatterEvent, expectTestScatterEvent);
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
