/*
 * Copyright Olli Etuaho 2013.
 */

describe('SWMipmap', function() {
    var canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0.0, '#000');
    grad.addColorStop(1.0, '#fff');
    ctx.fillStyle = grad;
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();
    var mipmap = new SWMipmap(canvas);

    it('samples bilinearly from all lod levels', function() {
        var s = 0.5;
        var t = 0.5;
        for (var lod = 0; lod < mipmap.levels.length; ++lod) {
            expect(mipmap.sampleFromLevel(s, t, lod)).toBeNear(0.5, 0.02);
        }
    });

    it('clamps out-of-range s and t values when sampling bilinearly', function() {
        var s = -0.5;
        var t = 1.5;
        for (var lod = 0; lod < mipmap.levels.length; ++lod) {
            expect(mipmap.sampleFromLevel(s, t, lod)).toBeNear(0.5, 0.02);
        }
    });

    it('clamps out-of-range lod levels when sampling trilinearly', function() {
        var s = 0.5;
        var t = 0.5;
        for (var lod = -5; lod < mipmap.levels.length + 5; ++lod) {
            expect(mipmap.sample(s, t, lod)).toBeNear(0.5, 0.02);
        }
    });

    it('returns same values from safe and unsafe bilinear sampling', function() {
        for (var lod = 0; lod < mipmap.levels.length; ++lod) {
            for (var s = 0.0; s <= 1.0; s += 0.1) {
                var t = 1.0 - s;
                var sInd = mipmap.getSInd(s, lod);
                var rowInd = mipmap.getRowInd(t, lod);
                var rowW = mipmap.getRowBelowWeight(t, lod);
                var unsafeSample = mipmap.sampleUnsafe(sInd, rowInd, rowW, lod);
                expect(isNaN(unsafeSample)).toBe(false);
                expect(unsafeSample).toBeNear(mipmap.sampleFromLevel(s, t, lod), 0.001);
            }
        }
    });
});

