/*
 * Copyright Olli Etuaho 2012-2013.
 */


var glUtils = {
    createTexture: null,
    getShader: null,
    initGl: null,
    supportsTextureUnits: null,
    updateClip: null,
    glSupported: true, // these values will be updated later
    availableExtensions: [],
    floatFboSupported: true,
    maxVaryingVectors: 8, // minimum mandated by the spec
    maxUniformVectors: 16, // minimum mandated by the spec for the fragment shader
    maxTextureUnits: 32,
    maxFramebufferSize: 4096,
    textureUnits: null
};

/**
 * Create a texture and initialize it to use gl.NEAREST filtering and
 * gl.CLAMP_TO_EDGE clamping.
 * @param {WebGLRenderingContext} gl The WebGL context.
 * @param {number} width Width of the texture. Must be an integer.
 * @param {number} height Height of the texture. Must be an integer.
 * @param {GLenum=} format Texture format. Defaults to gl.RGBA.
 * @param {GLenum=} type Texture type. Defaults to gl.UNSIGNED_BYTE.
 * @return {WebGLTexture} The created texture.
 */
glUtils.createTexture = function(gl, width, height, format, type) {
    if (format === undefined) {
        format = gl.RGBA;
    }
    if (type === undefined) {
        type = gl.UNSIGNED_BYTE;
    }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type,
                  null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
};

/**
 * Get shader source from a DOM element.
 * @param {string} id DOM id of the element that contains the shader source.
 * @return {string} The shader source.
 */
glUtils.getShaderSource = function(id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        console.log('Shader script not found ' + id);
        return null;
    }
    var shaderSource = '';
    var currentChild = shaderScript.firstChild;
    while (currentChild) {
        if (currentChild.nodeType == currentChild.TEXT_NODE) {
            shaderSource += currentChild.textContent;
        }
        currentChild = currentChild.nextSibling;
    }
    return shaderSource;
};

/**
 * Compile a shader from source.
 * @param {WebGLRenderingContext} gl The WebGL context.
 * @param {GLenum} type Type of the shader. Must be gl.FRAGMENT_SHADER or
 * gl.VERTEX_SHADER.
 * @param {string} shaderSource The shader source.
 * @return {WebGLShader} The created shader.
 */
glUtils.compileShaderSource = function(gl, type, shaderSource) {
    var shader = gl.createShader(type);

    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log('An error occurred compiling a shader:' +
                    gl.getShaderInfoLog(shader));
        console.log(shaderSource);
        return null;
    }

    return shader;
};

/**
 * Create a WebGL context on a canvas element.
 * @param {HTMLCanvasElement} canvas The canvas element.
 * @param {Object} contextAttribs The context attributes to pass to the created
 * context.
 * @param {number=} minTextureUnits The required amount of texture units. Must
 * be an integer. Defaults to 0.
 * @return {WebGLRenderingContext} The created context or null if unable to
 * create one filling the requirements.
 */
glUtils.initGl = function(canvas, contextAttribs, minTextureUnits) {
    if (minTextureUnits === undefined) {
        minTextureUnits = 0;
    }
    if (!glUtils.supportsTextureUnits(minTextureUnits)) {
        return null;
    }
    var gl = null;
    try {
        // Try to grab the standard context, or fallback to experimental.
        gl = canvas.getContext('webgl', contextAttribs) ||
             canvas.getContext('experimental-webgl', contextAttribs);
    } catch (e) {
        gl = null;
    }
    gl.enableVertexAttribArray(0);
    return gl;
};

/**
 * @param {number} unitCount The amount of texture units required. Must be an
 * integer.
 * @return {boolean} Is it possible to create a WebGL context with the given
 * amount of texture units.
 */
glUtils.supportsTextureUnits = function(unitCount) {
    return glUtils.glSupported === true && glUtils.maxTextureUnits >= unitCount;
};

/**
 * Update the scissor rectangle to a rectangle in the canvas2d coordinate
 * system.
 * @param {WebGLRenderingContext} gl The WebGL context.
 * @param {Rect} rect The rectangle to use as scissor. In canvas2d coordinate
 * system, as in y 0 is the top of the canvas.
 * @param {number} fbHeight The framebuffer height.
 */
glUtils.updateClip = function(gl, rect, fbHeight) {
    var br = rect.getXYWHRoundedOut();
    br.y = fbHeight - (br.y + br.h);
    gl.scissor(br.x, br.y, br.w, br.h);
};

// Perform a feature test.
(function() {
    var testCanvas = document.createElement('canvas');
    var gl = glUtils.initGl(testCanvas, {});
    if (!gl) {
        glUtils.glSupported = false;
        return;
    }
    glUtils.availableExtensions = gl.getSupportedExtensions();
    console.log(glUtils.availableExtensions);

    var extensionTextureFloat = gl.getExtension('OES_texture_float');
    if (!extensionTextureFloat) {
        glUtils.floatFboSupported = false;
    } else {
        // It's possible that float textures are supported but float FBOs are not.
        var testFbo = gl.createFramebuffer();
        var testTex = glUtils.createTexture(gl, 128, 128, gl.RGBA, gl.FLOAT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, testFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, testTex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            glUtils.floatFboSupported = false;
        }
    }

    glUtils.maxUniformVectors = Math.min(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
                                         gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS));
    console.log(glUtils.maxUniformVectors);
    glUtils.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    // Do a best effort at determining framebuffer size limits:
    var maxFramebufferSizes = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    glUtils.maxFramebufferSize = Math.min(maxFramebufferSizes[0],
                                          maxFramebufferSizes[1]);
    glUtils.maxFramebufferSize =
        Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),
                 glUtils.maxFramebufferSize);
    // Memory limits are an issue, so additionally limit to 4096 at least for
    // now...
    glUtils.maxFramebufferSize = Math.min(4096, glUtils.maxFramebufferSize);
    glUtils.textureUnits = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3,
                            gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7,
                            gl.TEXTURE8, gl.TEXTURE9, gl.TEXTURE10,
                            gl.TEXTURE11, gl.TEXTURE12, gl.TEXTURE13,
                            gl.TEXTURE14, gl.TEXTURE15, gl.TEXTURE16,
                            gl.TEXTURE17, gl.TEXTURE18, gl.TEXTURE19,
                            gl.TEXTURE20, gl.TEXTURE21, gl.TEXTURE22,
                            gl.TEXTURE23, gl.TEXTURE24, gl.TEXTURE25,
                            gl.TEXTURE26, gl.TEXTURE27, gl.TEXTURE28,
                            gl.TEXTURE29, gl.TEXTURE30, gl.TEXTURE31];
})();

export {
    glUtils
};
