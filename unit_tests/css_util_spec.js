/*
 * Copyright Olli Etuaho 2019.
 */

import * as cssUtil from '../css_util.js';

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
