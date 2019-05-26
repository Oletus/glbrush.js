/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

import {
    AffineTransform,
    Rect
} from "../util2d.js";

import { Vec2 } from '../vec2.js';

import "../util2d_painting.js";

beforeEach(function() {
  jasmine.addMatchers({
    toBeNear: function(util, customEqualityTesters) {
      return {
          compare: function(actual, expected, tolerance) {
            let passed = Math.abs(actual - expected) <= tolerance;
            return {
                pass: passed,
                message: 'Expected ' + actual + ' to be near ' + expected + ' within tolerance of ' + tolerance
            };
          }
      }
    }
  });
});

describe('util2d', function() {
    describe('Vec2', function() {
        it('initializes', function() {
            var vec = new Vec2(1, 2);
            expect(vec.x).toBe(1);
            expect(vec.y).toBe(2);
        });

        it('can be set from another Vec2', function() {
            var vecA = new Vec2(1, 2);
            var vecB = new Vec2(3, 4);
            vecA.copy(vecB);
            expect(vecA.x).toBe(3);
            expect(vecA.y).toBe(4);
        });

        it('calculates its length', function() {
            var vec = new Vec2(3, 4);
            expect(vec.length()).toBeNear(5, 0.001);
        });

        it('calculates distance with another Vec2', function() {
            var vecA = new Vec2(3, 4);
            var vecB = new Vec2(7, 7);
            expect(vecA.distanceTo(vecB)).toBeNear(5, 0.001);
        });

        it('can be normalized', function() {
            var vec = new Vec2(3, 4);
            vec.normalize();
            expect(vec.length()).toBeNear(1, 0.001);
        });

        it('rounds its coordinates', function() {
            var vec = new Vec2(3.33, 4.8);
            vec.round();
            expect(vec.x).toBe(3);
            expect(vec.y).toBe(5);
        });

        it('calculates a dot product', function() {
            var vecA = new Vec2(1.2, 3.4);
            var vecB = new Vec2(8.7, 6.5);
            expect(vecA.dot(vecB)).toBeNear(1.2 * 8.7 + 3.4 * 6.5,
                                                   0.001);
        });

        it('scales', function() {
            var vec = new Vec2(1, 2);
            vec.multiplyScalar(3.4);
            expect(vec.x).toBeNear(3.4, 0.00001);
            expect(vec.y).toBeNear(6.8, 0.00001);
        });

        it('translates', function() {
                var vecA = new Vec2(1, 3);
                var vecB = new Vec2(5, 7);
                vecA.add(vecB);
                expect(vecA.x).toBe(6);
                expect(vecA.y).toBe(10);
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
            expect(vec.distanceTo(center)).toBeNear(radius, 0.00001);
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

        it('calculates its angle to the positive x axis', function() {
            var vecA = new Vec2(1.0, 0.0);
            expect(vecA.angle()).toBeNear(0, 0.0001);
            var vecB = new Vec2(0.0, 1.0);
            expect(vecB.angle()).toBeNear(Math.PI * 0.5, 0.0001);
            var vecC = new Vec2(-1.0, 0.0);
            expect(vecC.angle()).toBeNear(Math.PI, 0.0001);
            var vecD = new Vec2(0.0, -1.0);
            expect(vecD.angle()).toBeNear(Math.PI * 1.5, 0.0001);
            var vecE = new Vec2(1.0, 1.0);
            expect(vecE.angle()).toBeNear(Math.PI * 0.25, 0.0001);
        });

        it('calculates its angle to another vector', function() {
            var vecA = new Vec2(1.0, 0.0);
            expect(vecA.angleFrom(vecA)).toBeNear(0, 0.0001);
            var vecB = new Vec2(0.0, 1.0);
            expect(vecB.angleFrom(vecA)).toBeNear(Math.PI * 0.5, 0.0001);
            expect(vecA.angleFrom(vecB)).toBeNear(-Math.PI * 0.5, 0.0001);
            var vecC = new Vec2(-1.0, 0.0);
            expect(vecC.angleFrom(vecA)).toBeNear(Math.PI, 0.0001);
            expect(vecC.angleFrom(vecB)).toBeNear(Math.PI * 0.5, 0.0001);
            expect(vecB.angleFrom(vecC)).toBeNear(-Math.PI * 0.5, 0.0001);
            var vecD = new Vec2(0.0, -1.0);
            expect(vecD.angleFrom(vecA)).toBeNear(Math.PI * 1.5, 0.0001);
            expect(vecD.angleFrom(vecB)).toBeNear(Math.PI, 0.0001);
            expect(vecD.angleFrom(vecC)).toBeNear(Math.PI * 0.5, 0.0001);
            expect(vecC.angleFrom(vecD)).toBeNear(-Math.PI * 0.5, 0.0001);
        });

        it('rotates', function() {
            for (var i = 0; i < 10; ++i) {
                var vecA = new Vec2(1.0, 0.0);
                var vecB = new Vec2(1.0, 0.0);
                vecB.rotate(i * 0.2 * Math.PI);
                vecA.rotate(i * 0.1 * Math.PI);
                expect(vecB.angleFrom(vecA)).toBeNear(i * 0.1 * Math.PI, 0.0001);
            }
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

    describe('AffineTransform', function() {
        it('initializes', function() {
            var a = new AffineTransform();
            expect(a.translate.x).toBe(0);
            expect(a.translate.y).toBe(0);
            expect(a.scale).toBe(1);
        });

        it('translates a vector', function() {
            var a = new AffineTransform();
            a.translate.x = 7;
            a.translate.y = 11;
            var v = new Vec2(2, 3);
            a.transform(v);
            expect(v.x).toBe(9);
            expect(v.y).toBe(14);
        });

        it('scales a vector', function() {
            var a = new AffineTransform();
            a.scale = 5;
            var v = new Vec2(2, 3);
            a.transform(v);
            expect(v.x).toBe(10);
            expect(v.y).toBe(15);
        });

        it('scales and translates a vector', function() {
            var a = new AffineTransform();
            a.translate.x = 7;
            a.translate.y = 11;
            a.scale = 5;
            var v = new Vec2(2, 3);
            a.transform(v);
            expect(v.x).toBe(17);
            expect(v.y).toBe(26);
        });

        it('inverse transforms a vector', function() {
            var a = new AffineTransform();
            a.translate.x = 7;
            a.translate.y = 11;
            a.scale = 5;
            var v = new Vec2(2, 3);
            a.transform(v);
            a.inverseTransform(v);
            expect(v.x).toBe(2);
            expect(v.y).toBe(3);
        });

        it('scales and translates a rectangle', function() {
            var a = new AffineTransform();
            a.translate.x = 7;
            a.translate.y = 11;
            a.scale = 5;
            var r = new Rect(2, 3, 5, 13);
            a.transformRect(r);
            expect(r.left).toBe(17);
            expect(r.right).toBe(22);
            expect(r.top).toBe(36);
            expect(r.bottom).toBe(76);
        });
    });
});
