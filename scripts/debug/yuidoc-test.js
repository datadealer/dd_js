// For complete syntax reference see http://yui.github.com/yuidoc/syntax/index.html

/**
 * This is the description for my class.
 *
 * @class MyClass
 * @constructor
 */
var MyClass = function() {
  return this;
};

/**
 * My method description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 *
 * @method methodName
 * @param {String} foo Argument 1
 * @param {Object} config A config object
 * @param {String} config.name The name on the config object
 * @param {Function} config.callback A callback function on the config object
 * @param {Boolean} [extra=false] Do extra, optional work
 * @return {Boolean} Returns true on success
 */
MyClass.prototype.foo = function() {
  return;
};

/**
 * My property description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 * 
 * @property propertyName
 * @type {Object}
 * @default "foo"
 */
MyClass.prototype.bar = 123;