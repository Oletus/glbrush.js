/*
 * Copyright Olli Etuaho 2013.
 */

beforeEach(function() {
  this.addMatchers({
    toBeNear: function(expected, tolerance) {
      return Math.abs(this.actual - expected) <= tolerance;
    }
  });
});

describe('util2d', function() {
    describe('mathUtil', function() {
        it('interpolates linearly', function() {
            expect(mathUtil.mix(1, 4, 0.0)).toBeNear(1, 0.0001);
            expect(mathUtil.mix(1, 4, 0.5)).toBeNear(2.5, 0.0001);
            expect(mathUtil.mix(1, 4, 1.0)).toBeNear(4, 0.0001);
        });

        it('calculates fmod', function() {
            expect(mathUtil.fmod(4.2, 1.3)).toBeNear(0.3, 0.0001);
        });

        it('interpolates angles in radians', function() {
            expect(mathUtil.mixAngles(0, Math.PI * 0.5, 0.0)).toBeNear(0, 0.0001);
            expect(mathUtil.mixAngles(0, Math.PI * 0.5, 0.5)).toBeNear(Math.PI * 0.25, 0.0001);
            expect(mathUtil.mixAngles(0, Math.PI * 0.5, 1.0)).toBeNear(Math.PI * 0.5, 0.0001);
            expect(mathUtil.mixAngles(Math.PI * 2, 0.5, 0.5)).toBeNear(0.25, 0.0001);
            expect(mathUtil.mixAngles(Math.PI * 2 - 0.5, 0, 0.5)).toBeNear(Math.PI * 2 - 0.25, 0.0001);
        });

        it('interpolates smoothly', function() {
            expect(mathUtil.ease(1, 4, 0.0)).toBeNear(1, 0.0001);
            expect(mathUtil.ease(1, 4, 0.25)).toBeGreaterThan(2);
            expect(mathUtil.ease(1, 4, 0.25)).toBeLessThan(3);
            expect(mathUtil.ease(1, 4, 0.5)).toBeGreaterThan(3);
            expect(mathUtil.ease(1, 4, 0.5)).toBeLessThan(3.5);
            expect(mathUtil.ease(1, 4, 0.75)).toBeGreaterThan(3.5);
            expect(mathUtil.ease(1, 4, 1.0)).toBeNear(4, 0.0001);
        });
    });

    describe('cssUtil', function() {
        it('converts arrays of values to CSS RGB colors', function() {
            expect(cssUtil.rgbString([12, 34, 56])).toBe('rgb(12,34,56)');
        });

        it('converts arrays of values to CSS RGBA colors', function() {
            var rgbaString = cssUtil.rgbaString([12, 34, 56, 127.5]);
            expect(rgbaString).toBe('rgba(12,34,56,0.5)');
        });

        it('rounds float values down', function() {
            expect(cssUtil.rgbString([12.3, 45.6, 78.9])).toBe('rgb(12,45,78)');
            var rgbaString = cssUtil.rgbaString([12.3, 45.6, 78.9, 127.5]);
            expect(rgbaString).toBe('rgba(12,45,78,0.5)');
        });
    });

    describe('color', function() {

        function toUint8Array(arr) {
            var buffer = new ArrayBuffer(arr.length);
            var uints = new Uint8Array(buffer);
            for (var i = 0; i < arr.length; ++i) {
                uints[i] = arr[i];
            }
            return uints;
        }

        it('unpremultiplies if alpha is 255', function() {
            var testColor = toUint8Array([128, 128, 128, 255]);
            expect(colorUtil.unpremultiply(testColor)).toEqual(testColor);
        });
        it('unpremultiplies if alpha is less than 255', function() {
            var testColor = toUint8Array([128, 128, 128, 128]);
            var resultColor = toUint8Array([255, 255, 255, 128]);
            expect(colorUtil.unpremultiply(testColor)).toEqual(resultColor);
        });
        it('premultiplies if alpha is 255', function() {
            var testColor = toUint8Array([128, 128, 128, 255]);
            expect(colorUtil.premultiply(testColor)).toEqual(testColor);
        });
        it('premultiplies if alpha is less than 255', function() {
            var testColor = toUint8Array([128, 128, 128, 128]);
            var resultColor = toUint8Array([64, 64, 64, 128]);
            expect(colorUtil.premultiply(testColor)).toEqual(resultColor);
        });
        it('blends two color values with dstAlpha being 255', function() {
            var dstRGBA = toUint8Array([12, 34, 56, 255]);
            var srcRGBA = toUint8Array([87, 65, 43, 21]);
            var resultColor = toUint8Array([18, 37, 55, 255]);
            var blended = colorUtil.blend(dstRGBA, srcRGBA);
            expect(blended).toEqual(resultColor);
        });
        it('blends two color values with dstAlpha less than 255', function() {
            var dstRGBA = toUint8Array([12, 34, 56, 78]);
            var srcRGBA = toUint8Array([87, 65, 43, 21]);
            var resultColor = toUint8Array([29, 41, 53, 93]);
            var blended = colorUtil.blend(dstRGBA, srcRGBA);
            expect(blended).toEqual(resultColor);
        });
        it('blends with associativity', function() {
            var RGBAA = toUint8Array([123, 234, 134, 245]);
            var RGBAB = toUint8Array([12, 34, 56, 78]);
            var RGBAC = toUint8Array([87, 65, 43, 21]);
            var blendedBC = colorUtil.blend(RGBAB, RGBAC);
            var resultA = colorUtil.blend(RGBAA, blendedBC);
            var blendedAB = colorUtil.blend(RGBAA, RGBAB);
            var resultB = colorUtil.blend(blendedAB, RGBAC);
            for (var i = 0; i < 4; ++i) {
                expect(resultA[i]).toBeNear(resultB[i], 5);
            }
        });
        it('computes the alpha value that results to given alpha with n blends',
           function() {
            for (var flow = 0.01; flow < 0.99; flow += 0.01) {
                for (var n = 2; n < 10; ++n) {
                    var alpha = colorUtil.alphaForNBlends(flow, n);
                    expect(alpha).toBeLessThan(flow);
                    expect(colorUtil.nBlends(alpha, n)).toBeNear(flow, 0.01);
                }
            }
        });
        it('generates a visually distinct color for a given color', function() {
            var RGB = [255, 127, 255];
            var differentRGB = colorUtil.differentColor(RGB);
            expect(differentRGB[0]).toBeNear(0, 5);
            expect(differentRGB[2]).toBeNear(0, 5);
            RGB = [127, 127, 127];
            differentRGB = colorUtil.differentColor(RGB);
            expect(differentRGB[0]).toBeNear(230, 25);
            expect(differentRGB[1]).toBeNear(230, 25);
            expect(differentRGB[2]).toBeNear(230, 25);
        });
    });

    describe('Vec2', function() {
        it('initializes', function() {
            var vec = new Vec2(1, 2);
            expect(vec.x).toBe(1);
            expect(vec.y).toBe(2);
        });

        it('calculates its length', function() {
            var vec = new Vec2(3, 4);
            expect(vec.length()).toBeNear(5, 0.001);
        });

        it('calculates distance with another Vec2', function() {
            var vecA = new Vec2(3, 4);
            var vecB = new Vec2(7, 7);
            expect(vecA.distance(vecB)).toBeNear(5, 0.001);
        });

        it('can be normalized', function() {
            var vec = new Vec2(3, 4);
            vec.normalize();
            expect(vec.length()).toBeNear(1, 0.001);
        });

        it('calculates a dot product', function() {
            var vecA = new Vec2(1.2, 3.4);
            var vecB = new Vec2(8.7, 6.5);
            expect(vecA.dotProduct(vecB)).toBeNear(1.2 * 8.7 + 3.4 * 6.5,
                                                   0.001);
        });

        it('scales', function() {
            var vec = new Vec2(1, 2);
            vec.scale(3.4);
            expect(vec.x).toBeNear(3.4, 0.00001);
            expect(vec.y).toBeNear(6.8, 0.00001);
        });

        it('calculates a slope to another Vec2', function() {
            var vecA = new Vec2(1.2, 3.4);
            var vecB = new Vec2(8.7, 6.5);
            expect(vecA.slope(vecB)).toBeNear((6.5 - 3.4) / (8.7 - 1.2), 0.001);
        });

        it('projects to a line', function() {
            var vecA = new Vec2(1.2, 3.4);
            var vecB = new Vec2(8.7, 6.5);
            var vecC = new Vec2(9.0, 1.2);
            vecC.projectToLine(vecA, vecB);
            var deltaY = (vecC.x - vecA.x) * vecA.slope(vecB);
            expect(vecC.y - vecA.y).toBeNear(deltaY, 0.001);
            var origC = new Vec2(9.0, 1.2);
            expect(vecC.slope(origC)).toBeNear(-1.0 / vecA.slope(vecB), 0.001);
        });

        it('projects to a circle', function() {
            var vec = new Vec2(1.2, 3.4);
            var radius = 5.0;
            var center = new Vec2(6.7, 8.9);
            vec.projectToCircle(center.x, center.y, radius);
            expect(vec.distance(center)).toBeNear(radius, 0.00001);
            var projectedAngle = Math.atan2(vec.y - center.y, vec.x - center.x);
            var originalAngle = Math.atan2(3.4 - center.y, 1.2 - center.x);
            expect(projectedAngle).toBeNear(originalAngle, 0.00001);
        });

        it('calculates its distance to a line', function() {
            var vecA = new Vec2(1.2, 3.4);
            var vecB = new Vec2(8.7, 6.5);
            var vecC = new Vec2(9.0, 1.2);
            expect(vecC.distanceToLine(vecA, vecB)).toBeNear(5.0126811, 0.001);
        });
    });

    function testRect() {
        var left = 1;
        var right = 2;
        var top = 3;
        var bottom = 5;
        return new Rect(left, right, top, bottom);
    }

    function testRect2() {
        var left = 0;
        var right = 3;
        var top = 4;
        var bottom = 6;
        return new Rect(left, right, top, bottom);
    }

    function testRect3() {
        var left = 1;
        var right = 2.5;
        var top = 3;
        var bottom = 5.1;
        return new Rect(left, right, top, bottom);
    }

    function testRect4() {
        var left = 2.7;
        var right = 3.2;
        var top = 5.9;
        var bottom = 5.95;
        return new Rect(left, right, top, bottom);
    }

    describe('Rect', function() {
        it('initializes', function() {
            var rect = testRect();
            expect(rect.left).toBe(1);
            expect(rect.right).toBe(2);
            expect(rect.top).toBe(3);
            expect(rect.bottom).toBe(5);
        });

        it('initializes from a circle', function() {
            var rect = Rect.fromCircle(1, 2, 3);
            expect(rect.left).toBe(-2);
            expect(rect.right).toBe(4);
            expect(rect.top).toBe(-1);
            expect(rect.bottom).toBe(5);
        });

        it('calculates its width and height', function() {
            var rect = testRect();
            expect(rect.width()).toBe(1);
            expect(rect.height()).toBe(2);
        });

        it('calculates its area', function() {
            var rect = testRect();
            expect(rect.area()).toBe(2);
        });

        it('can be made empty', function() {
            var rect = testRect();
            expect(rect.isEmpty()).toBe(false);
            rect.makeEmpty();
            expect(rect.isEmpty()).toBe(true);
        });

        it('calculates its intersection with another Rect', function() {
            var rectA = testRect();
            var rectB = testRect2();
            var rect = rectA.getIntersection(rectB);
            expect(rect.isEmpty()).toBe(false);
            expect(rect.left).toBe(1);
            expect(rect.right).toBe(2);
            expect(rect.top).toBe(4);
            expect(rect.bottom).toBe(5);

            rectA.intersectRect(rectB);
            expect(rectA.isEmpty()).toBe(false);
            expect(rectA.left).toBe(1);
            expect(rectA.right).toBe(2);
            expect(rectA.top).toBe(4);
            expect(rectA.bottom).toBe(5);
        });

        it('calculates an empty intersection', function() {
            var rectA = testRect3();
            var rectB = testRect4();
            var rect = rectA.getIntersection(rectB);
            expect(rect.isEmpty()).toBe(true);

            rectA.intersectRect(rectB);
            expect(rectA.isEmpty()).toBe(true);
        });

        it('calculates a rounded out intersection', function() {
            var rectA = testRect3();
            var rectB = testRect4();
            expect(rectA.intersectsRectRoundedOut(rectB)).toBe(true);

            rectA.intersectRectRoundedOut(rectB);
            expect(rectA.isEmpty()).toBe(false);
            expect(rectA.left).toBe(2);
            expect(rectA.right).toBe(3);
            expect(rectA.top).toBe(5);
            expect(rectA.bottom).toBe(6);
        });

        it('calculates an empty rounded out intersection', function() {
            var rectA = testRect();
            var rectB = testRect4();
            expect(rectA.intersectsRectRoundedOut(rectB)).toBe(false);

            rectA.intersectRectRoundedOut(rectB);
            expect(rectA.isEmpty()).toBe(true);
        });

        it('determines whether a circle might intersect it' +
           'based on its rounded out bounding box', function() {
            var rect = testRect();
            expect(rect.mightIntersectCircleRoundedOut(1.5, 2, 1)).toBe(false);
            expect(rect.mightIntersectCircleRoundedOut(1.5, 2, 1.1)).toBe(true);
            expect(rect.mightIntersectCircleRoundedOut(1.5, 6, 1)).toBe(false);
            expect(rect.mightIntersectCircleRoundedOut(1.5, 6, 1.1)).toBe(true);
            expect(rect.mightIntersectCircleRoundedOut(0, 4, 1)).toBe(false);
            expect(rect.mightIntersectCircleRoundedOut(0, 4, 1.1)).toBe(true);
            expect(rect.mightIntersectCircleRoundedOut(3, 4, 1)).toBe(false);
            expect(rect.mightIntersectCircleRoundedOut(3, 4, 1.1)).toBe(true);
        });

        it('determines whether a point is inside it' +
           'based on its rounded out bounding box', function() {
            var rectA = testRect();
            expect(rectA.containsRoundedOut(new Vec2(1, 3))).toBe(true);
            expect(rectA.containsRoundedOut(new Vec2(2, 5))).toBe(true);
            expect(rectA.containsRoundedOut(new Vec2(0.5, 3.5))).toBe(false);
            expect(rectA.containsRoundedOut(new Vec2(2.5, 3.5))).toBe(false);
            expect(rectA.containsRoundedOut(new Vec2(1.5, 2.5))).toBe(false);
            expect(rectA.containsRoundedOut(new Vec2(1.5, 5.5))).toBe(false);
            var rectB = testRect4();
            expect(rectB.containsRoundedOut(new Vec2(2, 5))).toBe(true);
            expect(rectB.containsRoundedOut(new Vec2(4, 6))).toBe(true);
        });

        it('calculates its union with another Rect', function() {
            var rectA = testRect();
            var rectB = testRect2();
            rectA.unionRect(rectB);
            expect(rectA.left).toBe(0);
            expect(rectA.right).toBe(3);
            expect(rectA.top).toBe(3);
            expect(rectA.bottom).toBe(6);
        });

        it('calculates its union with a circle', function() {
            var rectA = testRect();
            rectA.unionCircle(1.5, 4, 0.5);
            expect(rectA.left).toBe(1);
            expect(rectA.right).toBe(2);
            expect(rectA.top).toBe(3);
            expect(rectA.bottom).toBe(5);

            rectA.unionCircle(2, 6, 2);
            expect(rectA.left).toBe(0);
            expect(rectA.right).toBe(4);
            expect(rectA.top).toBe(3);
            expect(rectA.bottom).toBe(8);
        });

        it('clips from the top', function() {
            var rectA = testRect();
            rectA.limitTop(1);
            expect(rectA.top).toBe(3);
            rectA.limitTop(3.5);
            expect(rectA.top).toBe(3.5);
            rectA.limitTop(6);
            expect(rectA.top).toBe(5);
        });

        it('clips from the bottom', function() {
            var rectA = testRect();
            rectA.limitBottom(6);
            expect(rectA.bottom).toBe(5);
            rectA.limitBottom(3.5);
            expect(rectA.bottom).toBe(3.5);
            rectA.limitBottom(1);
            expect(rectA.bottom).toBe(3);
        });

        it('clips from the left', function() {
            var rectA = testRect();
            rectA.limitLeft(0.5);
            expect(rectA.left).toBe(1);
            rectA.limitLeft(1.5);
            expect(rectA.left).toBe(1.5);
            rectA.limitLeft(3);
            expect(rectA.left).toBe(2);
        });

        it('clips from the right', function() {
            var rectA = testRect();
            rectA.limitRight(3);
            expect(rectA.right).toBe(2);
            rectA.limitRight(1.5);
            expect(rectA.right).toBe(1.5);
            rectA.limitRight(0.5);
            expect(rectA.right).toBe(1);
        });

        it('determines whether another Rect is mostly inside it', function() {
            var rectA = testRect();
            expect(rectA.isMostlyInside(new Rect(rectA.left - 2,
                                                 rectA.right + rectA.width(),
                                                 rectA.top - rectA.height(),
                                                 rectA.bottom + 2))).toBe(true);
            expect(rectA.isMostlyInside(new Rect(rectA.left +
                                                 rectA.width() * 0.49,
                                                 rectA.right,
                                                 rectA.top,
                                                 rectA.bottom))).toBe(true);
            expect(rectA.isMostlyInside(new Rect(rectA.left +
                                                 rectA.width() * 0.51,
                                                 rectA.right,
                                                 rectA.top,
                                                 rectA.bottom))).toBe(false);
        });
    });
});
