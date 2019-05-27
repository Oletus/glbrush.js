/*
 * Copyright Olli Etuaho 2019.
 */

import { glUtils } from './utilgl.js';

/**
 * Uniform type and location information.
 * @constructor
 * @param {string} gltype Postfix to gl.uniform function name or 'tex2d' in case
 * of a texture.
 * @param {WebGLUniformLocation} location Location of the uniform.
 * @protected
 */
var Uniform = function(gltype, location) {
    this.gltype = gltype;
    this.location = location;
};

/**
 * An object representing a shader program, tied to the specific gl context. The
 * vertex shader must have an 'aVertexPosition' attribute.
 * @constructor
 * @param {WebGLRenderingContext} gl The WebGL context.
 * @param {Object} parameters Object with following properties:
 *   fragmentSource (string) Full GLSL source code for the fragment shader.
 *   vertexSource (string) Full GLSL source code for the vertex shader.
 *   uniformTypes (Object.<string, string>) Map from uniform names to uniform types. Uniform type is specified as a
 *     postfix to gl.uniform function name or 'tex2d' in case of a texture.
 */
var ShaderProgram = function(gl, parameters) {
    this.gl = gl;
    this.uniforms = {};

    var vertexShader = glUtils.compileShaderSource(this.gl,
                                                   this.gl.VERTEX_SHADER,
                                                   parameters.vertexSource);
    var fragmentShader = glUtils.compileShaderSource(this.gl,
                                                     this.gl.FRAGMENT_SHADER,
                                                     parameters.fragmentSource);

    this.shaderProgram = this.gl.createProgram();
    this.gl.attachShader(this.shaderProgram, vertexShader);
    this.gl.attachShader(this.shaderProgram, fragmentShader);
    this.gl.bindAttribLocation(this.shaderProgram, 0, 'aVertexPosition');
    this.gl.linkProgram(this.shaderProgram);

    if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
        console.log('Unable to initialize shader program from shaders:\nINFO:' +
                    '\n' + this.gl.getProgramInfoLog(this.shaderProgram) +
                    '\nVERTEX:\n' + parameters.vertexSource +
                    '\nFRAGMENT:\n' + parameters.fragmentSource);
    }
    for (var key in parameters.uniformTypes) {
        if (parameters.uniformTypes.hasOwnProperty(key)) {
            var gltype = parameters.uniformTypes[key];
            var location = this.gl.getUniformLocation(this.shaderProgram, key);
            if (location === null) {
                console.log('Could not locate uniform ' + key +
                            ' in compiled shader');
                console.log(parameters.fragmentSource + '\n\n' + parameters.vertexSource);
            }
            this.uniforms[key] = new Uniform(gltype, location);
        }
    }

    var vertexPositionAttribLoc = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
    if (vertexPositionAttribLoc !== 0) {
        console.log('Vertex position attribute location unexpected, ' + vertexPositionAttribLoc);
    }
};

/**
 * @return {Object.<string,*>} Map from uniform names to uniform values that
 * should be filled in and passed to the shader program to draw.
 */
ShaderProgram.prototype.uniformParameters = function() {
    var uniformParams = {};
    for (var key in this.uniforms) {
        if (this.uniforms.hasOwnProperty(key)) {
            uniformParams[key] = null;
        }
    }
    return uniformParams;
};

/**
 * Set the ShaderProgram as active and set uniform values to use with it.
 * @param {Object.<string,*>} uniformValues Map from uniform names to uniform values.
 * Single uniforms must not be passed in an array, vector uniforms must be
 * passed in an array. Texture uniforms must be passed as WebGLTexture.
 */
ShaderProgram.prototype.use = function(uniformValues) {
    this.gl.useProgram(this.shaderProgram);
    var texU = 0;
    for (var key in uniformValues) {
        if (this.uniforms.hasOwnProperty(key)) {
            var gltype = this.uniforms[key].gltype;
            var location = this.uniforms[key].location;
            if (gltype === 'tex2d') {
                if (texU < glUtils.maxTextureUnits) {
                    this.gl.activeTexture(glUtils.textureUnits[texU]);
                } else {
                    console.log('Too many textures in ShaderProgram.use');
                    return;
                }
                this.gl.bindTexture(this.gl.TEXTURE_2D, uniformValues[key]);
                this.gl.uniform1i(location, texU);
                ++texU;
            } else if (gltype === '1i') {
                this.gl.uniform1i(location, uniformValues[key]);
            } else if (gltype === '2iv') {
                this.gl.uniform2iv(location, uniformValues[key]);
            } else if (gltype === '3iv') {
                this.gl.uniform3iv(location, uniformValues[key]);
            } else if (gltype === '4iv') {
                this.gl.uniform4iv(location, uniformValues[key]);
            } else if (gltype === '1f') {
                this.gl.uniform1f(location, uniformValues[key]);
            } else if (gltype === '2fv') {
                this.gl.uniform2fv(location, uniformValues[key]);
            } else if (gltype === '3fv') {
                this.gl.uniform3fv(location, uniformValues[key]);
            } else if (gltype === '4fv') {
                this.gl.uniform4fv(location, uniformValues[key]);
            } else if (gltype === 'Matrix2fv') {
                this.gl.uniformMatrix2fv(location, false, uniformValues[key]);
            } else if (gltype === 'Matrix3fv') {
                this.gl.uniformMatrix3fv(location, false, uniformValues[key]);
            } else if (gltype === 'Matrix4fv') {
                this.gl.uniformMatrix4fv(location, false, uniformValues[key]);
            } else {
                console.log('Unrecognized uniform type in ShaderProgram.use: ' +
                            gltype);
            }
        } else if (uniformValues.hasOwnProperty(key)) {
            console.log('Invalid uniform name in ShaderProgram.use: ' + key +
                        ' ' + uniformValues[key]);
        }
    }
    return;
};

export { ShaderProgram };