describe('Rasterizing system', function() {

    function initTestGl() {
        var canvas = document.createElement('canvas');
        canvas.width = 123;
        canvas.height = 456;
        return Picture.initWebGL(canvas);
    }

    function testBaseRasterizerProperties(testRasterizer, w, h) {
        expect(testRasterizer.width).toBe(w);
        expect(testRasterizer.height).toBe(h);
        expect(testRasterizer.soft).toBe(false);
        expect(testRasterizer.flowAlpha).toBe(0);
        expect(testRasterizer.prevX).toBe(null);
        expect(testRasterizer.prevY).toBe(null);
        expect(testRasterizer.prevR).toBe(null);
        expect(testRasterizer.t).toBe(0);
        expect(testRasterizer.clipRect.width()).toBe(w);
        expect(testRasterizer.clipRect.height()).toBe(h);
    }

    function testLineDrawingBasics(testRasterizer, testFillCircleCalls) {
        if (testFillCircleCalls === undefined) {
            testFillCircleCalls = false;
        }
        testRasterizer.beginCircleLines(true, 0, 0.1);
        expect(testRasterizer.soft).toBe(true);
        expect(testRasterizer.flowAlpha).toBe(0.1);
        expect(testRasterizer.t).toBe(0);
        testRasterizer.circleLineTo(0, 0, 1);
        expect(testRasterizer.prevX).toBe(0);
        expect(testRasterizer.prevY).toBe(0);
        expect(testRasterizer.prevR).toBe(1);
        expect(testRasterizer.t).toBe(0);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(0);
        }

        testRasterizer.circleLineTo(0, 0.5, 4);
        expect(testRasterizer.prevX).toBe(0);
        expect(testRasterizer.prevY).toBe(0.5);
        expect(testRasterizer.prevR).toBe(4);
        expect(testRasterizer.t).toBeNear(0.5, 0.001);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(1);
            expect(testRasterizer.fillCircleCalls[0].centerX).toBe(0);
            expect(testRasterizer.fillCircleCalls[0].centerY).toBe(0);
            expect(testRasterizer.fillCircleCalls[0].radius).toBe(1);
        }

        testRasterizer.circleLineTo(2, 0.5, 5);
        expect(testRasterizer.prevX).toBe(2);
        expect(testRasterizer.prevY).toBe(0.5);
        expect(testRasterizer.prevR).toBe(5);
        expect(testRasterizer.t).toBeNear(0.5, 0.001);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(3);
            expect(testRasterizer.fillCircleCalls[1].centerX).toBeNear(0.5,
                                                                       0.001);
            expect(testRasterizer.fillCircleCalls[1].centerY).toBeNear(0.5,
                                                                       0.001);
            expect(testRasterizer.fillCircleCalls[1].radius).toBeNear(4.25,
                                                                      0.001);
            expect(testRasterizer.fillCircleCalls[2].centerX).toBeNear(1.5,
                                                                       0.001);
            expect(testRasterizer.fillCircleCalls[2].centerY).toBeNear(0.5,
                                                                       0.001);
            expect(testRasterizer.fillCircleCalls[2].radius).toBeNear(4.75,
                                                                      0.001);
        }
    }

    describe('BaseRasterizer', function() {
        var TestRasterizer = function(width, height) {
            this.initBaseRasterizer(width, height, null);
            this.fillCircleCalls = [];
        };

        TestRasterizer.prototype = new BaseRasterizer();

        TestRasterizer.prototype.fillCircle = function(centerX, centerY,
                                                       radius) {
            this.fillCircleCalls.push({centerX: centerX,
                                       centerY: centerY,
                                       radius: radius});
        };

        it('initializes', function() {
            var testRasterizer = new TestRasterizer(123, 456);
            testBaseRasterizerProperties(testRasterizer, 123, 456);
        });

        it('can draw a line by calling fillCircle', function() {
            var testRasterizer = new TestRasterizer(123, 456);
            testLineDrawingBasics(testRasterizer, true);
        });

        it('has a clip rectangle', function() {
            var testRasterizer = new TestRasterizer(123, 456);
            var clipRect = new Rect(10, 20, 30, 40);
            testRasterizer.setClip(clipRect);
            expect(testRasterizer.clipRect).toEqual(clipRect);
        });
    });

    var commonRasterizerTests = function(createRasterizer) {
        it('initializes', function() {
            var rasterizer = createRasterizer();
            testBaseRasterizerProperties(rasterizer, 123, 456);
        });

        it('passes the sanity test', function() {
            var rasterizer = createRasterizer();
            expect(rasterizer.checkSanity()).toBe(true);

            rasterizer.free();
        });

        it('draws a linear gradient', function() {
            var rasterizer = createRasterizer();
            var coords0 = new Vec2(0, 0);
            var coords1 = new Vec2(rasterizer.width, rasterizer.height);
            rasterizer.linearGradient(coords1, coords0);
            for (var i = 0.1; i < 1.0; i += 0.1) {
                var samplePoint = new Vec2(rasterizer.width, rasterizer.height);
                samplePoint.scale(i);
                expect(rasterizer.getPixel(samplePoint)).toBeNear(i, 0.05);
            }

            rasterizer.free();
        });

        it('draws a vertical gradient', function() {
            var rasterizer = createRasterizer();
            var coords0 = new Vec2(0, 0);
            var coords1 = new Vec2(0, rasterizer.height);
            rasterizer.linearGradient(coords1, coords0);
            for (var i = 0.1; i < 1.0; i += 0.1) {
                var samplePoint = new Vec2(0, rasterizer.height);
                samplePoint.scale(i);
                expect(rasterizer.getPixel(samplePoint)).toBeNear(i, 0.05);
            }

            rasterizer.free();
        });

        it('clips gradients', function() {
            var rasterizer = createRasterizer();
            var clipPoint = new Vec2(10, rasterizer.height - 5);
            rasterizer.setClip(new Rect(clipPoint.x, clipPoint.x + 1,
                                        clipPoint.y, clipPoint.y + 1));
            var coords0 = new Vec2(0, 0);
            var coords1 = new Vec2(0, rasterizer.height);
            rasterizer.linearGradient(coords1, coords0);
            coords1.x = rasterizer.width;
            rasterizer.linearGradient(coords1, coords0);
            for (var i = 0.1; i < 1.0; i += 0.1) {
                var samplePoint = new Vec2(0, rasterizer.height);
                samplePoint.scale(i);
                expect(rasterizer.getPixel(samplePoint)).toBe(0.0);
                samplePoint = new Vec2(rasterizer.width, rasterizer.height);
                samplePoint.scale(i);
                expect(rasterizer.getPixel(samplePoint)).toBe(0.0);
            }
            expect(rasterizer.getPixel(clipPoint)).not.toBe(0.0);

            rasterizer.free();
        });

        // TODO: Test brush textures
    };

    describe('Rasterizer', function() {
        var createRasterizer = function() {
            return new Rasterizer(123, 456, null);
        };

        commonRasterizerTests(createRasterizer);

        it('can draw a line', function() {
            var rasterizer = new Rasterizer(123, 456, null);
            testLineDrawingBasics(rasterizer);
        });

        it('has a clip rectangle', function() {
            var rasterizer = new Rasterizer(123, 456, null);
            var clipRect = new Rect(10, 20, 30, 40);
            rasterizer.setClip(clipRect);
            expect(rasterizer.clipRect).toEqual(clipRect);
        });

        it('does not overflow when drawing', function() {
            var rasterizer = new Rasterizer(123, 456, null);
            var clipRect = new Rect(-100, 223, -100, 556);
            rasterizer.setClip(clipRect);
            rasterizer.beginCircleLines(true, 0, 0.1);
            rasterizer.circleLineTo(123, 0, 1);
            rasterizer.circleLineTo(123, 100, 1);
            var coords = new Vec2(0, 1);
            expect(rasterizer.getPixel(coords)).toBe(0);
            coords.x = 122;
            expect(rasterizer.getPixel(coords)).toNotBe(0);
        });
    });

    describe('GLDoubleBufferedRasterizer', function() {
        var createRasterizer = function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            return new GLDoubleBufferedRasterizer(gl, glManager, 123, 456, null);
        };

        commonRasterizerTests(createRasterizer);
    });

    describe('GLFloatRasterizer', function() {
        var createRasterizer = function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            return new GLFloatRasterizer(gl, glManager, 123, 456, null);
        };

        commonRasterizerTests(createRasterizer);
    });

    describe('GLFloatTexDataRasterizer', function() {
        var createRasterizer = function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            return new GLFloatTexDataRasterizer(gl, glManager, 123, 456, null);
        };

        commonRasterizerTests(createRasterizer);
    });
});
