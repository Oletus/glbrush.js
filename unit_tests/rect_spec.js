/*
 * Copyright Olli Etuaho 2013.
 */


import { Rect } from "../src/math/rect.js";

import { Vec2 } from '../src/math/vec2.js';

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
