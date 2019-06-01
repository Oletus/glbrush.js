/*
 * Copyright Olli Etuaho 2019.
 */

/**
 * Type of composited element.
 * @enum {number}
 */
var CompositorElement = {

    // Full color buffer with an alpha channel.
    buffer: 0,

    // Only alpha channel, that may be packed to different color channels on GL.
    // Accompanied by information on how to blend the rasterizer to a full color buffer.
    rasterizer: 1

};

export { CompositorElement };
