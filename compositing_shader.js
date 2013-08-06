/*
 * Copyright Olli Etuaho 2013.
 */

/**
 * Generate shaders for compositing a linear stack of layers.
 */
var compositingShader = {};

/**
 * @param {Array.<PictureBuffer>} buffers The array of buffers to composit.
 * @param {number} currentEventAttachment The index of the buffer which should
 * get the current event applied to it.
 * @param {BrushEvent.Mode} currentEventMode Mode to use when applying the
 * current event.
 * @param {GLRasterizerFormat} currentEventFormat Format of the current event.
 * @return {string} The fragment shader source for compositing the given layer
 * stack.
 */
compositingShader.getFragmentSource = function(buffers,
                                               currentEventAttachment,
                                               currentEventMode,
                                               currentEventFormat) {
    var src = ['precision highp float;'];
    var i;
    for (i = 0; i < buffers.length; ++i) {
        src.push('uniform sampler2D uLayer' + i + ';');
        if (i === currentEventAttachment) {
            src.push('uniform sampler2D uCurrentEvent;');
            src.push('uniform vec4 uCurrentColor;');
        }
    }
    src.push('varying vec2 vTexCoord;');
    src.push('void main(void) {');
    src.push('  // already premultiplied:');
    src.push('  vec4 color = vec4(0, 0, 0, 0);');
    var blendingSource = function(color2) {
        src.push('  color = ' + color2 +
                 ' + color * (1.0 - ' + color2 + '.w);');
    };
    for (i = 0; i < buffers.length; ++i) {
        if (buffers[i].visible) {
            src.push('  vec4 layer' + i + 'Color' +
                    ' = texture2D(uLayer' + i + ', vTexCoord);');
            if (i === currentEventAttachment) {
                if (currentEventFormat === GLRasterizerFormat.alpha) {
                    src.push('  float currentEventAlpha = ' +
                             'texture2D(uCurrentEvent, vTexCoord).w;');
                } else {
                    src.push('  vec4 currentEvent = ' +
                         'texture2D(uCurrentEvent, vTexCoord);');
                    src.push('  float currentEventAlpha = currentEvent.x + ' +
                             'currentEvent.y / 256.0;');
                }
                src.push('  vec4 currentColor = currentEventAlpha *' +
                         ' uCurrentColor;');
                if (currentEventMode === BrushEvent.Mode.normal) {
                    src.push('  vec4 colorWithCurrent = currentColor + ' +
                             'layer' + i + 'Color * (1.0 - currentColor.w);');
                } else if (currentEventMode === BrushEvent.Mode.eraser) {
                    src.push('  vec4 colorWithCurrent = layer' + i + 'Color' +
                             ' * (1.0 - currentColor.w);');
                } else {
                    console.log('Unexpected currentEventMode ' +
                                currentEventMode);
                }
                blendingSource('colorWithCurrent');
            } else {
                blendingSource('layer' + i + 'Color');
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
 * @param {Array.<PictureBuffer>} buffers The array of buffers to composit.
 * @param {number} currentEventAttachment The index of the buffer which should
 * get the current event applied to it before compositing.
 * @param {BrushEvent.Mode} currentEventMode Mode to use when applying the
 * current event.
 * @param {GLRasterizerFormat} currentEventFormat Format of the current event.
 * @return {ShaderProgram} The shader program for compositing the given layer
 * stack. Contains uniform uCurrentEvent for setting the sampler for the current
 * event rasterizer and uniforms uLayer<n> where <n> is the layer index starting
 * from zero for setting samplers for the layers. 'uCurrentColor' vec4 uniform
 * is used to pass current event color and opacity data, with values ranging
 * from 0 to 1.
 */
compositingShader.getShaderProgram = function(glManager, buffers,
                                              currentEventAttachment,
                                              currentEventMode,
                                              currentEventFormat) {
    var fragSource = compositingShader.getFragmentSource(buffers,
               currentEventAttachment, currentEventMode, currentEventFormat);
    var uniformTypes = {};

    for (var i = 0; i < buffers.length; ++i) {
        if (buffers[i].visible) {
            uniformTypes['uLayer' + i] = 'tex2d';
            if (currentEventAttachment === i) {
                uniformTypes['uCurrentEvent'] = 'tex2d';
                uniformTypes['uCurrentColor'] = '4fv';
            }
        }
    }
    return glManager.shaderProgram(fragSource, blitShader.blitVertSrc,
                                   uniformTypes);
};
