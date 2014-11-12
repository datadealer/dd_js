// A tiny wrapper for the SocketIO library, mostly doing some configuration stuff.
define(function(require) {
  
  var _ = require('underscore');
  var $ = require('jquery');
  var SockJS = require('sockjs');

  var setup = require('setup');
  
  var Socket = function(path, settings) {
    var self = this;
    
    // Reorder the arguments if no path is given.
    if (arguments.length < 2) {
      settings = path
      path = ''
    }
    
    // Merge setup with the settings argument.
    settings = _.extend({}, setup, settings);
    
    // Options are directly defined from the global setup but can be overridden by the `settings` argument.
    var options = {
      debug: settings.debug,
      devel: settings.wsDevMode,
      protocols_whitelist: settings.wsProtocolsWhitelist
    };

    // Connect to the resulting URL and retrieve a socket object.
    // Also expose the underlying socket object.
    var socket = this.__socket__ = new SockJS(settings.wsUrl + path, null, options);
    
    // The SockJS handlers to delegate messages to our own handlers.
    socket.onopen = function() {
      $(document).trigger('socketBeforeOpen');
      self.trigger('connect');
      $(document).trigger('socketAfterOpen');
    };

    socket.onmessage = function(event) {
      $(document).trigger('socketBeforeMessage', event);
      self.trigger(event.data.ev, event.data.pl);
      $(document).trigger('socketAfterMessage', event);
    };
    
    socket.onclose = function() {
      $(document).trigger('socketBeforeClose');
      self.trigger('disconnect');
      $(document).trigger('socketAfterClose');
    };
    
    // The registry of handlers.
    var handlers = this.__handlers__ = {};

    // The message queue is provided by the jQuery Message Queuing plug-in.
    if (settings.queue) {
      this.queue = $.jqmq(settings.queue);
    }

    // All handlers are defined with this one single method.
    this.on = function(eventName, handler, needsQueue) {
      if (!_.isFunction(handler)) {
        console.log('Insufficent arguments, handler is not a function.');
        return this;
      }
      // Wrap the handler call for queuing it if desired.
      if (needsQueue === Socket.NEEDS_QUEUE) {
        if (this.queue && _.isFunction(this.queue.add)) {
          handler = (function(eventName, handler) {
            return function() {
              // We store everything from context to the arguments of the current scope for later.
              self.queue.add({
                context: self, 
                handler: handler, 
                'arguments': arguments
              });
            }
          }(eventName, handler));
        } else {
          console.error('Cannot queue socket event, no queue defined.')
        }
      }
      // Store the tuned handler in the handler registry.
      handlers[eventName] = handler;
      return this;
    };
    
    // This method triggers a socket event.
    this.trigger = function(eventName, data) {
      var handler = handlers[eventName];
      if (_.isFunction(handler)) {
        handler.call(this, data);
      }
      return this;      
    };

    // Shallow wrapper for the SockJS.send() method.
    this.emit = function(eventName, data) {
      // Wrapping the arguments conforming to our own little structure.
      data = {
        ev: eventName,
        pl: data
      };
      // Now send the data as JSON to the server.
      socket.send(JSON.stringify(data));
      return this;
    };
    
    // This method disconnects and closes the wrapped socket instance.
    this.close = function() {
      socket.close();
      return this;
    };
    
    // Always disconnect the socket if the window is closed.
    $(window).bind('beforeunload', function() {
      this.close();
    });

    return this;
  };
  
  Socket.NEEDS_QUEUE = true;
  
  return Socket;
});
