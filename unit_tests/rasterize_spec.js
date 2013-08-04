/*
 * Copyright Olli Etuaho 2013.
 */

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
        testRasterizer.beginLines(true, 0.1);
        expect(testRasterizer.soft).toBe(true);
        expect(testRasterizer.flowAlpha).toBe(0.1);
        expect(testRasterizer.t).toBe(0);
        testRasterizer.lineTo(0, 0, 1);
        expect(testRasterizer.prevX).toBe(0);
        expect(testRasterizer.prevY).toBe(0);
        expect(testRasterizer.prevR).toBe(1);
        expect(testRasterizer.t).toBe(0);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(0);
        }
        
        testRasterizer.lineTo(0, 0.5, 4);
        expect(testRasterizer.prevX).toBe(0);
        expect(testRasterizer.prevY).toBe(0.5);
        expect(testRasterizer.prevR).toBe(4);
        expect(testRasterizer.t).toBeCloseTo(0.5, 3);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(1);
            expect(testRasterizer.fillCircleCalls[0].centerX).toBe(0);
            expect(testRasterizer.fillCircleCalls[0].centerY).toBe(0);
            expect(testRasterizer.fillCircleCalls[0].radius).toBe(1);
        }
        
        testRasterizer.lineTo(2, 0.5, 5);
        expect(testRasterizer.prevX).toBe(2);
        expect(testRasterizer.prevY).toBe(0.5);
        expect(testRasterizer.prevR).toBe(5);
        expect(testRasterizer.t).toBeCloseTo(0.5, 3);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(3);
            expect(testRasterizer.fillCircleCalls[1].centerX).toBeCloseTo(0.5, 3);
            expect(testRasterizer.fillCircleCalls[1].centerY).toBeCloseTo(0.5, 3);
            expect(testRasterizer.fillCircleCalls[1].radius).toBeCloseTo(4.25, 3);
            expect(testRasterizer.fillCircleCalls[2].centerX).toBeCloseTo(1.5, 3);
            expect(testRasterizer.fillCircleCalls[2].centerY).toBeCloseTo(0.5, 3);
            expect(testRasterizer.fillCircleCalls[2].radius).toBeCloseTo(4.75, 3);
        }
    }

    describe('BaseRasterizer', function() {
        var TestRasterizer = function(width, height) {
            this.initBaseRasterizer(width, height);
            this.fillCircleCalls = [];
        };

        TestRasterizer.prototype = new BaseRasterizer();
        
        TestRasterizer.prototype.fillCircle = function(centerX, centerY, radius) {
            this.fillCircleCalls.push({centerX: centerX, centerY: centerY, radius: radius});
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

    describe('Rasterizer', function() {
        it('initializes', function() {
            var rasterizer = new Rasterizer(123, 456);
            testBaseRasterizerProperties(rasterizer, 123, 456);
        });

        it('can draw a line', function() {
            var rasterizer = new Rasterizer(123, 456);
            testLineDrawingBasics(rasterizer);
        });

        it('has a clip rectangle', function() {
            var rasterizer = new Rasterizer(123, 456);
            var clipRect = new Rect(10, 20, 30, 40);
            rasterizer.setClip(clipRect);
            expect(rasterizer.clipRect).toEqual(clipRect);
        });

        it('passes the sanity test', function() {
            var rasterizer = new Rasterizer(123, 456);
            expect(rasterizer.checkSanity()).toBe(true);
        });

        it('does not overflow when drawing', function() {
            var rasterizer = new Rasterizer(123, 456);
            var clipRect = new Rect(-100, 223, -100, 556);
            rasterizer.setClip(clipRect);
            rasterizer.beginLines(true, 0.1);
            rasterizer.lineTo(123, 0, 1);
            rasterizer.lineTo(123, 100, 1);
            var coords = new Vec2(0, 1);
            expect(rasterizer.getPixel(coords)).toBe(0);
            coords.x = 122;
            expect(rasterizer.getPixel(coords)).toNotBe(0);
        });
    });

    describe('GLDoubleBufferedRasterizer', function() {
        it('initializes', function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            var rasterizer = new GLDoubleBufferedRasterizer(gl, glManager, 123, 456);
            testBaseRasterizerProperties(rasterizer, 123, 456);
        });

        it('passes the sanity test', function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            var rasterizer = new GLDoubleBufferedRasterizer(gl, glManager, 123, 456);
            expect(rasterizer.checkSanity()).toBe(true);
        });
    });

    describe('GLFloatRasterizer', function() {
        it('initializes', function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            var rasterizer = new GLFloatRasterizer(gl, glManager, 123, 456);
            testBaseRasterizerProperties(rasterizer, 123, 456);
        });

        it('passes the sanity test', function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            var rasterizer = new GLFloatRasterizer(gl, glManager, 123, 456);
            expect(rasterizer.checkSanity()).toBe(true);
        });
    });

    describe('GLFloatTexDataRasterizer', function() {
        it('initializes', function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            var rasterizer = new GLFloatTexDataRasterizer(gl, glManager, 123, 456);
            testBaseRasterizerProperties(rasterizer, 123, 456);
        });

        it('passes the sanity test', function() {
            var gl = initTestGl();
            var glManager = glStateManager(gl);
            var rasterizer = new GLFloatTexDataRasterizer(gl, glManager, 123, 456);
            expect(rasterizer.checkSanity()).toBe(true);
        });
    });
});