/*
 * Copyright Olli Etuaho 2019.
 */

import { Vec2 } from '../src/math/vec2.js';

import { AffineTransform } from '../src/math/affine_transform.js';

import { Rect } from '../src/math/rect.js';

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
