/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

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

    it('is padded', function() {
        var padding = mipmap.padding;
        for (var lod = 0; lod < mipmap.levels.length; ++lod) {
            var dataWidth = mipmap.levelWidths[lod] + padding * 2;
            expect(mipmap.levels[lod].length).toBe(dataWidth * dataWidth);
            for (var p = 0; p < mipmap.padding; ++p) {
                for (var x = 0; x < dataWidth; ++x) {
                    var topEdge = mipmap.levels[lod][x + padding * dataWidth];
                    expect(mipmap.levels[lod][x + p * dataWidth]).toBe(topEdge);
                    var bottomEdge = mipmap.levels[lod][x + (dataWidth - 1 - padding) * dataWidth];
                    expect(mipmap.levels[lod][x + (dataWidth - 1 - p) * dataWidth]).toBe(bottomEdge);
                }
                for (var y = 0; y < dataWidth; ++y) {
                    var leftEdge = mipmap.levels[lod][padding + y * dataWidth];
                    expect(mipmap.levels[lod][p + y * dataWidth]).toBe(leftEdge);
                    var rightEdge = mipmap.levels[lod][dataWidth - 1 - padding + y * dataWidth];
                    expect(mipmap.levels[lod][dataWidth - 1 - p + y * dataWidth]).toBe(rightEdge);
                }
            }
        }
    });

    it('samples bilinearly from all lod levels', function() {
        for (var lod = 0; lod < mipmap.levels.length; ++lod) {
            expect(mipmap.sampleFromLevel(0.5, 0.5, lod)).toBeNear(0.5, 0.02);
            for (var s = 0.0; s <= 1.0; s += 0.1) {
                expect(mipmap.sampleFromLevel(s, s, lod)).toBeNear(s, 0.6 / mipmap.levelWidths[lod]);
            }
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
        var unsafe = function(s, t, lod) {
            var sInd = mipmap.getSInd(s, lod);
            var rowInd = mipmap.getRowInd(t, lod);
            var rowW = mipmap.getRowBelowWeight(t, lod);
            return mipmap.sampleUnsafe(sInd, rowInd, rowW, lod);
        };
        for (var lod = 0; lod < mipmap.levels.length; ++lod) {
            for (var s = 0.0; s <= 1.0; s += 0.1) {
                var t = 1.0 - s;
                var unsafeSample = unsafe(s, t, lod);
                expect(isNaN(unsafeSample)).toBe(false);
                expect(unsafeSample).toBeNear(mipmap.sampleFromLevel(s, t, lod), 0.001);
                var unsafeSample = unsafe(t, s, lod);
                expect(isNaN(unsafeSample)).toBe(false);
                expect(unsafeSample).toBeNear(mipmap.sampleFromLevel(t, s, lod), 0.001);
            }
        }
    });
});

