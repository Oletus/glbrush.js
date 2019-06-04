/*
 * Copyright Olli Etuaho 2019.
 */


'use strict';

import { Rect } from '../src/math/rect.js';

import { Vec2 } from '../src/math/vec2.js';

import {
    PictureRenderer
} from '../src/picture_renderer.js';

import { CanvasBitmap } from '../src/picture_buffer/canvas_bitmap.js';

import { GLBitmap } from '../src/picture_buffer/gl_bitmap.js';

var testBitmapGeneric = function(renderer) {
    it('is created with metadata', function() {
        var width = 123;
        var height = 45;
        var hasAlpha = false;
        var metadata = {testMeta: true};
        var bitmap = renderer.createBitmap(width, height, hasAlpha, metadata);
        expect(bitmap).not.toBe(null);
        expect(bitmap.metadata.testMeta).toBe(true);
        expect(bitmap.width).toBe(123);
        expect(bitmap.height).toBe(45);
        expect(bitmap.hasAlpha).toBe(false);
    });

    it('clears without alpha', function() {
        var width = 12;
        var height = 34;
        var hasAlpha = false;
        var bitmap = renderer.createBitmap(width, height, hasAlpha, {});
        expect(bitmap).not.toBe(null);
        var clipRect = new Rect(0, width, 0, height);
        var clearColor = [12, 34, 56, 128];
        bitmap.clear(clipRect, clearColor);
        var coords = new Vec2(0, 0);
        var clearedPixel = bitmap.getPixelRGBA(coords);
        expect(clearedPixel[0]).toBe(12);
        expect(clearedPixel[1]).toBe(34);
        expect(clearedPixel[2]).toBe(56);
        expect(clearedPixel[3]).toBe(255);
    });

    it('clears with alpha', function() {
        var width = 12;
        var height = 34;
        var hasAlpha = true;
        var bitmap = renderer.createBitmap(width, height, hasAlpha, {});
        expect(bitmap).not.toBe(null);
        var clipRect = new Rect(0, width, 0, height);
        var clearColor = [12, 34, 56, 128];
        bitmap.clear(clipRect, clearColor);
        var coords = new Vec2(0, 0);
        var clearedPixel = bitmap.getPixelRGBA(coords);
        // Premultiplication may cause color values to be slightly inaccurate.
        expect(clearedPixel[0]).toBeNear(12, 2);
        expect(clearedPixel[1]).toBeNear(34, 2);
        expect(clearedPixel[2]).toBeNear(56, 2);
        expect(clearedPixel[3]).toBe(128);
    });
};

describe('CanvasBitmap', function() {
    var renderer = new PictureRenderer('canvas', null);
    testBitmapGeneric(renderer);
});

describe('GLBitmap', function() {
    var renderer = new PictureRenderer('webgl', null);
    testBitmapGeneric(renderer);
});
