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
    return new BrushEvent(0, 1, false, testRGB(), 0.78, 0.9, 25, 0, 1.0,
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
    var event = new BrushEvent(0, 1, false, color, flow, opacity, radius, 0, 0.0,
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
    expect(brushEvent.textureId).toBe(0);
    expect(brushEvent.soft).toBe(true);
    expect(brushEvent.coords.length).toBe(0);
    expect(brushEvent.mode).toBe(PictureEvent.Mode.normal);
}

function testScatterEvent() {
    return new ScatterEvent(0, 1, false, testRGB(), 0.78, 0.9, 25, 0, 1.0,
                            PictureEvent.Mode.normal);
}

var expectTestScatterEvent = expectTestBrushEvent;

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


function testEventHideEvent() {
    return new EventHideEvent(0, 1, false, 12, 123);
}

function expectTestEventHideEvent(event) {
    expect(event.sid).toBe(0);
    expect(event.sessionEventId).toBe(1);
    expect(event.undone).toBe(false);
    expect(event.hiddenSid).toBe(12);
    expect(event.hiddenSessionEventId).toBe(123);
}

/**
 * Check an array for correct values.
 * @param {ArrayBufferView|Array.<number>} array Array to test.
 * @param {ArrayBufferView|Array.<number>} ref Array containing correct values.
 * Can be shorter than array, in which case the reference index is the array
 * index modulo reference length.
 * @param {number} tolerance Tolerance for correct values.
 * @return {number} Amount of incorrect values.
 */
function expectArrayCorrect(array, ref, tolerance) {
    var incorrectValues = 0;
    for (var i = 0; i < array.length; ++i) {
        if (Math.abs(array[i] - ref[i % ref.length]) > tolerance) {
            ++incorrectValues;
        }
    }
    expect(incorrectValues).toBe(0);
    return incorrectValues;
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
    var removeCount = buffer.removeCount;
    var i;
    var j;

    // TODO: Maybe check event session id ordering, though that puts an extra
    // burden on the tests.

    // Check event hide counts
    for (i = 0; i < buffer.events.length; ++i) {
        if (buffer.events[i].isRasterized()) {
            expect(typeof buffer.events[i].hideCount).toBe(typeof 0);
            var hiderCount = 0;
            for (j = 0; j < buffer.events.length; ++j) {
                if (buffer.events[j].eventType === 'eventHide' &&
                    !buffer.events[j].undone &&
                    buffer.events[j].hiddenSid === buffer.events[i].sid &&
                    buffer.events[j].hiddenSessionEventId ===
                    buffer.events[i].sessionEventId) {
                    ++hiderCount;
                }
            }
            expect(hiderCount).toBe(buffer.events[i].hideCount);
        }
    }

    var clipRect = buffer.getCurrentClipRect();
    expect(clipRect.left).toBe(0);
    expect(clipRect.top).toBe(0);
    expect(clipRect.width()).toBe(buffer.width());
    expect(clipRect.height()).toBe(buffer.height());
    buffer.playbackAll(rasterizer);

    // Check remove count
    var correctRemoveCount = 0;
    for (i = 0; i < buffer.events.length; ++i) {
        if (buffer.events[i].eventType === 'bufferRemove' &&
            !buffer.events[i].undone) {
            ++correctRemoveCount;
        }
    }
    expect(removeCount).toBe(correctRemoveCount);

    // Check bitmap state
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
    var incorrectPixels = expectArrayCorrect(stateData, correctData, tolerance);
    if (incorrectPixels > 0) {
        var displayData = function(data, w, h) {
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            var imgData = ctx.createImageData(w, h);
            for (i = 0; i < data.length; ++i) {
                imgData.data[i] = data[i];
            }
            ctx.putImageData(imgData, 0, 0);
            document.body.appendChild(canvas);
        };
        displayData(stateData, buffer.width(), buffer.height());
        displayData(correctData, buffer.width(), buffer.height());
    }
}

/**
 * @param {HTMLImageElement} img Image to test.
 * @param {Array.<number>|Uint8Array} color RGBA color to test for, channel values in range 0 to 255.
 * @param {number} tolerance Tolerance value.
 * @return {number} Amount of pixels inside the tolerance.
 */
function countColoredPixelsInImage(img, color, tolerance) {
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = 0;
    for (i = 0; i < imageData.data.length; i += 4) {
        if (Math.abs(imageData.data[i] - color[0]) < tolerance &&
            Math.abs(imageData.data[i + 1] - color[1]) < tolerance &&
            Math.abs(imageData.data[i + 2] - color[2]) < tolerance &&
            Math.abs(imageData.data[i + 3] - color[3]) < tolerance) {
            pixels++;
        }
    }
    return pixels;
}