describe('Rasterizing system', function() {

    function initTestGl(width, height) {
        var canvas = document.createElement('canvas');
        if (width === undefined) {
            canvas.width = 123;
            canvas.height = 456;
        } else {
            canvas.width = width;
            canvas.height = height;
        }
        return Picture.initWebGL(canvas, debugGLSettingFromURL());
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
        var brushTip = new BrushTipMover(true);
        if (testFillCircleCalls === undefined) {
            testFillCircleCalls = false;
        }
        testRasterizer.beginCircles(true, 0);

        brushTip.reset(testRasterizer, new AffineTransform(),
                       0, 0, 1, 0.5, 0.1, 0, 1, false, BrushTipMover.Rotation.off);
        expect(testRasterizer.soft).toBe(true);
        expect(testRasterizer.t).toBe(0);
        brushTip.circleLineTo(0, 0, 1, 0.5, 1.0);
        expect(brushTip.targetX).toBe(0);
        expect(brushTip.targetY).toBe(0);
        expect(brushTip.targetR).toBe(1);
        expect(brushTip.targetRot).toBe(0.5);
        expect(brushTip.t).toBe(0);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(0);
        }

        brushTip.circleLineTo(0, 0.5, 4, 0.6, 1.0);
        expect(brushTip.targetX).toBe(0);
        expect(brushTip.targetY).toBe(0.5);
        expect(brushTip.targetR).toBe(4);
        expect(brushTip.targetRot).toBe(0.6);
        expect(brushTip.t).toBeNear(0.5, 0.001);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(1);
            expect(testRasterizer.fillCircleCalls[0].centerX).toBe(0);
            expect(testRasterizer.fillCircleCalls[0].centerY).toBe(0);
            expect(testRasterizer.fillCircleCalls[0].radius).toBe(1);
            expect(testRasterizer.fillCircleCalls[0].flowAlpha).toBeNear(0.1, 0.01);
        }

        brushTip.circleLineTo(2, 0.5, 5, 0.7, 1.0);
        expect(brushTip.targetX).toBe(2);
        expect(brushTip.targetY).toBe(0.5);
        expect(brushTip.targetR).toBe(5);
        expect(brushTip.targetRot).toBe(0.7);
        expect(brushTip.t).toBeNear(0.5, 0.001);
        if (testFillCircleCalls) {
            expect(testRasterizer.fillCircleCalls.length).toBe(3);
            expect(testRasterizer.fillCircleCalls[1].centerX).toBeNear(0.5, 0.001);
            expect(testRasterizer.fillCircleCalls[1].centerY).toBeNear(0.5, 0.001);
            expect(testRasterizer.fillCircleCalls[1].radius).toBeNear(4.25, 0.001);
            expect(testRasterizer.fillCircleCalls[1].flowAlpha).toBeNear(0.1, 0.01);
            expect(testRasterizer.fillCircleCalls[2].centerX).toBeNear(1.5, 0.001);
            expect(testRasterizer.fillCircleCalls[2].centerY).toBeNear(0.5, 0.001);
            expect(testRasterizer.fillCircleCalls[2].radius).toBeNear(4.75, 0.001);
            expect(testRasterizer.fillCircleCalls[2].flowAlpha).toBeNear(0.1, 0.01);
        }
    }

    function testTextureCanvas() {
        var image = document.createElement('canvas');
        image.width = 128;
        image.height = 128;
        var ctx = image.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#fff';
        ctx.fillRect(5, 5, 40, 40);
        ctx.fillRect(59, 59, 64, 64);
        ctx.fillRect(20, 84, 20, 20);
        ctx.fillRect(84, 20, 30, 30);
        return image;
    }

    var TestRasterizer = function(width, height) {
        this.initBaseRasterizer(width, height, null);
        this.fillCircleCalls = [];
    };

    TestRasterizer.prototype = new BaseRasterizer();

    TestRasterizer.prototype.fillCircle = function(centerX, centerY,
                                                   radius, flowAlpha) {
        this.fillCircleCalls.push({centerX: centerX,
                                   centerY: centerY,
                                   radius: radius,
                                   flowAlpha: flowAlpha});
    };

    describe('BaseRasterizer', function() {
        it('initializes', function() {
            var testRasterizer = new TestRasterizer(123, 456);
            testBaseRasterizerProperties(testRasterizer, 123, 456);
        });

        it('has a clip rectangle', function() {
            var testRasterizer = new TestRasterizer(123, 456);
            var clipRect = new Rect(10, 20, 30, 40);
            testRasterizer.setClip(clipRect);
            expect(testRasterizer.clipRect).toEqual(clipRect);
        });
    });

    describe('BrushTipMover', function() {
        it('can draw a line by calling fillCircle', function() {
            var testRasterizer = new TestRasterizer(123, 456);
            testLineDrawingBasics(testRasterizer, true);
        });

        /**
         * Draw a brush stroke with a relatively sharp corner but which still will be bezier-smoothed.
         * @param {number} scale Scale for spacing and draw coordinates.
         * @param {boolean} scatter True if scatter > 0 is desired.
         * @param {boolean} randomRotation True if random rotation is desired.
         */
        var countCalls = function(scale, scatter, randomRotation) {
            var testRasterizer = new TestRasterizer(123, 456);
            var brushTip = new BrushTipMover(false);
            brushTip.reset(testRasterizer, new AffineTransform(),
                           0, 0, 1, 2, 0.1, (scatter ? 1 : 0), /* spacing */ 0.001 * scale,
                           /* relativeSpacing */ scatter,
                           randomRotation ? BrushTipMover.Rotation.random : BrushTipMover.Rotation.off);
            brushTip.move(1 * scale, 0, 1);
            brushTip.move(4 * scale, 1 * scale, 1);
            brushTip.move(4.1 * scale, 1.1 * scale, 1);
            brushTip.move(10 * scale, 4 * scale, 1);
            return testRasterizer.fillCircleCalls.length;
        };

        describe('calls fillCircle the same number of times regardless of scale', function() {
            it('in case there is scatter', function() {
                var calls1 = countCalls(1.0, true, false);
                var calls01 = countCalls(0.000001, true, false);
                expect(calls1).toBeGreaterThan(0);
                expect(calls1).toBe(calls01);
            });

            it('in case the brush is randomly rotated', function() {
                var calls1 = countCalls(1.0, false, true);
                var calls01 = countCalls(0.000001, false, true);
                expect(calls1).toBeGreaterThan(0);
                expect(calls1).toBe(calls01);
            });

            it('but not in case the brush is continuous', function() {
                var calls1 = countCalls(10.0, false, false);
                var calls01 = countCalls(1, false, false);
                expect(calls1).toBeGreaterThan(0);
                expect(calls01).toBeNear(calls1 * 0.1, 1);
            });
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

        var testTexturizedCircle = function(angle) {
            var brushTextureData = [];
            var canvas = testTextureCanvas();
            brushTextureData.push(canvas);
            expect(canvas.width).toBe(canvas.height);
            var w = canvas.width;
            var canvasData = canvas.getContext('2d').getImageData(0, 0, w, w);

            var rasterizer = createRasterizer(w, w, brushTextureData);
            if (!(rasterizer instanceof Rasterizer)) {
                expect(rasterizer.gl.canvas.width).toBe(w);
                expect(rasterizer.gl.canvas.height).toBe(w);
            }
            expect(rasterizer.checkSanity()).toBe(true);

            var radius = w * 0.5;
            var center = new Vec2(w * 0.5, w * 0.5);

            rasterizer.beginCircles(false, 1);
            rasterizer.fillCircle(center.x, center.y, radius, 1.0, angle);
            rasterizer.flushCircles();

            var wrongPixelsOutsideCircle = 0;
            var wrongPixels = 0;
            var pixels = [];
            var wrongMap = [];
            var step = 4;
            for (var y = step / 2; y < w; y += step) {
                for (var x = step / 2; x < w; x += step) {
                    var pixel = rasterizer.getPixel(new Vec2(x + 0.5, y + 0.5));
                    var wrong = 0;
                    var centerDist = center.distance(new Vec2(x + 0.5, y + 0.5));
                    if (centerDist > radius + 2) {
                        if (pixel !== 0) {
                            ++wrongPixelsOutsideCircle;
                            wrong = 1;
                        }
                    } else if (centerDist < radius - 2) {
                        var canvasPixel = canvasData.data[(x + y * canvas.width) * 4] / 255;
                        if (angle !== 0) {
                            var rotX = Math.cos(angle) * (x / (w - 1) - 0.5) + Math.sin(angle) * (y / (w - 1) - 0.5);
                            var rotY = -Math.sin(angle) * (x / (w - 1) - 0.5) + Math.cos(angle) * (y / (w - 1) - 0.5);
                            rotX = Math.round((rotX + 0.5) * (w - 1));
                            rotY = Math.round((rotY + 0.5) * (w - 1));
                            canvasPixel = canvasData.data[(rotX + rotY * canvas.width) * 4] / 255;
                        }
                        if (Math.abs(pixel - canvasPixel) > 0.01) {
                            ++wrongPixels;
                            wrong = 1;
                        }
                    }
                    pixels.push(pixel);
                    wrongMap.push(wrong);
                }
            }
            expect(wrongPixelsOutsideCircle).toBe(0);
            expect(wrongPixels).toBe(0);
            if (wrongPixels > 0) {
                var debugCanvas = document.createElement('canvas');
                var debugW = Math.sqrt(pixels.length);
                console.log(debugW);
                debugCanvas.width = debugW;
                debugCanvas.height = debugW;
                var debugCtx = debugCanvas.getContext('2d');
                var imageData = debugCtx.createImageData(debugW, debugW);
                for (var i = 0; i < pixels.length; ++i) {
                    imageData.data[i * 4] = pixels[i] * 128 + wrongMap[i] * 100;
                    imageData.data[i * 4 + 1] = pixels[i] * 128;
                    imageData.data[i * 4 + 2] = pixels[i] * 128;
                    imageData.data[i * 4 + 3] = 255;
                }
                debugCtx.putImageData(imageData, 0, 0);
                debugCanvas.style.width = canvas.width + 'px';
                debugCanvas.style.height = canvas.height + 'px';
                document.body.appendChild(debugCanvas);
                document.body.appendChild(canvas);
            }

            rasterizer.free();
        };

        it('draws a texturized circle', function() {
            testTexturizedCircle(0);
        });

        it('draws a rotated texturized circle', function() {
            testTexturizedCircle(Math.PI * 0.5);
        });
    };

    describe('Rasterizer', function() {
        var createRasterizer = function(width, height, brushTextureData) {
            if (width === undefined) {
                width = 123;
            }
            if (height === undefined) {
                height = 456;
            }
            if (brushTextureData === undefined) {
                return new Rasterizer(width, height, null);
            } else {
                var brushTextures = new CanvasBrushTextures();
                for (var i = 0; i < brushTextureData.length; ++i) {
                    brushTextures.addTexture(brushTextureData[i]);
                }
                return new Rasterizer(width, height, brushTextures);
            }
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
            rasterizer.beginCircles(true, 0);
            for (var y = 0; y < 100; ++y) {
                rasterizer.fillCircle(123, y, 1, 0.1, 0);
            }
            var coords = new Vec2(0, 1);
            expect(rasterizer.getPixel(coords)).toBe(0);
            coords.x = 122;
            expect(rasterizer.getPixel(coords)).toNotBe(0);
        });
    });

    describe('GLDoubleBufferedRasterizer', function() {
        var createRasterizer = function(width, height, brushTextureData) {
            if (width === undefined) {
                width = 123;
            }
            if (height === undefined) {
                height = 456;
            }
            var gl = initTestGl(width, height);
            var glManager = glStateManager(gl);
            glManager.useQuadVertexBuffer();
            if (brushTextureData === undefined) {
                return new GLDoubleBufferedRasterizer(gl, glManager, width, height, null);
            } else {
                var brushTextures = new GLBrushTextures(gl, glManager);
                for (var i = 0; i < brushTextureData.length; ++i) {
                    brushTextures.addTexture(brushTextureData[i]);
                }
                return new GLDoubleBufferedRasterizer(gl, glManager, width, height, brushTextures);
            }
        };

        commonRasterizerTests(createRasterizer);
    });

    describe('GLFloatRasterizer', function() {
        var createRasterizer = function(width, height, brushTextureData) {
            if (width === undefined) {
                width = 123;
            }
            if (height === undefined) {
                height = 456;
            }
            var gl = initTestGl(width, height);
            var glManager = glStateManager(gl);
            glManager.useQuadVertexBuffer();
            if (brushTextureData === undefined) {
                return new GLFloatRasterizer(gl, glManager, width, height, null);
            } else {
                var brushTextures = new GLBrushTextures(gl, glManager);
                for (var i = 0; i < brushTextureData.length; ++i) {
                    brushTextures.addTexture(brushTextureData[i]);
                }
                return new GLFloatRasterizer(gl, glManager, width, height, brushTextures);
            }
        };

        commonRasterizerTests(createRasterizer);
    });

    describe('GLFloatTexDataRasterizer', function() {
        var createRasterizer = function(width, height, brushTextureData) {
            if (width === undefined) {
                width = 123;
            }
            if (height === undefined) {
                height = 456;
            }
            var gl = initTestGl(width, height);
            var glManager = glStateManager(gl);
            glManager.useQuadVertexBuffer();
            if (brushTextureData === undefined) {
                return new GLFloatTexDataRasterizer(gl, glManager, width, height, null);
            } else {
                var brushTextures = new GLBrushTextures(gl, glManager);
                for (var i = 0; i < brushTextureData.length; ++i) {
                    brushTextures.addTexture(brushTextureData[i]);
                }
                return new GLFloatTexDataRasterizer(gl, glManager, width, height, brushTextures);
            }
        };

        commonRasterizerTests(createRasterizer);
    });
});
