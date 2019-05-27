/*
 * Copyright Olli Etuaho 2019.
 */

import * as mathUtil from '../src/math/math_util.js';

describe('mathUtil', function() {
	it('interpolates linearly', function() {
		expect(mathUtil.mix(1, 4, 0.0)).toBeNear(1, 0.0001);
		expect(mathUtil.mix(1, 4, 0.5)).toBeNear(2.5, 0.0001);
		expect(mathUtil.mix(1, 4, 1.0)).toBeNear(4, 0.0001);
	});

	it('calculates fmod', function() {
		expect(mathUtil.fmod(4.2, 1.3)).toBeNear(0.3, 0.0001);
	});

	it('interpolates with wrap', function() {
		expect(mathUtil.mixWithWrap(1, 4, 0.0, 7.0)).toBeNear(1, 0.0001);
		expect(mathUtil.mixWithWrap(1, 4, 0.5, 7.0)).toBeNear(2.5, 0.0001);
		expect(mathUtil.mixWithWrap(1, 4, 1.0, 7.0)).toBeNear(4, 0.0001);
		expect(mathUtil.mixWithWrap(2.0, 0.5, 0.5, 2.0)).toBeNear(0.25, 0.0001);
		expect(mathUtil.mixWithWrap(1.5, 0, 0.5, 2.0)).toBeNear(1.75, 0.0001);
	});

	it('interpolates angles in radians', function() {
		expect(mathUtil.mixAngles(0, Math.PI * 0.5, 0.0)).toBeNear(0, 0.0001);
		expect(mathUtil.mixAngles(0, Math.PI * 0.5, 0.5)).toBeNear(Math.PI * 0.25, 0.0001);
		expect(mathUtil.mixAngles(0, Math.PI * 0.5, 1.0)).toBeNear(Math.PI * 0.5, 0.0001);
		expect(mathUtil.mixAngles(Math.PI * 2, 0.5, 0.5)).toBeNear(0.25, 0.0001);
		expect(mathUtil.mixAngles(Math.PI * 2 - 0.5, 0, 0.5)).toBeNear(Math.PI * 2 - 0.25, 0.0001);
	});

	it('measures the difference between two angles', function() {
		expect(mathUtil.angleDifference(0, Math.PI)).toBeNear(Math.PI, 0.0001);
		expect(mathUtil.angleDifference(0.25, Math.PI * 2 - 0.25)).toBeNear(0.5, 0.0001);
		expect(mathUtil.angleDifference(1.25 * Math.PI, 0.5 * Math.PI)).toBeNear(0.75 * Math.PI, 0.0001);
		expect(mathUtil.angleDifference(0, 2 * Math.PI)).toBeNear(0, 0.0001);
		expect(mathUtil.angleDifference(0, 4 * Math.PI)).toBeNear(0, 0.0001);
		expect(mathUtil.angleDifference(-3 * Math.PI, 3 * Math.PI)).toBeNear(0, 0.0001);
	});

	it('determines which angle is greater', function() {
		expect(mathUtil.angleGreater(1, 0)).toBe(true);
		expect(mathUtil.angleGreater(0, Math.PI * 0.99)).toBe(false);
		expect(mathUtil.angleGreater(0, Math.PI * 1.01)).toBe(true);
		expect(mathUtil.angleGreater(0.5, 2 * Math.PI)).toBe(true);
		expect(mathUtil.angleGreater(0.5, 4 * Math.PI)).toBe(true);
		expect(mathUtil.angleGreater(-2.5 * Math.PI, 3 * Math.PI)).toBe(true);
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

	it('approximates the length of a bezier curve', function() {
		expect(mathUtil.bezierLength(0, 0, 0.5, 0.5, 1, 1, 16)).toBeNear(Math.sqrt(2), 0.001);
		expect(mathUtil.bezierLength(0, 0, 0.1, 0.1, 1, 1, 16)).toBeNear(Math.sqrt(2), 0.001);
		expect(mathUtil.bezierLength(0, 0, 0.9, 0.9, 1, 1, 16)).toBeNear(Math.sqrt(2), 0.001);
		expect(mathUtil.bezierLength(0, 0, 0, 3, 0, 0, 16)).toBeNear(2 * 2 * 3 * Math.pow(0.5, 2), 0.001);
		expect(mathUtil.bezierLength(0, 0, 0, 1, 1, 1, 16)).toBeNear(1.62, 0.01);
		expect(mathUtil.bezierLength(0, 0, 1, 0, 1, 1, 16)).toBeNear(1.62, 0.01);
	});
});
