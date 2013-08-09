/*
 * Copyright Olli Etuaho 2013.
 */

/**
 * Generate shaders for compositing a linear stack of layers.
 */
var compositingShader = {};

/**
 * @param {Array.<Object>} layers The array of layers to composit. May contain
 * objects specifying PictureBuffers and objects specifying PictureEvent plus
 * BaseRasterizer combos which are blended to the previous PictureBuffer.
 * @return {string} The fragment shader source for compositing the given layer
 * stack.
 */
compositingShader.getFragmentSource = function(layers) {
    var src = ['precision highp float;'];
    var i;
    var lastVisible = false;
    for (i = 0; i < layers.length; ++i) {
        if (layers[i].type === CanvasCompositor.Element.buffer) {
            lastVisible = layers[i].buffer.visible;
            if (lastVisible) {
                src.push('uniform sampler2D uLayer' + i + ';');
            }
        } else if (lastVisible) {
            src.push('uniform sampler2D uLayer' + i + ';');
            src.push('uniform vec4 uColor' + i + ';');
        }
    }
    src.push('varying vec2 vTexCoord;');
    src.push('void main(void) {');
    src.push('  // already premultiplied:');
    src.push('  vec4 color = vec4(0, 0, 0, 0);');
    var blendingSource = function(dstColor, srcColor) {
        src.push('  ' + dstColor + ' = ' + srcColor +
                 ' + ' + dstColor + ' * (1.0 - ' + srcColor + '.w);');
    };
    i = 0;
    while (i < layers.length) {
        // TODO: assert(layers[i].type === CanvasCompositor.Element.buffer);
        if (layers[i].buffer.visible) {
            var bufferColor = 'layer' + i + 'Color';
            src.push('  vec4 ' + bufferColor +
                    ' = texture2D(uLayer' + i + ', vTexCoord);');
            ++i;
            while (i < layers.length &&
                   layers[i].type === CanvasCompositor.Element.event) {
                if (layers[i].rasterizer.format === GLRasterizerFormat.alpha) {
                    src.push('  float layer' + i + 'Alpha' +
                        ' = texture2D(uLayer' + i + ', vTexCoord).w;');
                } else {
                    src.push('  vec4 layer' + i +
                        ' = texture2D(uLayer' + i + ', vTexCoord);');
                    src.push('  float layer' + i + 'Alpha = ' +
                             'layer' + i + '.x + ' +
                             'layer' + i + '.y / 256.0;');
                }
                src.push('  vec4 layer' + i + 'Color = layer' + i + 'Alpha *' +
                         ' uColor' + i + ';');
                if (layers[i].mode === BrushEvent.Mode.normal) {
                    blendingSource(bufferColor, 'layer' + i + 'Color');
                } else if (layers[i].mode === BrushEvent.Mode.eraser) {
                    src.push('  ' + bufferColor + ' = ' + bufferColor +
                             ' * (1.0 - layer' + i + 'Color.w);');
                } else {
                    console.log('Unexpected mode in shader generation ' +
                                layers[i].mode);
                }
                ++i;
            }
            blendingSource('color', bufferColor);
        } else {
            ++i;
            // Skip events attached to invisible layer
            while (i < layers.length &&
                   layers[i].type === CanvasCompositor.Element.event) {
                ++i;
            }
        }
    }
    src.push('  gl_FragColor = color;');
    src.push('}');
    return src.join('\n');
};


/**
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {Array.<Object>} layers The array of layers to composit. May contain
 * objects specifying PictureBuffers and objects specifying PictureEvent plus
 * BaseRasterizer combos which are blended to the previous PictureBuffer.
 * @return {ShaderProgram} The shader program for compositing the given layer
 * stack. Contains uniforms uLayer<n> for visible layers where <n> is the layer
 * index starting from zero for setting samplers for the layers. 'uColor<n>'
 * vec4 uniforms are used for event layers to pass event color and opacity data,
 * with values ranging from 0 to 1.
 */
compositingShader.getShaderProgram = function(glManager, layers) {
    var fragSource = compositingShader.getFragmentSource(layers);
    var uniformTypes = {};
    var lastVisible = false;
    for (var i = 0; i < layers.length; ++i) {
        if (layers[i].type === CanvasCompositor.Element.buffer) {
            lastVisible = layers[i].buffer.visible;
            if (lastVisible) {
                uniformTypes['uLayer' + i] = 'tex2d';
            }
        } else if (lastVisible) {
            uniformTypes['uLayer' + i] = 'tex2d';
            uniformTypes['uColor' + i] = '4fv';
        }
    }
    return glManager.shaderProgram(fragSource, blitShader.blitVertSrc,
                                   uniformTypes);
};
