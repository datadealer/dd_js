define(function(require) {

  var RpcQueue = function(config) {

    var _ = require('underscore');
    var $ = require('jquery');

    var app = require('app').getApplication();
    var setup = require('setup');

    this.queue = {};
    if (!config) {
      config = {};
    }
    this.maxSize = config.maxSize || setup.updateQueueMaxSize;
    this.maxInterval = config.maxInterval || setup.updateQueueInterval;
    this.callback = (_.isFunction(config.callback)) ? config.callback : function(data) { };
    // this.methodname = config.method || 'setPerpCoordinates';
    // this.rpc = Remote[this.methodName];
    this.flushing = false;
    var obj = this;

    $(window).bind('beforeunload', function() {
      obj.doFlush();
    });

    var runner = function() {
      obj.checkFlush(/* defered= */true);
    };

    this.addCall = function(rpc, groupid, args) {
      var added = new Date();
      this.lastRun = this.lastRun || added;
      var key = groupid;
      var elem = {
        added: added,
        args: args
      };
      if (!this.queue[rpc]) {
        this.queue[rpc] = {};
      }
      this.queue[rpc][key] = elem;
      this.checkFlush();
      //setTimeout(obj.checkFlush, 500);
      return this;
    };

    this.checkFlush = function(defered) {
      var now = new Date();
      var qsize = _.reduce(this.queue, function(m, n) { return m + _.size(n); }, 0);
      //console.log('check', qsize, this.maxSize, this.lastRun);
      if (qsize>0) {
        if (qsize > this.maxSize || now-this.lastRun > this.maxInterval) {
          this.doFlush();
        } else if (!defered) {
            setTimeout(runner, this.maxInterval);
        }
      }
      return this;
    };

    this.doFlush = function(token) {
      // flush all calls
      var obj = this;
      if (!this.flushing) {
        this.flushing = true;
        // later, aggregate args to ONE request per method
        var qcopy = {};
        $.extend(/* deep= */true, qcopy, this.queue);
        this.queue = {};
        _.each(qcopy, function(calls, methodname) {
          var method = app.remote[methodname];
          var methodargs = [];
          var remoteargs = [];
          _.each(calls, function(call, path) {
            methodargs.push(call.args);
          });
          remoteargs.push(token || app.token);
          remoteargs.push(methodargs);
          // FIXME: Should be checked if this still works after adding support for $.Deferred in Remote methods.
          remoteargs.push(this.callback);
          method.apply(app.remote, remoteargs);
        });
        this.lastRun = new Date();
        this.flushing = false;
      }
      return this;
    };

    return this;
  };

  return RpcQueue;

});
