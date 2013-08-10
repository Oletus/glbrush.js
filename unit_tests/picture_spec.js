/*
 * Copyright Olli Etuaho 2013.
 */

var doPictureTest = function(mode) {
    var width = 122;
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

    it('composits two buffers together', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, true);
        var clearColor2 = [35, 46, 57, 68];
        pic.addBuffer(1338, clearColor2, true, true);
        var blendedPixel = color.blend(clearColor, clearColor2);
        pic.display(); // test that displaying twice doesn't leave underlying
        // pixels visible
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeCloseTo(blendedPixel[0], -0.8);
        expect(samplePixel[1]).toBeCloseTo(blendedPixel[1], -0.8);
        expect(samplePixel[2]).toBeCloseTo(blendedPixel[2], -0.8);
        expect(samplePixel[3]).toBeCloseTo(blendedPixel[3], -0.8);
    });

    it('can change the order of two buffers', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, true);
        var clearColor2 = [35, 46, 57, 68];
        pic.addBuffer(1338, clearColor2, true, true);
        pic.moveBuffer(1, 0);
        var blendedPixel = color.blend(clearColor2, clearColor);
        var samplePixel = pic.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeCloseTo(blendedPixel[0], -0.8);
        expect(samplePixel[1]).toBeCloseTo(blendedPixel[1], -0.8);
        expect(samplePixel[2]).toBeCloseTo(blendedPixel[2], -0.8);
        expect(samplePixel[3]).toBeCloseTo(blendedPixel[3], -0.8);
    });

    it('resizes', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, false);
        var pic2 = Picture.resize(pic, 3.0);
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
    });

    it('resizes to the maximum scale', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, false);
        var pic2 = Picture.resize(pic, pic.maxBitmapScale());
        expect(pic2.width()).toBe(pic.width());
        expect(pic2.height()).toBe(pic.height());
        expect(pic2.bitmapWidth()).toBeLessThan(glUtils.maxFramebufferSize + 1);
        expect(pic2.bitmapHeight()).toBeLessThan(glUtils.maxFramebufferSize + 1);
        var samplePixel = pic2.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(12);
        expect(samplePixel[1]).toBe(23);
        expect(samplePixel[2]).toBe(34);
        expect(samplePixel[3]).toBe(255);
    });

    it('does not change if it is resized to the same size twice', function() {
        var pic = testPicture();
        var clearColor = [12, 23, 34, 45];
        pic.addBuffer(1337, clearColor, true, false);
        var brushEvent = new BrushEvent(0, 0, false, [56, 67, 78], 1.0, 1.0,
                                        10, 0, BrushEvent.Mode.normal);
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(pic.bitmapWidth(), pic.bitmapHeight(), 1.0);
        pic.pushEvent(0, brushEvent);
        var pic2 = Picture.resize(pic, 0.5);
        pic2 = Picture.resize(pic2, 0.5);
        expect(pic2.width()).toBe(pic.width());
        expect(pic2.height()).toBe(pic.height());
        expect(pic2.bitmapWidth()).toBe(pic2.width() * 0.5);
        expect(pic2.bitmapHeight()).toBe(pic2.height() * 0.5);
        var samplePixel = pic2.getPixelRGBA(new Vec2(pic2.bitmapWidth() - 1,
                                                     pic2.bitmapHeight() - 1));
        expect(samplePixel[0]).toBe(56);
        expect(samplePixel[1]).toBe(67);
        expect(samplePixel[2]).toBe(78);
        expect(samplePixel[3]).toBe(255);
        var event = pic2.buffers[0].events[0];
        expect(event.coords[3]).toBeCloseTo(pic2.bitmapWidth(), 0);
        expect(event.coords[4]).toBeCloseTo(pic2.bitmapHeight(), 0);
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
