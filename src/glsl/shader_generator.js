/*
 * Copyright Olli Etuaho 2019.
 */

/**
 * A shader program generator. Inherited objects must generate 1 shader program
 * and implement uniforms(width, height), vertexSource(), and fragmentSource().
 * uniforms() must return an array of uniforms with name, type, shortType
 * (postfix to gl.uniform*), inVertex (whether it's used in vertex shader),
 * inFragment (whether it's used in fragment shader), defaultValue, arraySize
 * (how many items in the uniform array). fragmentSource() and vertexSource()
 * must return complete shader source strings.
 */
var ShaderGenerator = function() {
};

/**
 * Computes the types of uniforms used in the shader program.
 * @return {Object.<string, string>} Map from uniform name to uniform short type
 * to be used as postfix to gl.uniform* function call.
 */
ShaderGenerator.prototype.uniformTypes = function() {
    var us = this.uniforms();
    var result = {};
    for (var i = 0; i < us.length; ++i) {
        result[us[i].name] = us[i].shortType;
    }
    return result;
};

ShaderGenerator.prototype.attributeLocations = function() {
    return { 'aVertexPosition': 0 };
};

/**
 * @return {Object} Program parameters suitable for ShaderProgram constructor, or glStateManager.shaderProgram().
 */
ShaderGenerator.prototype.programParameters = function() {
    return {
        fragmentSource: this.fragmentSource(),
        vertexSource: this.vertexSource(),
        uniformTypes: this.uniformTypes(),
        attributeLocations: this.attributeLocations()
    };
};

/**
 * @param {number} width Width of the canvas in pixels. Used to determine the
 * initial values of uniforms.
 * @param {number} height Height of the canvas in pixels. Used to determine the
 * initial values of uniforms.
 * @return {Object.<string, *>} Map from uniform names to uniform values that
 * should be filled in and passed to the shader program to draw.
 */
ShaderGenerator.prototype.uniformParameters = function(width, height) {
    var us = this.uniforms(width, height);
    var parameters = {};
    for (var i = 0; i < us.length; ++i) {
        var u = us[i];
        if (u.shortType === '2fv' || u.shortType === '3fv' ||
            u.shortType === '4fv') {
            parameters[u.name] = new Float32Array(u.defaultValue);
        } else {
            parameters[u.name] = u.defaultValue;
        }
    }
    return parameters;
};

/**
 * @param {Object} uniform With following keys: type (GLSL type), name, and optional arraySize and comment.
 * @return {string} GLSL code for declaring the uniform.
 */
var getUniformDeclarationLine = function(uniform) {
    var line = 'uniform ' + uniform.type + ' ' + uniform.name;
    if (uniform.arraySize !== undefined) {
        line += '[' + uniform.arraySize + ']';
    }
    line += ';';
    if (uniform.comment !== undefined) {
        line += ' // ' + uniform.comment;
    }
    return line;
};

/**
 * Computes the uniform definition code for the fragment shader.
 * @return {Array<string>} Shader source code lines.
 */
ShaderGenerator.prototype.fragmentUniformSource = function() {
    var uniforms = this.uniforms();
    var src = [];
    for (var i = 0; i < uniforms.length; ++i) {
        if (uniforms[i].inFragment) {
            src.push(getUniformDeclarationLine(uniforms[i]));
        }
    }
    return src;
};

/**
 * Computes the uniform definition code for the vertex shader.
 * @return {Array<string>} Shader source code lines.
 */
ShaderGenerator.prototype.vertexUniformSource = function() {
    var uniforms = this.uniforms();
    var src = [];
    for (var i = 0; i < uniforms.length; ++i) {
        if (uniforms[i].inVertex) {
            src.push(getUniformDeclarationLine(uniforms[i]));
        }
    }
    return src;
};

ShaderGenerator.commonGLSLHelpers = `
// Packs a normalized float in the 0.0 to 1.0 range to the red and green channels.
vec4 packNormFloatToRG(float value) {
  int bytes = int(value * 255.0 * 256.0);
  int highByte = bytes / 256;
  int lowByte = bytes - highByte * 256;
  return vec4(float(highByte) / 255.0, float(lowByte) / 255.0, 0.0, 1.0);
}`;

export { ShaderGenerator };
