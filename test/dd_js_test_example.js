// FIXME: Unfortunately, JSHint does not support QUnit due to lack of popularity(!).
// https://github.com/jshint/jshint/issues/265
// This was taken from http://there4development.com/blog/2012/03/10/qunit-rules-for-jshint/
/*global QUnit:true, module:true, test:true, asyncTest:true, expect:true*/
/*global start:true, stop:true ok:true, equal:true, notEqual:true, deepEqual:true*/
/*global notDeepEqual:true, strictEqual:true, notStrictEqual:true, raises:true*/

define(function(require) {
  
  var setup = require('setup');
  
  test('Hello, World', function() {
    ok(window);
    ok(setup);
  });
});
