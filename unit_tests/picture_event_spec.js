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
