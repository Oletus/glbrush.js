/*
 * Copyright Olli Etuaho 2019.
 */

var dummySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

/**
 * Draw an outlined stroke using the current path.
 * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
 * @param {number} alpha Alpha multiplier for the drawing.
 */
var dualStroke = function(ctx, alpha) {
    if (alpha === undefined) {
        alpha = 1.0;
    }
    ctx.globalAlpha = 0.5 * alpha;
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.globalAlpha = 1.0 * alpha;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
};

/**
 * Draw a light stroke using the current path.
 * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
 */
var lightStroke = function(ctx) {
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.globalAlpha = 1.0;
};

/**
 * NOTE: Didn't work on released browsers other than Firefox yet on 2014-01-24.
 * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
 * @return {SVGMatrix} The current transform of the canvas rendering context.
 */
var getCurrentTransform = function(ctx) {
    var t = null;
    if (ctx.mozCurrentTransform) {
        t = canvasUtil.dummySvg.createSVGMatrix();
        t.a = ctx.mozCurrentTransform[0];
        t.b = ctx.mozCurrentTransform[1];
        t.c = ctx.mozCurrentTransform[2];
        t.d = ctx.mozCurrentTransform[3];
        t.e = ctx.mozCurrentTransform[4];
        t.f = ctx.mozCurrentTransform[5];
    } else {
        t = ctx.currentTransform.scale(1);
    }
    return t;
};

/**
 * Set the canvas clip rectangle.
 * @param {CanvasRenderingContext2D} ctx Context to set the rectangle to.
 * @param {Rect} rect Rectangle to set as canvas clip rectangle.
 */
var clipRect = function(ctx, rect) {
    var xywh = rect.getXYWHRoundedOut();
    ctx.beginPath();
    ctx.rect(xywh.x, xywh.y, xywh.w, xywh.h);
    ctx.clip();
};

export {
    dummySvg,
    dualStroke,
    lightStroke,
    getCurrentTransform,
    clipRect
};
