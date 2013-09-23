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
                          PictureEvent.Mode.normal);
}

function fillingBrushEvent(widthToFill, heightToFill, color, opacity, mode,
                           flow) {
    if (color === undefined) {
        color = [0, 0, 0];
    }
    if (mode === undefined) {
        mode = PictureEvent.Mode.normal;
    }
    if (flow === undefined) {
        flow = 1.0;
    }
    var radius = Math.max(widthToFill, heightToFill) + 2;
    var event = new BrushEvent(0, 1, false, color, flow, opacity, radius, 0.0,
                          mode);
    event.pushCoordTriplet(0, 0, 1.0);
    event.pushCoordTriplet(widthToFill, heightToFill, 1.0);
    return event;
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
    expect(brushEvent.mode).toBe(PictureEvent.Mode.normal);
}

function testGradientEvent() {
    return new GradientEvent(0, 1, false, testRGB(), 0.78,
                             PictureEvent.Mode.normal);
}

function expectTestGradientEvent(gradientEvent) {
    expect(gradientEvent.sid).toBe(0);
    expect(gradientEvent.sessionEventId).toBe(1);
    expect(gradientEvent.undone).toBe(false);
    expect(gradientEvent.color).toEqual(testRGB());
    expect(gradientEvent.opacity).toBe(0.78);
    expect(gradientEvent.mode).toBe(PictureEvent.Mode.normal);
}

function dummyBufferMergeEvent() {
    return new BufferMergeEvent(0, 1, false, 0.78, {id: 2, isDummy: true});
}

function expectDummyBufferMergeEvent(bufferMergeEvent) {
    expect(bufferMergeEvent.sid).toBe(0);
    expect(bufferMergeEvent.sessionEventId).toBe(1);
    expect(bufferMergeEvent.undone).toBe(false);
    expect(bufferMergeEvent.opacity).toBe(0.78);
    expect(bufferMergeEvent.mergedBuffer.id).toBe(2);
}

function testBufferAddEvent() {
    return new BufferAddEvent(0, 1, false, 2, true, [12, 23, 34, 45], 0.5, 7);
}

function expectTestBufferAddEvent(bufferAddEvent) {
    expect(bufferAddEvent.sid).toBe(0);
    expect(bufferAddEvent.sessionEventId).toBe(1);
    expect(bufferAddEvent.undone).toBe(false);
    expect(bufferAddEvent.bufferId).toBe(2);
    expect(bufferAddEvent.hasAlpha).toBe(true);
    expect(bufferAddEvent.clearColor).toEqual([12, 23, 34, 45]);
    expect(bufferAddEvent.opacity).toBe(0.5);
    expect(bufferAddEvent.insertionPoint).toBe(7);
}

function testBufferRemoveEvent() {
    return new BufferRemoveEvent(0, 1, false, 2);
}

function expectTestBufferRemoveEvent(bufferRemoveEvent) {
    expect(bufferRemoveEvent.sid).toBe(0);
    expect(bufferRemoveEvent.sessionEventId).toBe(1);
    expect(bufferRemoveEvent.undone).toBe(false);
    expect(bufferRemoveEvent.bufferId).toBe(2);
}

function testBufferMoveEvent() {
    return new BufferMoveEvent(0, 1, false, 2, 3, 4);
}

function expectTestBufferMoveEvent(bufferMoveEvent) {
    expect(bufferMoveEvent.sid).toBe(0);
    expect(bufferMoveEvent.sessionEventId).toBe(1);
    expect(bufferMoveEvent.undone).toBe(false);
    expect(bufferMoveEvent.movedId).toBe(2);
    expect(bufferMoveEvent.fromIndex).toBe(3);
    expect(bufferMoveEvent.toIndex).toBe(4);
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
    var state = buffer.saveUndoState(0);
    var clipRect = buffer.getCurrentClipRect();
    expect(clipRect.left).toBe(0);
    expect(clipRect.top).toBe(0);
    expect(clipRect.width()).toBe(buffer.width());
    expect(clipRect.height()).toBe(buffer.height());
    buffer.playbackAll(rasterizer);
    var correctState = buffer.saveUndoState(0);
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
        };
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
