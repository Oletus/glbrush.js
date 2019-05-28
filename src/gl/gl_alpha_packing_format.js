/*
 * Copyright Olli Etuaho 2019.
 */

/**
 * 'redGreen' uses red and green channels of a UINT8 texture to store the high
 * and low bits of the alpha value. 'alpha' uses just the alpha channel, so that
 * normal built-in blends can be used.
 * @enum {number}
 */
var GLAlphaPackingFormat = {
    redGreen: 0,
    alpha: 1
};

export { GLAlphaPackingFormat };
