// FIXME: Unfortunately, JSHint does not support QUnit due to lack of popularity(!).
// https://github.com/jshint/jshint/issues/265
// This was taken from http://there4development.com/blog/2012/03/10/qunit-rules-for-jshint/
/*global QUnit:true, module:true, test:true, asyncTest:true, expect:true*/
/*global start:true, stop:true ok:true, equal:true, notEqual:true, deepEqual:true*/
/*global notDeepEqual:true, strictEqual:true, notStrictEqual:true, raises:true*/

define(function(require) {
  
  var setup = require('setup');
  var Game = require('Game');
  var Render = require('Render');
  var Remote = require('Remote');

  // Helper methods and settings

  function setupJsonRpc() {
    $.jsonRPC.setup({
      endPoint: setup.jsonRpcUrl,
      namespace: ''
    });
  }

  function getCsrfToken(data) {
    var html = $.parseHTML(data);
    return $(html).find('input[name=csrfmiddlewaretoken]').val();
  }

  module('Code');

  test('Underscore Mix-ins', function() {
    var _ = require('underscore');
    equal(_.toTime(0), '00:00', 'Zero milliseconds are formatted correctly.');
    equal(_.toTime(1000), '00:01', '1000 ms (ie. one second) are formatted correctly.');
    equal(_.toTime(10000), '00:10', '10000 ms (ie. 10 seconds) are formatted correctly.');
    equal(_.toTime(60000), '01:00', '60000 ms (ie. 1 minute) are formatted correctly.');
    equal(_.toTime(600000), '10:00', '60000 ms (ie. 10 minutes) are formatted correctly.');
  });

  test('Game Engine', function() {
    ok(Game, 'The global variable Game is defined.');
    ok(Game.get, 'Game.get is defined.');
    equal(Game.get.constructor, Function, 'Game.get is a method.');
  });

  module('User Interaction Example');

  test('Click on a checkbox', 1, function() {
    var event = $.Event('click');
    var checkbox = $('#checkbox').trigger(event);
    equal(checkbox.prop('checked'), true, 'Checkbox is checked.');
  });

  module('JSON-RPC');

  asyncTest('Low-level ping the JSON-RPC server', 1, function() {
    setupJsonRpc();
    $.jsonRPC.request('ping', {
      success: function(data) {
        equal(data.result, 'pong', 'Server responded successfully.');
        start();
      },
      error: function() {
        start();
      }
    });  
  });

  asyncTest('Batch request of two methods', 1, function() {
    setupJsonRpc();
    $.jsonRPC.batchRequest([{
      method: 'ping'
    }, {
      method: 'getToken'
    }], {
      success: function(data) {
        equal(data.length, 2, 'Server returned two results in an array');
        start();
      },
      error: function() {
        start();
      }
    });
  });

  asyncTest('Ping the JSON-RPC server using Remote prototype', 1, function() {
    Remote.ping(function(data) {
      equal(data.result, 'pong', 'Server responded successfully.');
      start();
    }, function(data) {
      console.log(data);
      start();
    });
  });

  module('Authentication with dd_auth');

  asyncTest('Retrieve token when signed out', 4, function() {
    $.get(setup.signOutUrl, function(data, status, xhr) {
      equal(status, 'success', 'Server signed out user');
      Remote.getToken(function(data) {
        ok(data.error, 'Error property is defined');
        equal(data.result, null, 'Result is null');
        equal(data.error.code, -32403, 'Error code is -32403');
        start();
      });
    });
  });

  asyncTest('Sign up, out and in again as test user, then retrieve token', 7, function() {
    var userId = 'testplayer-' + Date.now();
    $.get(setup.signUpUrl, function(data) {
      $.post(setup.signUpUrl, {
        csrfmiddlewaretoken: getCsrfToken(data),
        username: userId,
        password1: userId,
        password2: userId,
        email: 'postmaster+' + userId + '@datadealer.net'
      }, function(data, status, xhr) {
        equal(status, 'success', 'Server signed up user');
        equal(xhr.status, 278, 'Status code is 278');
        $.get(setup.signOutUrl, function(data, status, xhr) {
          equal(status, 'success', 'Server signed out user');
          equal(xhr.status, 278, 'Status code is 278');
          $.get(setup.signInUrl, function(data) {
            $.post(setup.signInUrl, {
              csrfmiddlewaretoken: getCsrfToken(data),
              login: userId,
              password: userId
            }, function(data, status, xhr) {
              equal(status, 'success', 'Server signed in user');
              equal(xhr.status, 278, 'Status code is 278');
              Remote.getToken(function(data) {
                ok(data.result);
                start();              
              });
            });
          });
        });
      });
    });
  });

  return {
    start: function() {
      start();
    }
  }

});
