// Wrapper for back-end calls using the $.jsonRPC plugin.

// The object is defined as RequireJS module, using the classy CommonJS-like style.
define(function(require) {

  // The local variable Remote is going to contain the resulting return value.
  var Remote = function(options) {
    var _ = require('underscore');
    var $ = require('jquery');

    require('jquery-jsonrpc');
    require('jquery-message-queuing');

    var setup = require('setup');
    var util = require('util');

    var remote = this;
    options = options || {};

    if (options.queue) {
      remote.queue = $.jqmq(options.queue);
    }
  
    remote.addMethod = function(name, endPoint, needsQueue) {
      if (!_.isString(endPoint)) {
        endPoint = options.endPoint;
      }
      if (!name || !endPoint) {
        console.error('Insufficient arguments.');
        return remote;
      }
      if (name in Remote.RESERVED_METHODNAMES) {
        console.error('Cannot add remote method, method name ‘%s’ is reserved for internal use.', name);
        return remote;
      }
      // Define handler function.
      var handler = function(name) {
        return function() {
          return request(name, endPoint, needsQueue, arguments);
        }
      }
      remote[name] = (function(name) {
        return handler(name);
      }(name));
      return remote;
    };

    // The setup for the JSON-RPC plugin is straighforward. The endpoint is defined in setup.js. As we are using the `$.jsonRPC.withOptions` method this is done for every request at a later time, and we do not need a global setup right now.
    /*
    $.jsonRPC.setup({
      endPoint: setup.jsonRpcUrl,
      namespace: ''
    });
    */
  
    // The core method needs at least the method name and the RPC endpoint. Optionally, the method call can be queued by setting the value of the `needsQueue` argument to `Remote.NEEDS_QUEUE`. Queuing calls decreases the risk of race conditions at the back-end as there is never more than one remote call sent from each client simultaneously. Further arbitrary parameters can be provided as array in a third argument. As we will see below, the latter is very useful for function wrappers or using the `apply` and `call` methods of the Function prototype.
    function request(method, endPoint, needsQueue, args) {
      // Fail silently if no method is given.
      if (!method) {
        return;
      }
      // We support `jQuery.Deferred`.
      var deferred = new $.Deferred();

      var handler = (function(method, endPoint, args, deferred) {
        return function() {
          // Initialising some local variables.
          var param = [];
          var arg;
          // We loop indefinitely, thus we need to break somewhere inside the loop body.
          while (true) {
            // Shift (ie. pop the first item of) the `args` array by calling the prototype methods of Array. This keeps us safe if `args` is in fact an `arguments` array which does not inherit the Array methods, unfortunatley.
            arg = Array.prototype.shift.call(args, 0);
            // _Caveat:_ It is assumed that a parameter is never a function! Thus, every item in the 
            // args array is viewed as JSON-RPC parameter until we hit the first function.
            if (typeof arg === 'undefined' || (arg !== null && arg.constructor === Function)) {
              // Here comes the break from the loop!
              break;
            }
            // At this point we can safely add the argument as option.
            param.push(arg);
          }
          // arg is now either a function or nullsy. Anyway, let’s use it for the success callback handler.
          var onSuccess = arg;
          // Same with the remaining item in the args array. This is used for the error callback handler.
          var onError = args[0];
          // Calling the `$.jsonRPC.withOptions` method with our endPoint and options.
          $.jsonRPC.withOptions({
            endPoint: endPoint,
            namespace: ''
          }, function() {
            var jsonrpc = this;
            jsonrpc.request(method, {
              params: param,
              // The JSON-RPC success handler.
              success: function() {
                var args = arguments;
                // Apply the onSuccess callback if it is given as argument.
                if (_.isFunction(onSuccess)) {
                  onSuccess.apply(jsonrpc, arguments);
                }
                // Apply a delay to simulate network latency when defined and in debug mode.
                if (setup.debug && setup.latency) {
                  return util.wait(setup.latency).then(function() {
                    return deferred.resolve.apply(jsonrpc, args);
                  });
                }
                // Finally apply the $.Deferred.resolve() method.
                return deferred.resolve.apply(jsonrpc, args);
              }, 
              // The JSON-RPC error handler.
              error: function() {
                // Apply the onError callback if it is given as argument.
                if (_.isFunction(onError)) {
                  onError.apply(jsonrpc, arguments);
                }
                // Finally apply the $.Deferred.reject() method.
                return deferred.reject.apply(jsonrpc, arguments);
              }
            });
          });
          // The promise is returned from the handler, too.
          return deferred.promise();
        }
      }(method, endPoint, args, deferred));

      // Add the method call to the queue if desired.
      if (needsQueue === Remote.NEEDS_QUEUE) {
        // Do a last check whether we have a functional queue.
        if (remote.queue && _.isFunction(remote.queue.add)) {
          needsQueue = false; // We only want to be queued once!
          remote.queue.add({
            context: remote, 
            handler: handler, 
            'arguments': arguments        
          });
        } else {
          console.error('Cannot queue remote method call, no queue defined.')
        }
      } else {
        return handler();
      }

      // Return the promise of the $.Deferred object for chaining.
      return deferred.promise();
    }
  
    return this;
  };
  
  // Use this constant for the `needsQueue` argument.
  Remote.NEEDS_QUEUE = true;
  
  Remote.RESERVED_METHODNAMES = {addMethod: true, queue: true};
  
  return Remote;
  
});
