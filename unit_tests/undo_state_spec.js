/*
 * Copyright Olli Etuaho 2013.
 */

describe('CanvasUndoState', function() {
    var createTestCanvas = function() {
        var canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 128;
        return canvas;
    };

    var fillTestCanvas = function(ctx) {
        ctx.fillStyle = 'rgb(12, 34, 45)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    };

    var expectFilledCanvas = function(ctx) {
        var imgData = ctx.getImageData(0, 0, ctx.canvas.width,
                                       ctx.canvas.height);
        var clearColor = [12, 34, 45, 255];
        expectArrayCorrect(imgData.data, clearColor, 0);
    };

    it('initializes', function() {
        var canvas = createTestCanvas();
        var ctx = canvas.getContext('2d');
        var state = new CanvasUndoState(3, 2, canvas.width, canvas.height,
                                        canvas);
        expect(state.index).toBe(3);
        expect(state.cost).toBe(2);
        expect(state.width).toBe(canvas.width);
        expect(state.height).toBe(canvas.height);
        expect(state.invalid).toBe(false);
        state.free();
    });

    it('initializes as invalid', function() {
        var state = new CanvasUndoState(3, 2, 123, 345,
                                        null);
        expect(state.index).toBe(3);
        expect(state.cost).toBe(2);
        expect(state.width).toBe(123);
        expect(state.height).toBe(345);
        expect(state.invalid).toBe(true);
    });

    it('stores a state', function() {
        var canvas = createTestCanvas();
        var ctx = canvas.getContext('2d');
        fillTestCanvas(ctx);
        var state = new CanvasUndoState(3, 2, canvas.width, canvas.height,
                                        canvas);
        expectFilledCanvas(state.ctx);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.draw(ctx, new Rect(0, canvas.width, 0, canvas.height));
        expectFilledCanvas(ctx);
        state.free();
    });

    it('can be freed and regenerated', function() {
        var canvas = createTestCanvas();
        var ctx = canvas.getContext('2d');
        fillTestCanvas(ctx);
        var state = new CanvasUndoState(3, 2, canvas.width, canvas.height,
                                        canvas);
        state.free();
        // Test that freeing twice is not a problem
        state.free();
        expect(state.invalid).toBe(true);
        expect(state.canvas).toBe(null);
        expect(state.ctx).toBe(null);
        // Some properties are kept even in freed states
        expect(state.index).toBe(3);
        expect(state.cost).toBe(2);
        expect(state.width).toBe(canvas.width);
        expect(state.height).toBe(canvas.height);
        state.update(canvas, new Rect(0, canvas.width, 0, canvas.height));
        expect(state.invalid).toBe(false);
        expectFilledCanvas(state.ctx);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.draw(ctx, new Rect(0, canvas.width, 0, canvas.height));
        expectFilledCanvas(ctx);
        state.free();
    });
});

describe('GLUndoState', function() {
    var testsInitialized = false;

    var canvas;
    var gl;
    var glManager;
    var compositor;
    var texBlitProgram;
    var texBlitUniforms;
    var initTestCanvas = function() {
        // Hack: share a canvas among tests as an optimization
        if (testsInitialized) {
            return;
        }
        testsInitialized = true;
        canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 128;
        gl = Picture.initWebGL(canvas);
        glManager = glStateManager(gl);
        glManager.useQuadVertexBuffer();
        compositor = new GLCompositor(glManager, gl, 8);
        texBlitProgram = glManager.shaderProgram(blitShader.blitSrc, blitShader.blitVertSrc, {'uSrcTex': 'tex2d'});
        texBlitUniforms = {
            'uSrcTex': null
        };
    };

    var createTestTexture = function() {
        var tex = glUtils.createTexture(gl, canvas.width, canvas.height);
        return tex;
    };

    var fillTestTexture = function(tex) {
        glManager.useFboTex(tex);
        glUtils.updateClip(gl, new Rect(0, canvas.width, 0, canvas.height),
                           canvas.height);
        gl.clearColor(12 / 255, 34 / 255, 45 / 255, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };

    var expectFilledTexture = function(tex) {
        glManager.useFboTex(tex);
        var buffer = new ArrayBuffer(canvas.width * canvas.height * 4);
        var pixelData = new Uint8Array(buffer);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA,
                      gl.UNSIGNED_BYTE, pixelData);
        var clearColor = [12, 34, 45, 255];
        expectArrayCorrect(pixelData, clearColor, 0);
    };

    it('initializes', function() {
        initTestCanvas();

        var tex = createTestTexture();
        var state = new GLUndoState(3, 2, tex, gl, glManager, texBlitProgram,
                                    canvas.width, canvas.height, true);
        expect(state.index).toBe(3);
        expect(state.cost).toBe(2);
        expect(state.width).toBe(canvas.width);
        expect(state.height).toBe(canvas.height);
        expect(state.invalid).toBe(false);
        expect(state.hasAlpha).toBe(true);

        state.free();
        gl.deleteTexture(tex);
    });

    it('initializes as invalid', function() {
        initTestCanvas();

        var state = new GLUndoState(3, 2, null, gl, glManager, texBlitProgram,
                                    123, 345, true);
        expect(state.index).toBe(3);
        expect(state.cost).toBe(2);
        expect(state.width).toBe(123);
        expect(state.height).toBe(345);
        expect(state.invalid).toBe(true);
        expect(state.hasAlpha).toBe(true);
    });

    it('stores a state', function() {
        initTestCanvas();

        var tex = createTestTexture();
        fillTestTexture(tex);
        var state = new GLUndoState(3, 2, tex, gl, glManager, texBlitProgram,
                                    canvas.width, canvas.height, true);
        expectFilledTexture(state.tex);
        glManager.useFboTex(tex);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        state.draw(new Rect(0, canvas.width, 0, canvas.height));
        expectFilledTexture(tex);

        state.free();
        gl.deleteTexture(tex);
    });

    it('can be freed and regenerated', function() {
        initTestCanvas();

        var tex = createTestTexture();
        fillTestTexture(tex);
        var state = new GLUndoState(3, 2, tex, gl, glManager, texBlitProgram,
                                    canvas.width, canvas.height, true);
        state.free();
        // Test that freeing twice is not a problem
        state.free();
        expect(state.invalid).toBe(true);
        expect(state.tex).toBe(null);
        // Some properties are kept even in freed states
        expect(state.index).toBe(3);
        expect(state.cost).toBe(2);
        expect(state.width).toBe(canvas.width);
        expect(state.height).toBe(canvas.height);
        state.update(tex, new Rect(0, canvas.width, 0, canvas.height));
        expect(state.invalid).toBe(false);
        expectFilledTexture(state.tex);
        glManager.useFboTex(tex);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        state.draw(new Rect(0, canvas.width, 0, canvas.height));
        expectFilledTexture(tex);

        state.free();
        gl.deleteTexture(tex);
    });
});
