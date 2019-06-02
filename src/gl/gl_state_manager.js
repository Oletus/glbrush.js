/*
 * Copyright Olli Etuaho 2019.
 */

import { Vec2 } from '../math/vec2.js';

import { ShaderProgram } from './shader_program.js';

/**
 * A shader program cache for a specific WebGL context.
 * @param {WebGLRenderingContext} gl The WebGL context.
 * @return {function(Object)} ShaderProgram constructor wrapped in a caching closure, taking in a parameters object.
 */
var shaderProgramCache = function(gl) {
    var shaders = [];

    return function(programParameters) {
        var fragmentSource = programParameters.fragmentSource;
        var vertexSource = programParameters.vertexSource;
        // No need to use object for storing this few variables
        for (var i = 0; i < shaders.length; ++i) {
            if (shaders[i].fragmentSource === fragmentSource &&
                shaders[i].vertexSource === vertexSource) {
                return shaders[i];
            }
        }
        var shader = new ShaderProgram(gl, programParameters);
        shader.fragmentSource = fragmentSource;
        shader.vertexSource = vertexSource;
        shaders.push(shader);
        return shader;
    };
};

/**
 * Create a manager for WebGL context state, such as switching the framebuffer.
 * @param {WebGLRenderingContext} gl The WebGL context.
 * @return {Object} The manager object.
 */
var glStateManager = function(gl) {
    var sharedFbo = gl.createFramebuffer();
    var fboInUse = null;
    var sharedFboTex = null;

    var unitQuadVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, unitQuadVertexBuffer);
    var vertices = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    var useQuadVertexBufferInternal = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, unitQuadVertexBuffer);
        var positionAttribLocation = 0;
        gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    };

    var drawFullscreenQuadInternal = function(program, uniformValues) {
        program.use(uniformValues);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    var drawRectInternal = function(program, uniformValues, rect, fbWidth, fbHeight) {
        if (rect !== undefined) {
            uniformValues['uScale'] = [rect.width() / fbWidth, rect.height() / fbHeight];
            // Without any translation, the scaled rect would be centered in the gl viewport.
            // uTranslate = rect center point in gl coordinates.
            var rectCenter = new Vec2(rect.left + rect.width() * 0.5, rect.top + rect.height() * 0.5);
            rectCenter.x = (rectCenter.x / fbWidth) * 2 - 1;
            rectCenter.y = (1 - rectCenter.y / fbHeight) * 2 - 1;
            uniformValues['uTranslate'] = [rectCenter.x, rectCenter.y];
        }
        program.use(uniformValues);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    var useFboInternal = function(fbo) {
        if (fboInUse !== fbo) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            fboInUse = fbo;
        }
    };
    var useFboTexInternal = function(tex) {
        useFboInternal(sharedFbo);
        if (sharedFboTex !== tex) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            sharedFboTex = tex;
        }
    };

    return {
        shaderProgram: shaderProgramCache(gl),
        useQuadVertexBuffer: useQuadVertexBufferInternal,
        drawFullscreenQuad: drawFullscreenQuadInternal,
        drawRect: drawRectInternal,
        useFbo: useFboInternal,
        useFboTex: useFboTexInternal
    };
};

export { glStateManager };
