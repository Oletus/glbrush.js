/*
 * Copyright Olli Etuaho 2013.
 */

/**
 * A monochrome mipmap for software access.
 * @constructor
 * @param {HTMLCanvasElement|HTMLImageElement|ImageData} imageSource Image containing the level 0 texture in its red
 * channel. Both dimensions of the image must be equal and powers of two.
 */
var SWMipmap = function(imageSource) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    ctx.drawImage(imageSource, 0, 0);
    var sourceData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    this.levels = [];
    this.levelWidths = [];
    var width = canvas.width;
    this.levels.push(new Float64Array(width * width));
    this.levelWidths.push(width);
    for (var i = 0; i < width * width; ++i) {
        this.levels[0][i] = sourceData.data[i * 4] / 255;
    }
    var level = 0;
    while (width > 1) {
        width = width >> 1;
        ++level;
        this.levels.push(new Float64Array(width * width));
        this.levelWidths.push(width);
        for (var x = 0; x < width; ++x) {
            for (var y = 0; y < width; ++y) {
                this.levels[level][x + y * width] = (this.levels[level - 1][x * 2 + y * 2 * width * 2] +
                                                     this.levels[level - 1][x * 2 + 1 + y * 2 * width * 2] +
                                                     this.levels[level - 1][x * 2 + (y * 2 + 1) * width * 2] +
                                                     this.levels[level - 1][x * 2 + 1 + (y * 2 + 1) * width * 2]) *
                                                    0.25;
            }
        }
    }
    // Optimization to avoid special case handling for the final level (more calculations on the final level, but will
    // improve the larger cases which are anyway slower).
    var finalLevel = this.levels[this.levels.length - 1][0];
    this.levels[this.levels.length - 1] = new Float64Array([finalLevel, finalLevel, finalLevel, finalLevel]);
};

/**
 * Perform linear interpolation on the mipmap row. Will be clamped to edges.
 * @param {number} s Horizontal texture coordinate in the range 0 to 1.
 * @param {number} rowInd Index of the first item on the mipmap row.
 * @param {number} lod Level of detail number. Level 0 corresponds to full sized texture, larger integers to smaller
 * mipmap levels. Must be an integer and a valid level.
 * @return {number} Sample value in the range 0 to 1.
 * @protected
 */
SWMipmap.prototype.sampleFromRow = function(s, rowInd, lod) {
    if (s <= 0.5 / this.levelWidths[lod]) {
        return this.levels[lod][rowInd];
    } else if (s >= 1.0 - 0.5 / this.levelWidths[lod]) {
        return this.levels[lod][this.levelWidths[lod] - 1 + rowInd];
    }
    var sInd = s * this.levelWidths[lod] - 0.5;
    var floorSInd = Math.floor(sInd);
    var weight = sInd - floorSInd;
    return this.levels[lod][floorSInd + rowInd] * (1.0 - weight) +
           this.levels[lod][floorSInd + 1 + rowInd] * weight;
};

/**
 * Perform bilinear interpolation on the mipmap level. Will be clamped to edges.
 * @param {number} s Horizontal texture coordinate in the range 0 to 1.
 * @param {number} t Vertical texture coordinate in the range 0 to 1.
 * @param {number} lod Level of detail number. Level 0 corresponds to full sized texture, larger integers to smaller
 * mipmap levels. Must be an integer and a valid level.
 * @return {number} Sample value in the range 0 to 1.
 */
SWMipmap.prototype.sampleFromLevel = function(s, t, lod) {
    // TODO: assert(lod >= 0 && lod < this.levels.length);
    if (t <= 0.5 / this.levelWidths[lod]) {
        return this.sampleFromRow(s, 0, lod);
    } else if (t >= 1.0 - 0.5 / this.levelWidths[lod]) {
        return this.sampleFromRow(s, (this.levelWidths[lod] - 1) * this.levelWidths[lod], lod);
    }
    var tInd = t * this.levelWidths[lod] - 0.5;
    var floorTInd = Math.floor(tInd);
    var tIndW = floorTInd * this.levelWidths[lod];
    var weight = tInd - floorTInd;
    return this.sampleFromRow(s, tIndW, lod) * (1.0 - weight) +
           this.sampleFromRow(s, tIndW + this.levelWidths[lod], lod) * weight;
};

/**
 * Perform trilinear interpolation on the mipmap. Will be clamped to edges.
 * @param {number} s Horizontal texture coordinate in the range 0 to 1.
 * @param {number} t Vertical texture coordinate in the range 0 to 1.
 * @param {number} lod Level of detail number. Level 0 corresponds to full sized texture, larger integers to smaller
 * mipmap levels.
 * @return {number} Sample value in the range 0 to 1.
 */
SWMipmap.prototype.sample = function(s, t, lod) {
    if (lod <= 0) {
        return this.sampleFromLevel(s, t, 0);
    } else if (lod >= this.levels.length - 1) {
        return this.sampleFromLevel(s, t, this.levels.length - 1);
    }
    var rounded = Math.round(lod);
    if (rounded === lod) {
        return this.sampleFromLevel(s, t, rounded);
    }
    var floorLevel = Math.floor(lod);
    var weight = lod - floorLevel;
    return this.sampleFromLevel(s, t, floorLevel) * (1.0 - weight) +
           this.sampleFromLevel(s, t, floorLevel + 1) * weight;
};

/**
 * A collection of brush tip textures to use in drawing.
 * @constructor
 */
var CanvasBrushTextures = function() {
    this.textures = [];
};

/**
 * @param {HTMLCanvasElement|HTMLImageElement|ImageData} imageSource Image containing the brush tip sample in its red
 * channel. Both dimensions of the image must be equal and powers of two.
 */
CanvasBrushTextures.prototype.addTexture = function(imageSource) {
    this.textures.push(new SWMipmap(imageSource));
};

/**
 * @param {number} textureIndex Index of the texture, corresponding to the order in which the textures were added.
 * @return {SWMipmap} The texture.
 */
CanvasBrushTextures.prototype.getTexture = function(textureIndex) {
    return this.textures[textureIndex];
};

/**
 * A collection of brush tip textures to use in drawing.
 * @constructor
 * @param {WebGLRenderingContext} gl The rendering context.
 * @param {Object} glManager The state manager returned by glStateManager() in utilgl.
 */
var GLBrushTextures = function(gl, glManager) {
    this.gl = gl;
    this.glManager = glManager;
    this.textures = [];
};

/**
 * @param {HTMLCanvasElement|HTMLImageElement|ImageData} imageSource Image containing the brush tip sample in its red
 * channel. Both dimensions of the image must be equal and powers of two.
 */
GLBrushTextures.prototype.addTexture = function(imageSource) {
    var tex = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageSource);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.textures.push(tex);
};

/**
 * @param {number} textureIndex Index of the texture, corresponding to the order in which the textures were added.
 * @return {WebGLTexture} The texture.
 */
GLBrushTextures.prototype.getTexture = function(textureIndex) {
    return this.textures[textureIndex];
};
