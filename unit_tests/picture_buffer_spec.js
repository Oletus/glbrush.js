/*
 * Copyright Olli Etuaho 2013.
 */

var testBufferParams = {
    id: 0,
    width: 100,
    height: 100,
    clearColor: [60, 120, 180, 150],
    hasUndoStates: true,
    hasAlpha: true
};

var testBuffer = function(createBuffer, createRasterizer, params) {
    it('initializes', function() {
        var buffer = createBuffer(params);
        expect(buffer.id).toBe(params.id);
        expect(buffer.width()).toBe(params.width);
        expect(buffer.height()).toBe(params.height);
        expect(buffer.clearColor).toBe(params.clearColor);
        expect(buffer.undoStates).toEqual([]);
    });

    it('is cleared during initialization and playback', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        expectBufferCorrect(buffer, rasterizer, 0);
        buffer.clear();
        expectBufferCorrect(buffer, rasterizer, 0);
    });
    
    it('gives the color of one pixel', function() {
        var buffer = createBuffer(params);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeCloseTo(params.clearColor[0], -0.8);
        expect(samplePixel[1]).toBeCloseTo(params.clearColor[1], -0.8);
        expect(samplePixel[2]).toBeCloseTo(params.clearColor[2], -0.8);
        expect(samplePixel[3]).toBe(params.clearColor[3]);
    });

    it('plays back one event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = testBrushEvent();
        brushEvent.pushCoordTriplet(0, 0, 1.0);
        brushEvent.pushCoordTriplet(buffer.width(), buffer.height(), 0.5);
        buffer.pushEvent(brushEvent, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 0);
    });

    it('erases from the bitmap', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0, 0, 0], 1.0,
                                           BrushEvent.Mode.erase);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBe(0);
        expect(samplePixel[1]).toBe(0);
        expect(samplePixel[2]).toBe(0);
        expect(samplePixel[3]).toBe(0);
    });

    it('blends an event to the bitmap with the multiply mode', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var opacity = 0.5;
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           opacity, BrushEvent.Mode.multiply);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeCloseTo(params.clearColor[0] * (0.2 + (1.0 - 0.2) * opacity), -1.0);
        expect(samplePixel[1]).toBeCloseTo(params.clearColor[1] * (0.4 + (1.0 - 0.4) * opacity), -1.0);
        expect(samplePixel[2]).toBeCloseTo(params.clearColor[2] * (0.8 + (1.0 - 0.8) * opacity), -1.0);
        var targetAlpha = params.clearColor[3] / 255;
        var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
        expect(samplePixel[3]).toBeCloseTo(alpha, -1.0);
    });

    it('blends an event to the bitmap with the screen mode', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        var opacity = 0.5;
        var brushEvent = fillingBrushEvent(params.width, params.height,
                                           [0.2 * 255, 0.4 * 255, 0.8 * 255],
                                           opacity, BrushEvent.Mode.screen);
        buffer.pushEvent(brushEvent, rasterizer);
        var samplePixel = buffer.getPixelRGBA(new Vec2(0, 0));
        expect(samplePixel[0]).toBeCloseTo((255 - (255 - params.clearColor[0]) * (1.0 - 0.2)) * opacity + (1.0 - opacity) * params.clearColor[0], -1.0);
        expect(samplePixel[1]).toBeCloseTo((255 - (255 - params.clearColor[1]) * (1.0 - 0.4)) * opacity + (1.0 - opacity) * params.clearColor[1], -1.0);
        expect(samplePixel[2]).toBeCloseTo((255 - (255 - params.clearColor[2]) * (1.0 - 0.8)) * opacity + (1.0 - opacity) * params.clearColor[2], -1.0);
        var targetAlpha = params.clearColor[3] / 255;
        var alpha = (targetAlpha + opacity - targetAlpha * opacity) * 255;
        expect(samplePixel[3]).toBeCloseTo(alpha, -1.0);
    });

    var generateBrushEvent = function(seed, width, height) {
        var event = testBrushEvent();
        for (var j = 0; j < 10; ++j) {
            event.pushCoordTriplet((Math.sin(seed * j * 0.8) + 1.0) *
                                   width * 0.5,
                                   (Math.cos(seed * j * 0.7) + 1.0) *
                                   height * 0.5,
                                   0.6);
        }
        return event;
    };

    var fillBuffer = function(buffer, rasterizer, eventCount) {
        var eventCountStart = buffer.events.length;
        for (var i = eventCountStart; i < eventCount + eventCountStart; ++i) {
            var brushEvent = generateBrushEvent(i, buffer.width(),
                                                buffer.height());
            buffer.pushEvent(brushEvent, rasterizer);
        }
        expect(buffer.events.length).toBe(eventCount + eventCountStart);
    };

    it('plays back several events', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, 10);
        expectBufferCorrect(buffer, rasterizer, 0);
    });

    it('undoes an event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 1);
        expect(buffer.undoStateInterval).toBeGreaterThan(6);
        expect(buffer.undoStates).toEqual([]);
        buffer.undoEventIndex(5, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);
        buffer.events.splice(5, 1);
        expectBufferCorrect(buffer, rasterizer, 3);
    });

    it('undoes an event using an undo state', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        expect(buffer.undoStates.length).toBe(1);
        buffer.undoEventIndex(buffer.events.length - 2, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);
        buffer.events.splice(buffer.events.length - 2, 1);
        expectBufferCorrect(buffer, rasterizer, 3);
    });

    it('does not use an invalid undo state', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        expect(buffer.undoStates.length).toBe(1);
        buffer.undoEventIndex(buffer.undoStateInterval - 2, rasterizer);
        buffer.undoEventIndex(buffer.events.length - 2, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);
        buffer.events.splice(buffer.undoStateInterval - 2, 1);
        buffer.events.splice(buffer.events.length - 2, 1);
        expectBufferCorrect(buffer, rasterizer, 3);
    });

    it ('removes an event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 1);
        buffer.removeEventIndex(5, rasterizer);
        expect(buffer.events.length).toBe(buffer.undoStateInterval - 2);
        expectBufferCorrect(buffer, rasterizer, 3);
    });

    it ('removes an event using an undo state', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 3);
        buffer.removeEventIndex(buffer.events.length - 2, rasterizer);
        expect(buffer.events.length).toBe(buffer.undoStateInterval + 2);
        expectBufferCorrect(buffer, rasterizer, 3);
    });

    it ('inserts an event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval - 2);
        buffer.setInsertionPoint(5);
        var event = generateBrushEvent(9001, buffer.width(), buffer.height());
        buffer.insertEvent(event, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 3);
    });

    it ('has its contents replaced by an event', function() {
        var buffer = createBuffer(params);
        var rasterizer = createRasterizer(params);
        fillBuffer(buffer, rasterizer, buffer.undoStateInterval + 1);
        var event = generateBrushEvent(9001, buffer.width(), buffer.height());
        buffer.replaceWithEvent(event, rasterizer);
        expectBufferCorrect(buffer, rasterizer, 0);
        expect(buffer.events.length).toBe(1);
        if (buffer.undoStateInterval > 1) {
            expect(buffer.undoStates.length).toBe(0);
        }
    });
};

