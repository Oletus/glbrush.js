/*
 * Copyright Olli Etuaho 2019.
 */

import * as colorUtil from '../color_util.js';

import * as blendFunctions from '../blend_functions.js';

describe('color', function() {

    function toUint8Array(arr) {
        var buffer = new ArrayBuffer(arr.length);
        var uints = new Uint8Array(buffer);
        for (var i = 0; i < arr.length; ++i) {
            uints[i] = arr[i];
        }
        return uints;
    }

    var blendModeNames = [
        "multiply", "screen", "overlay", "hardLight", "softLight", "darken", "lighten", "difference",
        "exclusion", "colorBurn", "linearBurn", "vividLight", "linearLight", "pinLight", "colorDodge",
        "linearDodge"
    ];

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
    it('computes the alpha value that results to given alpha with n blends', function() {
        for (var flow = 0.01; flow < 0.99; flow += 0.01) {
            for (var n = 2; n < 10; ++n) {
                var alpha = colorUtil.alphaForNBlends(flow, n);
                expect(alpha).toBeLessThan(flow);
                expect(colorUtil.nBlends(alpha, n)).toBeNear(flow, 0.01);
            }
        }
    });
    it('approximates what would happen with less than 1 blends', function() {
        expect(colorUtil.nBlends(1.0, 0.5)).toBeNear(0.5, 0.001);
        expect(colorUtil.nBlends(0.5, 0.5)).toBeNear(0.25, 0.001);
    });
    it('computes the alpha value that results to given alpha with less than one blends', function() {
        // Make sure it does not get stuck when n < 1.0:
        var flow = 0.5;
        for (var n = 0.1; n < 0.9; n += 0.1) {
            var alpha = colorUtil.alphaForNBlends(flow, n);
            expect(alpha).toBeGreaterThan(flow);
            if (alpha < 1.0) {
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
    it('modulates blending behavior using source and target alpha values', function() {
        var targetColor = 78;
        var srcColor = 183;
        var expected;
        for (var i = 0; i < blendModeNames.length; ++i) {
            var blendFunction = blendFunctions[blendModeNames[i]];
            // Test that blending with both alpha values at 1 results in pure blend function result:
            expect(colorUtil.blendWithFunction(blendFunction, targetColor, srcColor, 1, 1)).toBeNear(
                blendFunction(targetColor, srcColor), 1);
            // Test that blending to a target with alpha 0 results in pure source color:
            expect(colorUtil.blendWithFunction(blendFunction, targetColor, srcColor, 0, 0.3)).toBe(srcColor);
            // Test that blending to a target with alpha 0.001 results in a color close to the source color
            expect(colorUtil.blendWithFunction(blendFunction, targetColor, srcColor, 0.001, 0.5)).toBeNear(
                srcColor, 2);
            // Test that blending to a target with alpha 0.4 results in blend function result mixed with source
            // color:
            expected = (blendFunction(targetColor, srcColor) * 0.4) + srcColor * 0.6;
            expect(colorUtil.blendWithFunction(blendFunction, targetColor, srcColor, 0.4, 1)).toBeNear(expected, 1);
            // Test that blending a source with alpha 0.4 results in blend function result mixed with target color:
            expected = (blendFunction(targetColor, srcColor) * 0.4) + targetColor * 0.6;
            expect(colorUtil.blendWithFunction(blendFunction, targetColor, srcColor, 1, 0.4)).toBeNear(expected, 1);
        }
    });
});
