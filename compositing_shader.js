/*
 * Copyright Olli Etuaho 2013.
 */

/**
 * Generate shaders for compositing a linear stack of layers.
 */
var compositingShader = {};

/**
 * @param {Array.<Object>} layers The array of layers to composit. May contain
 * objects specifying PictureBuffers and objects specifying BaseRasterizers
 * which are blended to the previous PictureBuffer.
 * @return {string} The fragment shader source for compositing the given layer
 * stack.
 */
compositingShader.getFragmentSource = function(layers) {
    var src = ['precision highp float;'];
    var i;
    for (i = 0; i < layers.length; ++i) {
        if (layers[i].type === CanvasCompositor.Element.buffer) {
            // TODO: assert(layers[i].buffer.visible);
            src.push('uniform sampler2D uLayer' + i + ';');
            src.push('uniform float uOpacity' + i + ';');
        } else {
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
    // Add rasterizer layer blending operation to src. The given blending
    // equation eq must use unpremultiplied vec3 srcColor, unpremultiplied vec3
    // dstColor and srcAlpha to produce a vec3 value.
    var blendEq = function(eq) {
        src.push('  float blendedAlpha' + i + ' = layer' + i + 'Color.w + ' +
                 bufferColor + '.w * (1.0 - layer' + i + 'Color.w);');
        // Unpremultiplied colors:
        eq = eq.replace(/srcColor/g, 'uColor' + i + '.xyz');
        eq = eq.replace(/dstColor/g, '(' + bufferColor + '.xyz / ' +
                        bufferColor + '.w)');
        eq = eq.replace(/srcAlpha/g, 'layer' + i + 'Color.w');
        src.push('  ' + bufferColor + ' = vec4((' + eq +
            ') * blendedAlpha' + i + ', blendedAlpha' + i + ');');
    };
    i = 0;
    while (i < layers.length) {
        // TODO: assert(layers[i].type === CanvasCompositor.Element.buffer);
        // TODO: assert(layers[i].buffer.visible);
        var bufferColor = 'layer' + i + 'Color';
        var bufferOpacity = 'uOpacity' + i;
        src.push('  vec4 ' + bufferColor +
                ' = texture2D(uLayer' + i + ', vTexCoord);');
        ++i;
        while (i < layers.length &&
               layers[i].type === CanvasCompositor.Element.rasterizer) {
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
            } else if (layers[i].mode === BrushEvent.Mode.erase) {
                src.push('  ' + bufferColor + ' = ' + bufferColor +
                         ' * (1.0 - layer' + i + 'Color.w);');
            } else {
                if (layers[i].mode === BrushEvent.Mode.multiply) {
                    blendEq('dstColor * (1.0 + srcAlpha * (srcColor - 1.0))');
                } else if (layers[i].mode === BrushEvent.Mode.screen) {
                    blendEq('srcAlpha * ' +
                            '(1.0 - (1.0 - srcColor) * (1.0 - dstColor)) + ' +
                            '(1.0 - srcAlpha) * dstColor');
                } else {
                    console.log('Unexpected mode in shader generation ' +
                                layers[i].mode);
                }
            }
            ++i;
        }
        src.push('  ' + bufferColor + ' *= ' + bufferOpacity + ';');
        blendingSource('color', bufferColor);
    }
    src.push('  gl_FragColor = color;');
    src.push('}');
    return src.join('\n');
};


/**
 * @param {Object} glManager The state manager returned by glStateManager() in
 * utilgl.
 * @param {Array.<Object>} layers The array of layers to composit. May contain
 * objects specifying PictureBuffers and objects specifying BaseRasterizers
 * which are blended to the previous PictureBuffer.
 * @return {ShaderProgram} The shader program for compositing the given layer
 * stack. Contains uniforms uLayer<n> for visible layers where <n> is the layer
 * index starting from zero for setting samplers for the layers. 'uColor<n>'
 * vec4 uniforms are used for rasterizer layers to pass color and opacity data,
 * with values ranging from 0 to 1. 'uOpacity<n>' float uniforms are used for
 * buffer layers to pass opacity, with values ranging from 0 to 1.
 */
compositingShader.getShaderProgram = function(glManager, layers) {
    var fragSource = compositingShader.getFragmentSource(layers);
    var uniformTypes = {};
    for (var i = 0; i < layers.length; ++i) {
        if (layers[i].type === CanvasCompositor.Element.buffer) {
            // TODO: assert(layers[i].buffer.visible);
            uniformTypes['uLayer' + i] = 'tex2d';
            uniformTypes['uOpacity' + i] = '1f';
        } else {
            uniformTypes['uLayer' + i] = 'tex2d';
            uniformTypes['uColor' + i] = '4fv';
        }
    }
    return glManager.shaderProgram(fragSource, blitShader.blitVertSrc,
                                   uniformTypes);
};
