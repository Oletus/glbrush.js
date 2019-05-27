/*
 * Copyright Olli Etuaho 2019.
 */

/**
 * Convert object with serialize(json) support to a string.
 * @param {Object} obj
 * @return {string} String JSON representation of the object.
 */
var serializeToString = function(obj) {
    var json = {};
    obj.serialize(json);
    return JSON.stringify(json);
};

export { serializeToString };
