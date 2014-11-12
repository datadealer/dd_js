// Some ugly spaghetti code to get the app running in magical order and put routie routes in place.
// Also handles dd_auth views and keeps track of valid tokens from dd_app
// FIXME: yes. Also get rid of routie.
require([
  'require',
  'jquery',
  'preload',
  'Remote',
  'i18n',
  'routie',
  'setup',
  'app',
  'json2',
  'native-console',
  'tpl!../views/loader.html',
  'tpl!../views/downtime.html',
  'tpl!../views/auth.html'
], function(require) {

  var $ = require('jquery');

  var Remote = require('Remote');
  var LoadQueue = require('preload');

  var setup = require('setup');
  var i18n = require('i18n');

  var remote = new Remote({endPoint: setup.jsonRpcUrl});
  remote.addMethod('getToken');
  
  var loadGameViewsAndStart = function(){
    var app = require('app').getApplication();
    app.loadViews().then(function() {
      console.info('Starting Game');
      app.start().fail(function(){
        console.warn('This game start has proudly failed, but do not worry...');
        $('#loadertext').text('Sorry, the Game failed to start.<br />Restarting...');
        location.href = "/";
      });
    });
  };

  // some asset loading

  var load = function() {
    var now = Date.now();
    var queue = new LoadQueue();

    //queue.installPlugin(createjs.Sound);

    queue.addEventListener('progress', function(event) {
      var percentage = parseInt(event.loaded * 100, 10);
      $('#loader').val(percentage);
      $('#loadertext').text('Loading Game ' + percentage + "%");
    });

    // FIXME: make this a setup_local setting to match actual server configuration
    queue.setMaxConnections(8);
    queue.setUseXHR(false)

    queue.addEventListener('fileload', function(event) {
      switch (event.item.type) {
        case LoadQueue.CSS:
        (document.head || document.getElementsByTagName("head")[0]).appendChild(event.result);
        console.info('Loaded stylesheet %s', event.item.src);
        break;
        case LoadQueue.IMAGE:
        //console.info('Loaded image %s', event.item.src);
        break;
        case LoadQueue.JAVASCRIPT:
        document.body.appendChild(event.result);
        //console.info('Loaded script %s', event.item.src);
        break;
        case LoadQueue.JSON:
        if (event.item.src.indexOf('/i18n/') > -1) {
          console.info('Loaded language %s', event.item.src);
        }
        break;
        default:
        console.info('Loaded file %s', event.item.src);
      }
    });

    queue.addEventListener('complete', function(event) {
      console.info('We’re done, let’s sell your private data!');
      $('#loadertext').text('Starting Game');
      loadGameViewsAndStart();
    });

    $.getScript('scripts/asset-manifest.js').then(function() {
      queue.loadManifest(filesManifest);
    }).fail(function(){
      if (setup.debug) {
        loadGameViewsAndStart();
      }
    });
  };

  // register some routes

  var routie_routes = {};
  routie_routes['load'] = function() {
    remote.getToken().done(function(data) {
      console.info('We got a token:', data.result);
      var view = require('tpl!../views/loader.html');
      $('#dd-control').html(view());
      load();
    }).fail(function(data) {
      if (data && data.error && data.error.code === -32403) {
        console.warn(data.error.message, data.error.code);
        location.href = '/#sign_in';
        routie('sign_in');
      } else {
        console.error('Error: ',data);
        console.error('Backend made a  bubu, do something!');
        routie('downtime');
      }
    });
  };
  routie_routes['downtime'] = function() {
    var view = require('tpl!../views/downtime.html');
    $('#dd-control').html(view());
  };

  // -----------------------------------------------------------------------------------
  // ^- desperately slashing at the spaghetti, trying to kill it, but all to no avail.

  // register some backend calls

  remote.addMethod('checkInvitationToken', setup.jsonRpcAuthUrl);
  remote.addMethod('logout',setup.jsonRpcUrl);
  remote.addMethod('getToken',setup.jsonRpcUrl);

  DD_REDIRECT_STATUS = 278;

  var renderView = function(data, status, xhr) {
    if (!checkServerRedirect(xhr)) {
      var view = require('tpl!../views/auth.html');
      $('body').html(view({form: data}));
    }
  };

  var checkServerRedirect = function(xhr) {
    if (xhr && xhr.status === DD_REDIRECT_STATUS) {
      var url = xhr.getResponseHeader('Location');
      var pos = url.lastIndexOf('#');
      if (url && pos > -1) {
        // Crop the hash part from the URL only
        location.replace(url.substr(pos));
        return true;
      }
      return false;
    } else {
      return false;
    }
  }

  // define some more routes
  
  var routie_auth = {
    sign_up: function() {
      $.get(setup.signUpUrl, function() {
        renderView.apply(this, arguments);
      });
    },

    sign_in: function() {
       $.get(setup.signInUrl, function(data) {
         renderView.apply(this, arguments);
       }).fail(function(){
         console.error('Loading form failed');
         routie('downtime');
       });
    },

    reset_password: function() {
      $.get(setup.resetPasswordUrl, function() {
        renderView.apply(this, arguments);
      });
    },

    'reset_password/:key': function(key) {
      // FIXME *cough* unused?
      $.get(setup.resetPasswordFromKeyUrl + key, function() {
        renderView.apply(this, arguments);
      });
    },

    sign_out: function() {
      $.get(setup.signOutUrl).success(function(){
        location.href = '/';
      }).fail(function(){
        console.warn('Auth logout failed, trying fallback');
        remote.getToken().done(function(data) {
          remote.logout(data.result).done(function(data) {
            location.href = '/';
          })
          .fail(function(){
            routie('downtime');
          });
        })
        .fail(function(){
          routie('downtime');
        });
      });
    },

    set_email: function() {
      $.get(setup.setEmailUrl, function() {
        renderView.apply(this, arguments);
      });
    },

    access_denied: function() {
      $.get(setup.accessDeniedUrl, function() {
        renderView.apply(this, arguments);
      });
    },

    'invite/:token': function(token) {
      remote.checkInvitationToken(token, function(data) {
        console.info('Invitation token is %s', data.result ? 'valid' : 'invalid');
        location.replace(data ? '#sign_up' : '#access_denied');
      });
    },

    set_lang: function() {
      $.get(setup.setLangUrl, function(data) {
        renderView(data);
      });
    }
  };

  // add those spaghetti routes to our real routie-reg-obj.

  _.each(routie_auth, function(func, route){
    routie_routes[route] = func;
  });

  // dd_auth form handling:

  // Generic wrapper catching clicks on django.allauth form submit elements and sending the form data via XHR. 
  // This way the django.allauth forms can be integrated (quite) easily in the game layout.
  $(document).on('click', '#dd_auth :submit', function(event) {
    event.preventDefault();
    $(this).attr('disabled', true);

    var data = {};
    var inputs = $(this).parents('form').find('input');

    inputs.each(function(index, element) {
      var el = $(element);
      var name = el.attr('name');
      var type = el.attr('type');
      if (type === 'checkbox' || type === 'radio') {
        data[name] = el.prop('checked');
      } else {
        data[name] = el.val();
      }
    });

    $.post($(this.form).attr('action'), data, function(data, status, xhr) {
      checkServerRedirect(xhr);
      if (data) {
        $('#dd_auth').html(data);
      }
    });
  });

  // Prevent double clicks on dd_auth links; all <a> elements are going to be disabled for 3 seconds.
  $(document).on('click', '#dd_auth a', function(event) {
    var self = $(this);
    if (self.hasClass('disabled')) {
      event.preventDefault();
    } else {
      self.addClass('disabled');
      setTimeout(function() {
        $(self).removeClass('disabled');
      }, 3000);
    }
  });

  // finally do it:

  // routie endpoint, so reassign route handlers
  routie.removeAll(); // just in case?
  routie(routie_routes);

  // FIXME: Starting with #load
  if (!location.hash) {
    routie('load');
  } 
});
