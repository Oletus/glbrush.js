/*
 * Copyright Olli Etuaho 2013.
 */

var doPictureTest = function(mode) {
    var width = 123;
    var height = 234;
    function testPicture() {
        return new Picture(-1, new Rect(0, width, 0, height), 2.0, mode, 0);
    }

    it('initializes', function() {
        var pic = testPicture();
        expect(pic.id).toBe(-1);
        expect(pic.bitmapScale).toBe(2.0);
        expect(pic.mode).toEqual(mode);
        expect(pic.width()).toBe(width);
        expect(pic.height()).toBe(height);
        expect(pic.bitmapWidth()).toBe(width * 2.0);
        expect(pic.bitmapHeight()).toBe(height * 2.0);
    });

    it('contains buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, false);
        expect(pic.buffers[0].id).toBe(1337);
        expect(pic.buffers[0].clearColor[0]).toBe(12);
        expect(pic.buffers[0].clearColor[1]).toBe(23);
        expect(pic.buffers[0].clearColor[2]).toBe(34);
        expect(pic.buffers[0].clearColor[3]).toBe(255); // hasAlpha = false
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
    
    it('composits a current event in addition to buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, false);
        var brushEvent = new BrushEvent(0, 0, false, [56, 67, 78], 1.0, 1.0,
                                        10, 0, BrushEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(width, height, 1.0);
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
}
 
describe('Picture', function() {
    var modes = ['canvas', 'webgl', 'no-texdata-webgl', 'no-float-webgl'];
    for (var i = 0; i < modes.length; ++i) {
        describe('in mode ' + modes[i], function() {
            doPictureTest(modes[i]);
        });
    }
});