describe('CanvasBuffer', function() {
    var createBuffer = function(params) {
        return new CanvasBuffer(params.id, params.width, params.height,
                                params.clearColor, params.hasUndoStates,
                                params.hasAlpha);
    };
    var createRasterizer = function(params) {
        return new Rasterizer(params.width, params.height);
    };
    testBuffer(createBuffer, createRasterizer, testBufferParams);
});

describe('GLBuffer', function() {
    var canvas = document.createElement('canvas');
    var params = testBufferParams;
    canvas.width = params.width;
    canvas.height = params.height;
    var gl = Picture.initWebGL(canvas);
    var glManager = glStateManager(gl);
    var compositor = new GLCompositor(glManager, gl, 8);
    var texBlitProgram = glManager.shaderProgram(blitShader.blitSrc,
                                                 blitShader.blitVertSrc,
                                                 {uSrcTex: 'tex2d'});
    var texBlitUniforms = {
        uSrcTex: null
    };

    var createBuffer = function(params) {
        return new GLBuffer(gl, glManager, compositor, texBlitProgram,
                            params.id, params.width, params.height,
                            params.clearColor, params.hasUndoStates,
                            params.hasAlpha);
    };
    var createRasterizer = function(params) {
        return new GLDoubleBufferedRasterizer(gl, glManager, params.width,
                                              params.height);
    };

    testBuffer(createBuffer, createRasterizer, params);
});
