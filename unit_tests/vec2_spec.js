/*
 * Copyright Olli Etuaho 2013.
 */

'use strict';

import { Vec2 } from '../vec2.js';

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
