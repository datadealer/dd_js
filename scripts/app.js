define(function(require) {

  var Application = function() {

    require('json2');
    require('native-console');

    var _ = require('underscore');
    var $ = require('jquery');

    var setup = require('setup');
    var Remote = require('Remote');
    var Socket = require('Socket');
    var i18n = require('i18n');

    // Here we store the stuff we might need throughout the whole application.
    var app = {
      debug: {}
    };

    // Preload necessary views using the RequireJS `tpl` plug-in.
    app.loadViews = function() {
      var deferred = new $.Deferred();
      require([
        'tpl!../views/game.html',
        'tpl!../views/main.html',
        'tpl!../views/mainmenu.html',
        'tpl!../views/noitems.html',
        'tpl!../views/popup.html',
        'tpl!../views/levelup.html',
        'tpl!../views/lost_socket.html',
        'tpl!../views/popup_mission.html',
        'tpl!../views/popup_mission_complete.html',
        'tpl!../views/mission.html',
        'tpl!../views/mission_goal.html',
        'tpl!../views/mission_goal_small.html',
        'tpl!../views/mission_rewards.html',
        'tpl!../views/topscores.html',
        'tpl!../views/topscore.html',
        'tpl!../views/topscore_list.html',
        'tpl!../views/topscore_rank.html',
        'tpl!../views/notification.html',
        'tpl!../views/notification_item.html',
        'tpl!../views/notification_tutorial.html',
        'tpl!../views/popup_user_data.html',
        'tpl!../views/form_displayname.html',
        'tpl!../views/popup_status.html',
        'tpl!../views/popup_karma.html',
        'tpl!../views/popup_agent.html',
        'tpl!../views/popup_client.html',
        'tpl!../views/popup_contact.html',
        'tpl!../views/popup_proxy.html',
        'tpl!../views/popup_project.html',
        'tpl!../views/popup_pusher.html',
        'tpl!../views/popup_city.html',
        'tpl!../views/popup_cities.html',
        'tpl!../views/popup_profileset.html',
        'tpl!../views/popup_token.html',
        'tpl!../views/values.html',
        'tpl!../views/values_details.html',
        'tpl!../views/values_details_powerup.html',
        'tpl!../views/profileset.html',
        'tpl!../views/profileset_client.html',
        'tpl!../views/profileset_token.html',
        'tpl!../views/perp.html',
        'tpl!../views/agent.html',
        'tpl!../views/client.html',
        'tpl!../views/pusher.html',
        'tpl!../views/powerup.html',
        'tpl!../views/powerup_provided.html',
        'tpl!../views/powerup_free.html',
        'tpl!../views/powerup_locked.html',
        'tpl!../views/buttons_project.html',
        'tpl!../views/selector_powerups.html',
        'tpl!../views/subpop_powerup.html',
        'tpl!../views/subpop_buyslots.html',
        'tpl!../views/subpop_powerup_provided.html',
        'tpl!../views/subpop_perp_provided.html',
        'tpl!../views/subpop_token.html',
        'tpl!../views/subpop_token_upgrade.html',
        'tpl!../views/statusbar.html',
        'tpl!../views/token.html',
        'tpl!../views/token_consumed.html',
        'tpl!../views/db_queue.html'
      ], function() {
        deferred.resolve();
      });
      return deferred.promise();
    };

    // A nice wrapper for rendering underscore templates.
    app.renderView = function(viewName, data) {
      function renderView() {
        var view = require('tpl!../views/' + viewName);
        return view(data || {});
      }
      if (typeof window.TypeError !== 'undefined') { // If we have TypeError, we should have try/catch, too.
        try {
          return renderView();
        } catch(ex) {
          console.warn('Could not render view “%s”: %s', viewName, ex.message);
        }
      } else {
        return renderView();
      }
    };

    // This method initializes the application.
    app.start = function() {
      if (app.token) {
        console.error("ERROR, we already have a token");
        console.error('DEATH and MAYHEM!'); 
        if (app.game) { app.game.kill(); }
        return { fail: function(cb){ if (cb) { cb();} } }
      }
      app.remote = new Remote({
        endPoint: setup.jsonRpcUrl,
        queue: {
          // The queue should be started automatically.
          paused: false,
          // A delay of -1 means we step through the queue by using the `queue.next()` method.
          delay: -1,
          // The callback for processing a queued event.
          callback: function(event) {
            //console.log(event);
            var queue = this;
            // Call the event handler with the stored context and arguments.
            event.handler.apply(event.context, event['arguments']).then(function() {
              // Now process the next queued event.
              queue.next();
            }).fail(function() {
              console.log('Remote queue error:', arguments);
            });
          }
        }
      });

      // Define our JSON-RPC methods by wrapping them with Remote prototype.
      // (Please also refer to the Python docs about JSON-RPC methods.)
      app.remote.addMethod('buyPowerup');
      app.remote.addMethod('chargePerp');
      app.remote.addMethod('collectPerp', Remote.NEEDS_QUEUE); // Calls of this method are going to be queued.
      app.remote.addMethod('integrateCollected', Remote.NEEDS_QUEUE); // Calls of this method are going to be queued.
      app.remote.addMethod('getPowerups');
      app.remote.addMethod('getProvidedPerps');
      app.remote.addMethod('getSessionLocale');
      app.remote.addMethod('buyKarma');
      app.remote.addMethod('buyPerp');
      app.remote.addMethod('buySlots');
      app.remote.addMethod('getToken');
      app.remote.addMethod('loadGame');
      app.remote.addMethod('setDisplayName');
      app.remote.addMethod('getRanking');
      app.remote.addMethod('ping');
      app.remote.addMethod('resetGame');
      app.remote.addMethod('sellPowerup');
      app.remote.addMethod('setPerpCoordinates');

      app.remote.addMethod('checkUsername', setup.jsonRpcAuthUrl);

      // The authentication methods connect to a different URL.
      //app.remote.addMethod('debug', setup.jsonRpcAuthUrl);

      // Get a token from the back-end and return the deferred remote call.
      $('#loadertext').text('Fetching token');
      return app.remote.getToken().then(function(data) {
        var token = data.result;
        if (token) {
          // Store the token in our app container, for good.
          app.token = token;
          // Set the locale.
          $('#loadertext').text('Setting language');
          return app.remote.getSessionLocale().then(function(data) {
            var locale = data.result === 'de' ? 'de_AT' : 'en_US';
            i18n.setLocale(locale);
            // Now connect to the server via websocket.
            $('#loadertext').text('Initializing socket');
            return app.initSocket(token).then(function() {
              // When handshake is complete, load game data and initialize the game engine.
              $('#loadertext').text('Loading saved game');
              // Carefullly approaching async hell with deferred superpowers!
              return app.remote.loadGame(app.token).then(function(data) {
                var html = app.renderView('game.html');
                $('body').html(html);
                var Game = require('Game').getGame();
                var gameData = data.result;
                app.version = gameData.version;
                Game.init(gameData);
                if (setup.debug) {
                  window.app = app;
                  window.setup = setup;
                  window.Game = Game;
                  window.Render = require('Render').getRender();
                }
              });
            });
          });
        } else {
          return { fail: function(cb){ console.error('Y U no Token?'); if (cb) { cb();} } }
        } 
      });
    };

    // Calling this method restores the original HTML as of the time of loading.
    app.reset = function() {
      // FIXME: Currently three-o
      //$('body').html(app.renderView('main'));
    };

    // The initialisation method for the websocket connection.
    app.initSocket = function(token) {

      // We need to defer initialisation until the socket connection is fully established.
      var handshake = new $.Deferred();

      var socket = app.socket = new Socket({
        // We want to be able to queue some socket events.
        queue: {
          // The queue should not be started automatically.
          paused: true,
          // A delay of -1 means we step through the queue by using the `queue.next()` method.
          delay: -1,
          // The callback for processing a queued event.
          callback: function(event) {
            // Call the event handler with the stored context and arguments.
            event.handler.apply(event.context, event['arguments']);
            // Now process the next queued event.
            this.next();
          }
        }
      });

      // Defining the connect handler.
      socket.on("connect", function() {
        // Tell the back-end that we are listening and send the token.
        $('#loadertext').text('Socket connected');
        this.emit("client_connected", {token: token});
      });

      // If the connection is fully established the server sends the corresponding message.
      socket.on('established', function() {
        // And finally, as the handshake is complete, the deferred can be resolved.
        $('#loadertext').text('Socket established');
        handshake.resolve();
      });

      // Defining the disconnect handler.
      socket.on("disconnect", function() {
        // FIXME: Determine what should be done when socket is disconnected.
        console.warn('Socket was disconnected');
        $('#loadertext').text('Oops, sorry! Socket to server is disconnected. Please try to reload.');
        if (app.game) {
          console.error('Game socket lost');
          app.game.lostSocket();
        }
      });

      // Our debug event handler.
      socket.on("debug", function(data) {
        if (setup.debug) {
          console.info("SOCKET DEBUG", data.message);
        }
      });

      // Delegate the node_ready event to the game engine.
      socket.on("node_ready", function(data) {
        app.game.getById(data.id).trigger('node_ready', [data.result]);
      }, Socket.NEEDS_QUEUE); // This event handler is queued!

      // Delegate the node_items event to the game engine.
      socket.on("new_items", function(data) {
        app.game.trigger('new_items', [data]);
      }, Socket.NEEDS_QUEUE); // This event handler is queued!

      return handshake.promise();
    };

    // Extending Underscore with some helpers for easier templating.
    _.mixin({
      mixindone: function() { return true; },
      game: function(){
        // FIXME: only expose certain functions to _
        if (app.game) { return app.game; }
        else { return {} }
      },
      numeral: require('numeral'),
      sprintf: require('sprintf'),
      renderView: app.renderView,
      pad0: function(number, length) {
        // Fastest implementation according to http://jsperf.com/ways-to-0-pad-a-number
        var N = Math.pow(10, length);
        return number < N ? ('' + (N + number)).slice(1) : '' + number
      },
      crlf2html: function(str) {
        return String(str || '').replace(new RegExp('\r?\n|\r', 'g'), '<br>');
      },
      toKSNum: function(number) {
        // To activate german language set:
        //require('numeral-de');
        //_.numeral.language('de-de');
        return _.numeral(number).format('0,0');
      },
      toTime: function(ms) {
        var date = new Date(ms || 0);
        if (ms >= 3600000) {
          return _.pad0(date.getUTCHours(), 2) + ':' +
                 _.pad0(date.getUTCMinutes(), 2) + ':' +
                 _.pad0(date.getUTCSeconds(), 2);
        } else {
          return _.pad0(date.getUTCMinutes(), 2) + ':' +
                 _.pad0(date.getUTCSeconds(), 2);
        }
      },
      span: function(text,CSSClass) {
        CSSClass = CSSClass || "highlight";
        return '<span class="' + CSSClass + '">' + text + '</span>';
      },
      _: i18n.gettext,
      __: i18n.ngettext
    });



    $(function() {
      // Inject a new style element to define our main sprite image.
      // FIXME: This needs to be modified for retrieving the image path from the back-end.
      $('head').append($('<style type="text/css">')
          .html('.RenderSprite {background-image: url(img/MainSprites.png);}'));
    });

    return app;
  }

  var app;

  return {
    getApplication: function() {
      app = app || new Application();
      return app;
    }
  };

});
