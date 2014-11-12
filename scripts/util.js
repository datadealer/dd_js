define(function(require) {

  var $ = require('jquery');

  var util = {

    // Doing some magic for extending one prototype with another.
    extend: function(C, P) {
      var F = function() {};
      F.prototype = P.prototype;
      C.prototype = new F();
      C.prototype.constructor = C;
      C.P = P.prototype;
    },
    
    wait: function(delay) {
      console.warn('Asynchronously waiting for %s milliseconds.', delay);
      var deferred = new $.Deferred();
      setTimeout(function() {
        deferred.resolve();
      }, delay);
      return deferred.promise();
    }

  };

  return util;

});
