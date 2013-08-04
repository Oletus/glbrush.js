/*
 * Copyright Olli Etuaho 2013.
 */

describe('PictureEvent', function() {
    it('initializes as BrushEvent', function() {
        var brushEvent = testBrushEvent();
        expectTestBrushEvent(brushEvent);
    });

    it('is the same after a round of serialization and parsing', function() {
        var brushEvent = testBrushEvent();
        var serialization = brushEvent.serialize();
        var splitSerialization = serialization.split(' ');
        var parsedEvent = PictureEvent.parse(splitSerialization, 0);
        expectTestBrushEvent(parsedEvent);
    });
});