/*
 * Copyright Olli Etuaho 2013.
 */

function testRGB() {
    var color = [];
    color[0] = 12;
    color[1] = 34;
    color[2] = 56;
    return color;
}

function testBrushEvent() {
    return new BrushEvent(0, 1, false, testRGB(), 0.78, 0.9, 25, 1.0,
                          BrushEvent.Mode.normal);
}

function expectTestBrushEvent(brushEvent) {
    expect(brushEvent.sid).toBe(0);
    expect(brushEvent.sessionEventId).toBe(1);
    expect(brushEvent.undone).toBe(false);
    expect(brushEvent.color).toEqual(testRGB());
    expect(brushEvent.flow).toBe(0.78);
    expect(brushEvent.opacity).toBe(0.9);
    expect(brushEvent.radius).toBe(25);
    expect(brushEvent.soft).toBe(true);
    expect(brushEvent.coords.length).toBe(0);
    expect(brushEvent.mode).toBe(BrushEvent.Mode.normal);
}

/**
 * Check a buffer for correctness by replaying it.
 * @param {PictureBuffer} buffer The buffer to check for correctness.
 * @param {BaseRasterizer} rasterizer The rasterizer to use for playback.
 * @param {number=} tolerance Tolerance for pixel values in the range 0-255.
 * Defaults to 3.
 */
function expectBufferCorrect(buffer, rasterizer, tolerance) {
    if (tolerance === undefined) {
        tolerance = 3;
    }
    var state = buffer.saveUndoState();
    var clipRect = buffer.getCurrentClipRect();
    expect(clipRect.left).toBe(0);
    expect(clipRect.top).toBe(0);
    expect(clipRect.width()).toBe(buffer.width());
    expect(clipRect.height()).toBe(buffer.height());
    buffer.clear();
    buffer.playbackAll(rasterizer);
    var correctState = buffer.saveUndoState();
    var stateData;
    var correctData;
    if (state instanceof CanvasUndoState) {
        stateData = state.ctx.getImageData(0, 0, buffer.width(),
                                               buffer.height()).data;
        correctData = correctState.ctx.getImageData(0, 0, buffer.width(),
                                                        buffer.height()).data;
    } else if (state instanceof GLUndoState) {
        stateData = new Uint8Array(buffer.width() * buffer.height() * 4);
        correctData = new Uint8Array(buffer.width() * buffer.height() * 4);
        var readState = function(s, toData) {
            s.glManager.useFbo(null);
            var clipRect = new Rect(0, buffer.width(), 0, buffer.height());
            s.draw(clipRect);
            s.gl.readPixels(0, 0, buffer.width(), buffer.height(),
                           s.gl.RGBA, s.gl.UNSIGNED_BYTE, toData);
        }
        readState(state, stateData);
        readState(correctState, correctData);
    }
    expect(stateData.length).toBe(correctData.length);
    var incorrectPixels = 0;
    for (var i = 0; i < stateData.length; ++i) {
        if (Math.abs(stateData[i] - correctData[i]) > tolerance) {
            ++incorrectPixels;
        }
    }
    if (incorrectPixels > 0) {
        var displayData = function(data, w, h) {
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            var imgData = ctx.createImageData(w, h);
            for (var i = 0; i < data.length; ++i) {
                imgData.data[i] = data[i];
            }
            ctx.putImageData(imgData, 0, 0);
            document.body.appendChild(canvas);
        };
        displayData(stateData, buffer.width(), buffer.height());
        displayData(correctData, buffer.width(), buffer.height());
    }
    expect(incorrectPixels).toBe(0);
}
