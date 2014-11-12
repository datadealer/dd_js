define(function(require) {

  var Game = function() {

    var _ = require('underscore');
    var $ = require('jquery');
    var sprintf = require('sprintf');

    var app = require('app').getApplication();
    var setup = require('setup');
    var extend = require('util').extend;
    var Render = require('Render').getRender();
    var RpcQueue = require('RpcQueue');
    var typeSettings = require('type_settings').getTypeSettings();

    //////////////////////////////////////////
    //
    // The Game API
    //
    // Instantiates a tree like structure of
    // game controllers, talks to the backend 
    // and make use of the Render.js API
    // 
    // Here be dragons...
    //
    //////////////////////////////////////////


    /////////////////////////////////////////////
    // Some generic tools and getter functions
    /////////////////////////////////////////////

    var _instances = [];

    var _ids = {};

    var add = function(node) {
      _instances[node._id] = node;
      _ids[node.id] = node;
    };

    var get = function(_id) {
      return _instances[_id];
    };

    var remove = function(_id) {
      if (get(_id)) {
        delete _ids[get(_id).id];
      }
      _instances[_id]=undefined;
    };

    var clear = function() {
      // Clear everything that has been instantiated so far
      for (var n=0;n<_instances.length;n++) {
        var node = _instances[n];
        if (node) {
          node.remove();
        }
      }
      _instances.length = 0;
    };

    var init = function(data) {
      // Inits GameRoot as a Singleton, for now.
      app.game = new GameRoot();
      app.game.loadGame(data);
      return app.game;
    };

    var rpcQueue = new RpcQueue({
      callback: function() {
        return true;
      }
    });


    ////////////////////////////////
    // The Set
    ////////////////////////////////

    var Set = function(set){
      if (!set) {
        set = [];
      }
      this.set = set;
      this.length = this.set.length;
      return this;
    };

    Set.prototype.add = function(node){
      this.set.push(node);
      this.length = this.set.length;
    };

    Set.prototype.prepend = function(node){
      this.set.unshift(node);
      this.length = this.set.length;
    };

    Set.prototype.remove = function(node){
      var index = this.set.indexOf(node);
      if (index !== -1) {
        this.set.splice(index, 1);
      }
      this.length = this.set.length;
    };

    Set.prototype.each = function(func){
      if (!func) {
        return;
      }
      for (var n=0;n<this.set.length;n++) {
        var node = this.set[n];
        func(node);
      }
      this.length = this.set.length;
    };


    //////////////////////////////////////////
    // Some helpers
    //////////////////////////////////////////

    var getById = function(id) {
      // Returns GameNode by ID
      return _ids[id];
    };

    var getByGestalt = function(gestalt) {
      // Returns GameNodes by gestalt (first found)
      return _.findWhere(Game._ids, { gestalt: gestalt });
    };

    var getAllByGestalt = function(gestalt) {
      // Returns GameNodes by gestalt (all found)
      return _.where(Game._ids, { gestalt: gestalt });
    };

    var eachByGestalt = function(gestalt,func) {
      // Returns GameNodes by gestalt (all found)
      if (func) {
        _.each(_.where(Game._ids, { gestalt: gestalt }),function(v,k){
          func(v,k);
        });
      }
    };

    var getByType = function(game_type) {
      // Returns GameNodes by type
      return _.where(Game._ids, { gameType: game_type });
    };
    
    var getLastId = function(path) {
      // Returns last ID of a Path, usally the ID of the GameNode itself
      return path.split(setup.pathSeparator).pop();
    };

    var getByLastId = function(path) {
      // Returns GameNode by parsing the paths last ID
      return getById(getLastId(path));
    };

    var getParentId = function(path) {
      // Returns the ID of the second last element of a path
      var parts = path.split(setup.pathSeparator);
      parts.pop();
      return parts.pop();
    };

    var getParentFromPath = function(path) {
      // Returns the parent GameNode from a Node's full path
      return getById(getParentId(path));
    };

    var getFirstId = function(path) {
      // Returns the root of a Path
      return path.split(setup.pathSeparator)[0];
    };

    var getByFirstId = function(path) {
      // Returns the GameNode of the root of a path
      return getById(getFirstId(path));
    };

    var getGestalt = function(full_type) {
      // Returns the the gestalt from a full type definition
      return full_type.split(setup.typeSeparator)[1];
    };

    var mergeData = function(type_data,instance_data) {
      // Merges data objects, second argument overwrites the first ones and returns new merged object
      var data = {};
      _.extend(data,type_data);
      _.extend(data,instance_data);
      // If the type data is Project-like (has powerups and tokens) merge token amounts
      if (instance_data && type_data && instance_data.hasOwnProperty('powerups') && type_data.hasOwnProperty('tokens') && instance_data.hasOwnProperty('tokens')) {
        var tokens = [];
        // No way around this: make a deep copy to avoid messing with token type_data
        _.each(type_data.tokens,function(v,k){
          tokens[k] = _.clone(v);
        });
        var instokens = instance_data.tokens;
        _.each(tokens,function(t,k) {
          var overwrite = _.findWhere(instokens, { gestalt: t.gestalt });
          if (overwrite && overwrite.amount) {
            t.amount = overwrite.amount;
          }
        });
        data.tokens = tokens;
      }
      return data;
    };

    var convertPowerupType = function(game_type){
      // This costs a beer dudes...
      var convertCat = {
        'UpgradePowerup':'upgrade',
        'AdPowerup': 'ad',
        'TeamMemberPowerup':'teammember'
      }
      return convertCat[game_type];
    };

    var getPowerupTypeFromGestalt = function(gestalt) {
       var convertCat = {
        'upgrade': 'UpgradePowerup',
        'ad' : 'AdPowerup',
        'teammember': 'TeamMemberPowerup',
      }
      var cat = undefined;
      _.each(convertCat,function(v,k){
        if (gestalt.substring(0, k.length) === k) {
          cat = v;
        }
      });
      return cat;
    };

    /////////////////////////////////////////////
    // The APTicker (increments Action Points)
    /////////////////////////////////////////////

    // Written as Singleton, like original Ticker

    var APTicker = {
      interval: 0,
      offset: 0,
      start: function(offset){
        if (!this.timeout) {
          this.tick(offset);
        }
      },
      reset: function(){
        window.clearTimeout(this.timeout);
        this.tick();
      },
      tick: function(offset){
        var interval = this.interval;
        if (offset) {
          interval = interval - offset;
          this.offset = offset;
        } else {
          this.offset = 0;
        }
        if (interval > 0) {
          APTicker.lastTick = Date.now();
          this.timeout = window.setTimeout(function(){
            APTicker.listeners.each(function(node){
              if (node.APTick) {
                node.APTick();
              }
            });
            APTicker.tick();
          }, interval);
        }
      },
      getRemainingTime: function(){
        return new Date(this.lastTick + this.interval - this.offset - Date.now());
      },
      addListener: function(node) {
        this.listeners.add(node);
      },
      removeListener: function(node) {
        this.listeners.remove(node);
      },
      stop: function(){
        window.clearTimeout(this.timeout);
        this.timeout=undefined;
      }
    };
    APTicker.listeners = new Set();

    /////////////////////////////////////////////
    // The AniTicker (increments Action Points)
    /////////////////////////////////////////////

    // Written as Singleton, like original Ticker

    var AniTicker = {
      interval: 5000,
      counter: 0,
      start: function(){
        AniTicker.counter = 0;
        if (!this.timeout) {
          this.tick();
        }
      },
      reset: function(){
        window.clearTimeout(this.timeout);
        this.tick();
      },
      tick: function(){
        if (this.interval > 0) {
          this.timeout = window.setTimeout(function(){
            var node = AniTicker.listeners.set[0];
            AniTicker.interval = (Math.random()) * 1500 + 5000;

            if (node) {
              node.AniTick();
            }
            // only shuffle when all items were served (uses counter)
            AniTicker.listeners.set = _.shuffle(AniTicker.listeners.set);
            AniTicker.tick();
          },this.interval);

          /* // Shuffle all Test
          AniTicker.counter += 1;
          this.timeout = window.setTimeout(function(){
            var node = AniTicker.listeners.set[0];

            var first = AniTicker.listeners.set.shift();
            if (first) {
              AniTicker.listeners.set.push(first);
            }
            if (node) {
              node.AniTick();
            }
            // only shuffle when all items were served (uses counter)
            AniTicker.interval = (Math.random()) * 1000 + 1000;
            if (AniTicker.counter > AniTicker.listeners.length -1) {
              AniTicker.listeners.set = _.shuffle(AniTicker.listeners.set);
              AniTicker.counter = 0;
              AniTicker.interval = 4000 + 1000 * AniTicker.listeners.length;
            }
            AniTicker.tick();
          },this.interval);
          */
        }
      },
      addListener: function(node) {
        if (node.AniTick) {
          this.listeners.add(node);
        }
      },
      removeListener: function(node) {
        this.listeners.remove(node);
      },
      stop: function(){
        window.clearTimeout(this.timeout);
        this.timeout=undefined;
      }
    };
    AniTicker.listeners = new Set();

    //////////////////////////////////////////
    // The GameNode Base Class
    //////////////////////////////////////////

    var GameNode = function(config) {
      this.init(config);
      return this;
    };

    // RenderType and RenderData for the GameNode's main renderNode to match against Render API
    GameNode.prototype.renderData = undefined;
    GameNode.prototype.renderType = undefined;

    GameNode.prototype.toString = function() {
      return sprintf('GameNode “%s”: %d children', this.renderType || this._id,
      this.children.length);
    };

    GameNode.prototype.init = function(config) {
      // Initialize GameNode and register it in Game _instances (Array) and _ids (Object)
      // Set children property for tree-structure
      // Set States registry of the GameNode
      // Backlink to GameRoot for easy access to GameRoot API
      // setAttrs expands the Object via generic setAttrs
      // makeRenderConfig does the data crunching for the RenderAPI
      // jq is the jquery wrapper of the GameNode
      // initialize Event Handlers usually overwritten by the SubClasses
      if (!config) {
        config = {};
      }
      this._id = _instances.length;
      this.id = config.id || "GameNode"+this._id;
      add(this);
      this.children = new Set();
      this.states = {
        idle:true
      };
      this.GameRoot = get(0);
      this.setAttrs(config);
      this.makeRenderConfig();
      this.jq = $(this);
      // init Event Handlers
      this.initEventHandlers();
    };

    GameNode.prototype.remove = function(){
      // Remove GameNode from all references and remove renderNodes
      var gnode = this;
      if (this.parentNode) {
        this.parentNode.children.remove(this);
      }
      if (this.children) {
        this.children.each(function(child){
          child.parentNode = undefined;
        });
      }
      if (this.renderNode) {
        this.renderNode.remove();
      }
      if (this.renderMenu) {
        this.renderMenu.remove();
      }
      if (this.renderPopup) {
        this.renderPopup.close();
      }
      if (this.renderStatusbar) {
        this.renderStatusbar.remove();
      }
      remove(this._id);
    };

    GameNode.prototype.addType = function(gestalt,data){
      // Add a type to the typeRegistry data should have data.type_data
      // If the game_type is also defined in typeSettings it will be merged and overwritte with data
      var gnode = this;
      var groot = gnode.GameRoot;
      var nodeType = this.getType();
      if (nodeType) {
        if (data.game_type && data.type_data) {
          if (typeSettings.hasOwnProperty(data.game_type)) {
            data.type_data = mergeData(typeSettings[data.game_type].type_data,data.type_data);
            data.type_data.gestalt = gestalt;
            data.type_data.game_type = data.game_type;
            // expand powerup tokens with their type data
            if (data.type_data.tokens && data.type_data.tokens.length) {
              _.each(data.type_data.tokens, function(v,k){
                v.type_data = groot.getTypeData(v.gestalt);
              });
            }
          }
        return nodeType[gestalt] = data;
        }
      }
    };

    GameNode.prototype.getType = function(gestalt){
      // Get (sub)type from node gestalt or return own type
      if (gestalt) {
        return this.GameRoot.getType(this.gestalt)[gestalt];
      } else {
        return this.GameRoot.getType(this.gestalt);
      }
    };
    GameNode.prototype.getTypeData = function(gestalt){
      // Get (sub)type from node gestalt or return own type
      if (gestalt) {
        return this.GameRoot.getType(this.gestalt)[gestalt].type_data;
      } else {
        return this.GameRoot.getType(this.gestalt).type_data;
      }
    };

    GameNode.prototype.setState = function(state,value) {
      // State change triggers event for renderNodes and renderPopups to listen to
      // Note: The event is feedbacked to the GameNode. So Listener attached to the GameNode will also be triggered.
      
      // do nothing when state is the same
      if (this.states[state] === value) {
        return;
      }
      this.states[state] = value;
      // TODO: Eventhook could be more generic but probably we only need feedback in the popup
      this.trigger('local_states',[state,value]);
      this.trigger('local_states_'+state,[value]);
      if (this.renderNode) {
        this.renderNode.trigger('states',[state,value]);
        this.renderNode.trigger('states_'+state,[value]);
      }
      if (this.renderPopup) {
        this.renderPopup.trigger('states',[state,value]);
        this.renderPopup.trigger('states_'+state,[value]);
      }
    };

    GameNode.prototype.setAttrs = function(attrs) {
      // Set any attribute(s)
      for (var key in attrs) {
        if (attrs.hasOwnProperty(key)) {
          this[key] = attrs[key];
        }
      }
    };

    GameNode.prototype.load = function() {
      // FIXME: Do we need this?
    };

    GameNode.prototype.save = function() {
      // FIXME: Do we need this?
    };

    GameNode.prototype.addChild = function(child) {
      // The GameNode Tree: Append a child to the GameNode
      if (!child) {
        return false;
      }
      this.children.add(child);
      child.parentNode = this;
      return child;
    };

    GameNode.prototype.on = function(event,func) {
      // Bind an jQuery Eventhandler to the GameNode
      // Note: Most of the times this is called by the Renderer
      // Important: any RenderNode.trigger() will feedback to the GameNode!
      this.jq.on(event,func);
    };
    GameNode.prototype.off = function(event) {
      // Unbind an jQuery Eventhandler from the GameNode
      this.jq.off(event);
    };
    GameNode.prototype.trigger = function(event,params) {
      // Trigger an jQuery Eventhandler from the GameNode
      this.jq.trigger(event,params);
    };

    GameNode.prototype.initEventHandlers = function() {
      // Bind specific eventhandlers (which get triggered by Render.Node)
      // This is an example implementation and usually gets overwritten by the Subclasses
      var gnode = this;
      gnode.on('vclick',function(e) {
        e.stopPropagation();
      });
      if (this.extendEventHandlers) {
        this.extendEventHandlers();
      }
    };

    GameNode.prototype.removeEventHandlers = function() {
      // Stupidly removes all event handlers
      this.off();
    };

    GameNode.prototype.makeRenderConfig = function() {
      // Crunch data for render initialisation
      // FIXME: this is mostly for data compatibility reasons,
      // could be more streamlined
      if (!this.renderData) { this.renderData = {}; }
      var config = this.renderData.config || {};

      //var data = mergeData(data.type_data,data.instance_data);
      var data = this.data || {};
      config.id = this.id;
      config.name = data.name || config.name || this.id;


      config.x = data.x || config.x;
      config.y = data.y || config.y;

      config.width = data.width || config.width;
      config.height = data.height || config.height;

      config.label = data.label || config.label;

      config.zoomScale = data.zoom_scale || config.zoomScale;
      config.perpSprite = data.perp_sprite || config.perpSprite;

      config.perpBackground = data.perp_background || config.perpBackground;
      //FIXME: supertoken check with is_supertoken, not gestaltinspection (though would work)
      if (this.gestalt && this.gestalt.substring(0,10) === 'supertoken') {
        config.perpBackground = data.perp_background2;
      }
      if (this.gestalt && this.gestalt.substring(0,6) === 'origin') {
        this.is_origin = true;
        config.no_render = true;
      }
      if (this.gestalt && this.gestalt.substring(0,5) === 'token') {
        this.GameRoot.getTypeData(this.gestalt).is_supertoken = false;
        this.data.is_supertoken = false;
      }
      if (config.perpBackground) {
        _.each(config.perpBackground, function(v,k){
          config[k]=v;
        });
      }

      config.background = data.background || config.background;
      config.RenderTemplate = data.RenderTemplate || config.RenderTemplate;

      this.renderData.parentNode = this.renderNodeParent;
      this.renderData.config = config;
      return config;
    };

    GameNode.prototype.updateRenderNode = function(render) {
      // Test Method: Updates the rendered GameNode to the stored config
      // FIXME: this probably is pointless, better to reinit a specific node?
      // Need to take care of tree structure and all render specific settings
      if (!this.renderData && !render) {
        return;
      } else if (render) {
        this.renderData = render;
      }
      if (this.renderData.hasOwnProperty('config')) {
        this.renderNode.setAttrs(this.renderData.config);
      }
      this.renderNode.draw();
    };

    GameNode.prototype.render = function() {
      // Renders GameNode or recursivly removes old RenderNodes and renders anew.
      // FIXME: currently rerendering stuff has some problems with decorators etc...
      // Maybe there's a better way to update stuff or re-init parts of the GameNode-Tree
      if (this.renderNode) {
        this.renderNode.remove();
      }
      var render = this.renderData;

      if (render && render.config && !render.config.no_render) {
        var node = new Render[this.renderType](render.config);
        this.renderNode = node;
        this.trigger('before_render');
        node.gameNode = this;
        // Put RenderNode in its place:
        if (render.parentNode) {
          var parentNode = Render.getById(render.parentNode);
          if (parentNode) {
            parentNode.addChild(node);
          }
        }

        // Execute subclass specific render function
        if (this.extendRender) {
          this.extendRender();
        }
        // after_render is only triggered when node rendered for the first time
        this.trigger('after_render');
      }
      // FIXME: Recursion, maybe we better get rid of it and do rendering on init and specific updates of the Tree
      if (this.children.length) {
        this.children.each(function(child) {
          child.render();
        });
      }
    };


    //////////////////////////////////////////////////
    // The Subclasses
    //////////////////////////////////////////////////

    ///////////////////////////////////
    // The GameRoot of all Evil
    // Currently only a single instance of GameRoot should be instantiated
    // On Game.init GameRoot is exposed globally to app as app.game
    // GameRoot (app.game) can be accessed in debug mode from the console
    // TODO: better way to publish only those parts of the api that need to be global
    ///////////////////////////////////

    var GameRoot = function(config) {
      // Initialize the typeRegistry
      this.typeRegistry = {};
      this.DBTokensLength = 0;
      this.DBTokensLengthMax = 0;
      this.DBTokens = {};
      this.DBOriginTokens = {};
      this.DBTokensAbsolute = {};
      this.DBTokensCrossSum = 0;
      this.IPerps = {};
      this.NotificationQueue = [];
      return this;
    };
    extend(GameRoot, GameNode);

    GameRoot.prototype.renderType = "Stage";
    
    GameRoot.prototype.get = get;
    
    GameRoot.prototype.setup = setup;

    GameRoot.prototype.ids = _ids;
    GameRoot.prototype.getById = getById;

    GameRoot.prototype.addType = function(gestalt,data){
      // Add a type to the typeRegistry data should have data.type_data
      // If the game_type is also defined in typeSettings it will be merged and overwritten with data
      if (data.game_type && data.type_data) {
        if (typeSettings.hasOwnProperty(data.game_type)) {
          data.type_data = mergeData(typeSettings[data.game_type].type_data,data.type_data);
        }
      }
      this.typeRegistry[gestalt] = data;
      this.typeRegistry[gestalt].gestalt = gestalt;
      this.typeRegistry[gestalt].game_type = data.game_type;
      // FIXME: is_supertoken fix for export fail.
      if (gestalt.substring(0,5) === 'token') {
        this.typeRegistry[gestalt].type_data.is_supertoken = false;
      }

      return this.typeRegistry[gestalt];
    };

    GameRoot.prototype.addSubType = function(parent_gestalt,gestalt,data){
      // Add a subtype to the typeRegistry data should have data.type_data
      // If the game_type is also defined in typeSettings it will be merged and overwritten with data
      var groot = this;
      var parentType = groot.getType(parent_gestalt);
      if (parentType) {
        if (data.game_type && data.type_data) {
          if (typeSettings.hasOwnProperty(data.game_type)) {
            data.type_data = mergeData(typeSettings[data.game_type].type_data,data.type_data);
            // expand powerup tokens with their type data
            if (data.type_data.tokens && data.type_data.tokens.length) {
              _.each(data.type_data.tokens, function(v,k){
                v.type_data = groot.getTypeData(v.gestalt);
              });
            }
          }
        return parentType[gestalt] = data;
        }
      }
    };


    GameRoot.prototype.removeType = function(gestalt){
      // Remove a type from the typeRegistry
      delete this.typeRegistry[gestalt];
    };
    GameRoot.prototype.getType = function(gestalt){
      // Get type from the registry, Note on the structure: data.type_data
      return this.typeRegistry[gestalt];
    };
    GameRoot.prototype.getTypeData = function(gestalt){
      // Get type_data from the registry, Note on the structure: data.type_data
      var type = this.getType(gestalt);
      if (type) {
        return type.type_data;
      } else {
        return undefined;
      }
    };
    GameRoot.prototype.getTypes = function(game_type){
      // Get all types with game_type from the registry
      //return this.typeRegistry[gestalt];
      return _.where(this.typeRegistry,{game_type:game_type});
    };
    GameRoot.prototype.getTypeFromGestalt = function(gestalt){
      // Get all types with game_type from the registry
      if (gestalt) {
        return this.typeRegistry[gestalt].game_type;
      } else {
        return {};
      }
    };

    GameRoot.prototype.getDBTokenAmount = function(gestalt){
      if (this.DBTokens && this.DBTokens.hasOwnProperty(gestalt)) {
        return this.DBTokens[gestalt];
      } else {
        return 0;
      }
    };

    GameRoot.prototype.getDBTokensLength = function(){
      // without origin tokens
      return this.DBTokensLength = _.filter(_.keys(this.DBTokens),function(t){ return t.substring(0,6) !== 'origin' }).length;
    }

    GameRoot.prototype.getDBTokensLengthMax = function(){
      // without origin tokens
      return this.DBTokensLengthMax = _.filter(_.where(this.typeRegistry,{ game_type: "TokenPerp" }), function(t){ 
        return t.gestalt.substring(0,6) !== 'origin';
      }).length;
    }


    GameRoot.prototype.getDBTokensCrossSum = function(gestalt){
      var DBTokens = this.DBTokens;
      var sum = 0;
      var count = 1;
      _.each(DBTokens,function(t,k){
        sum += t;
        count += 1;
      });
      return sum / count;
    };

    GameRoot.prototype.compileOriginTokens = function(nodes){
      var groot = this;
      var origintokens = _.filter(nodes, function(n){ if (n.gestalt) { return n.gestalt.substring(0,6) === 'origin'; } else { return false; } });
      _.each(origintokens, function(t,k){
        var ot = groot.DBOriginTokens[t.gestalt] = {};
        ot.gestalt = t.gestalt;
        ot.data = groot.getTypeData(t.gestalt);
        ot.amount = ot.data.amount = t.instance_data.amount;
        ot.absoluteAmount = (groot.profiles_value * ot.amount) / 100;
        ot.originGameNode = getByGestalt(ot.data.origin_gestalt);
        ot.originGameType = ot.originGameNode.gameType;
        if (ot.originGameType === "CityPerp") {
          var citymax = ot.originGameNode.data.profiles_max;
          ot.cityMaxAmount = (ot.amount/100) * groot.profiles_value / citymax;
          //((float(amounts.get(origin_gestalt, 0))/100) * self.game_values.get('profiles_value')) / origin_data.get('type_data').get('profiles_max')
        }
      });
    };


    GameRoot.prototype.getOriginGestaltFromOriginTokenGestalt = function(origintokengestalt){
      var origin = _.find(this.DBOriginTokens, function(ot){ return ot.originGameNode.gestalt === "city002" }) || {};
      return origin.gestalt;
    };

    GameRoot.prototype.kill = function() {
      console.warn('Killing Game');
      clear();
      delete app.game;
    };

    GameRoot.prototype.lock = function() {
      // Lock the whole stage and turn off triggering of render Events
      // TODO make stage spinner in Render and use proper method to unbind events
      // Unlock currently wouldn't work since all events are destroyed
      if (this.renderNode) {
        this.renderNode.lock();
        this.renderMenu.lock();
        AniTicker.stop();
      }
      // FIXME for Popups
      //this.renderNode.jdomelem.find('*').off();
    };
    GameRoot.prototype.unlock = function() {
      // UnLock the whole stage
      // TODO make stage spinner in Render and use proper method to unbind events
      // Unlock currently wouldn't work since all events are destroyed
      var groot = this;
      if (groot.NotificationQueue && groot.NotificationQueue.length < 2) {
        this.renderNode.unlock();
        this.renderMenu.unlock();
        AniTicker.start();
      } else if (!groot.NotificationQueue) {
        this.renderNode.unlock();
        this.renderMenu.unlock();
        AniTicker.start();
      }
      //this.renderNode.jdomelem.find('*').off();
    };

    GameRoot.prototype.lostSocket = function() {
      var groot = this;
      groot.makeNotifications({
        error: {
          title: _._("lostsocket title"),
          subtitle: _._("lostsocket subtitle"),
          description: _._('lostsocket sorry, bla bla will retry or refresh')
        }
      });

      /*
      groot.lock();
      groot.openGenericPopup({
        data: {
          title: _._("lostsocket title"),
          subtitle: _._("lostsocket subtitle"),
          description: _._('lostsocket sorry, bla bla will retry or refresh')
        },
        template:'lost_socket.html'
      });
      */
    };

    GameRoot.prototype.refresh = function() {
      // Reload the game data and reinit the whole Game (like page reload but with less requests) ;)
      var groot = this;
      groot.retryDelay = groot.retryDelay || 2000;

      groot.lock();

      return app.remote.getToken().then(function(data) {
        var token = data.result;
        if (token) {
          // Store the token in our app container, for good.
          app.token = token;
          // Set the locale.
          return app.remote.getSessionLocale().then(function(data) {
            var i18n = require('i18n');
            var locale = data.result === 'de' ? 'de_AT' : 'en_US';
            i18n.setLocale(locale);
            // Now connect to the server via websocket.
            return app.initSocket(token).then(function() {
              // When handshake is complete, load game data and initialize the game engine.
              var html = app.renderView('game.html');
              $('body').html(html);
              // Carefullly approaching async hell with deferred superpowers!
              return app.remote.loadGame(app.token).then(function(data) {
                var Game = require('Game').getGame();
                var gameData = data.result;
                app.version = gameData.version;
                Game.init(gameData);
              });
            });
          });
        }
      })
      .fail(function(data){
        if (groot.notificationPopup) {
          groot.notificationPopup.trigger('error');
          window.setTimeout(function(){
            if (groot.notificationPopup) {
              groot.notificationPopup.render();
            }
          },groot.retryDelay);
          groot.retryDelay += 1000;
          if (groot.retryDelay > 6000) {
            document.location.href = "/";
          }
        }
      });
    };

    GameRoot.prototype.extendRender = function() {
      if (this.renderMenu) {
        this.renderMenu.remove();
      }
      var menu = new Render.MainMenu({
        gameNode:this,
        data:{
          logo: {
            frameSrc: 'MainSprites.png',
            frameMap: {
              normal: {x: 1, y: 819, width: 222, height: 40}
            },
            frame: 'normal',
            className: 'MainMenuLogo'
          },
          userdata:this.userdata,
          buttons:[]
        }
      });

      this.initStatusBar();
      var statusbar = this.renderStatusbar = new Render.Statusbar(this.data.status_bar);

      var stage = this.renderNode;
      stage.gameNode = this;
      if (setup.debug) {
        $(setup.renderContainer).addClass('debugmode');
      }
      $(setup.renderContainer).append(menu.domelem);
      menu.initUI();
      $(setup.renderContainer).append(stage.domelem);
      this.renderNode = stage;
      this.renderMenu = menu;
      stage.addChild(statusbar);
    };

    GameRoot.prototype.initEventHandlers = function() {
      var gnode = this;

      // FIXME: This event should be renamed as we are out of the test phase – or are we?
      gnode.on('saveCoordsQueue', function(e,path,pos) {
        rpcQueue.addCall('setPerpCoordinates', path, [path, pos], function(data) {
          //console.log('queue called setPerpCoordinates, got', data.result);
        });
      });
      gnode.on('saveCoords', function(e, path, pos) {
       // FIXME: non queued saving returns result 1 still fails to save for some reason
       app.remote.setPerpCoordinates(app.token, [[path, pos]]);
      });


      gnode.on('switch_view',function(e,view_id) {
        e.stopPropagation();
        _.each(gnode.renderMenu.data.buttons, function(button) {
          if (view_id !== button.id) {
            getById(button.id).setState('active',false);
          }
        });
        gnode.activeView = getById(view_id);
        gnode.activeView.setState('active',true);
      });

      gnode.on('user_data',function(e) {
        e.stopPropagation();
        var user = gnode.data.user;
        var text = _._('user description');
        gnode.openGenericPopup({
          data: {
            title: user.auth_fullname || user.auth_username,
            description: text
          },
          template:'popup_user_data.html'
        });
      });

      gnode.on('click_status.karma',function(e) {
        var providedKarma = gnode.compileProvidedKarma();
        gnode.openGenericPopup({
          data: {
            title: _._("karma_popup title"),
            description: _._('karma_popup description'),
            selectortitle: _._('karma_popup selector title'),
            mainsprites_class: "karma",
            providedKarma: providedKarma
          },
          template:'popup_karma.html'
        });
      });

      gnode.on('click_status.Profiles',function(e) {
        gnode.openGenericPopup({
          data: {
            title: _._("sb_profiles title"),
            subtitle: _.sprintf(_._('sb_profiles subtitle %s from %s profiles'), _.span(_.toKSNum(gnode.profiles_value)), _.span(_.toKSNum(gnode.profiles_max))),
            description: _._('sb_profiles description'),
            mainsprites_class: "Profiles"
          },
          template:'popup_status.html'
        });
      });

      gnode.on('click_status.Cash',function(e) {
        gnode.openGenericPopup({
          data: {
            title: _._("sb_cash title"),
            subtitle: _.sprintf(_._('sb_cash subtitle <span class="highlight">$%s</span>'), _.toKSNum(gnode.cash_value)),
            description: _._('sb_cash description'),
            mainsprites_class: "Cash"
          },
          template:'popup_status.html'
        });
      });

      gnode.on('click_status.AP',function(e) {
        gnode.openGenericPopup({
          data: {
            title: _._("sb_AP title"),
            subtitle: _.sprintf(_._('sb_AP subtitle %s/%s'), _.span(_.toKSNum(gnode.ap_value)), _.span(_.toKSNum(gnode.xp_level.ap_max))),
            description: _._('sb_AP description'),
            mainsprites_class: "AP"
          },
          template:'popup_status.html'
        });
      });

      gnode.on('click_status.XP',function(e) {
        gnode.openGenericPopup({
          data: {
            title: _._("sb_XP title"),
            subtitle: _.sprintf(_._('sb_XP subtitle Level %s'), _.span(_.toKSNum(gnode.xp_level.number))),
            description: _.sprintf(_._('sb_XP description %s XP until next level'), _.span(_.toKSNum(gnode.xp_level.xp_max - gnode.xp_value + 1))),
            mainsprites_class: "XP"
          },
          template:'popup_status.html'
        });
      });

      gnode.on('new_items',function(e,data) {
        e.stopPropagation();
        gnode.makeNotifications(data);
      });
    };

    GameRoot.prototype.getParentTypes = function(gestalt) {
      // returns the type_data of all perps where gestalt is provided
      var types = _.filter(this.typeRegistry, function(t){ return _.contains(t.type_data.provided_perps, gestalt); });
      if (types) {
        return types;
      } else {
        return {};
      }
    };

    GameRoot.prototype.getParentTypeData = function(gestalt) {
      // returns the type_data of a perp where gestalt is provided
      var type = _.find(this.typeRegistry, function(t){ return _.contains(t.type_data.provided_perps, gestalt); });
      if (type) {
        return type.type_data;
      } else {
        return {};
      }
    };
    
    GameRoot.prototype.getParentType = function(gestalt) {
      // returns the type_data of a perp where gestalt is provided
      var type = _.find(this.typeRegistry, function(t){ return _.contains(t.type_data.provided_perps, gestalt); });
      if (type) {
        return type;
      } else {
        return {};
      }
    };

    GameRoot.prototype.notification_level = 2;
    GameRoot.prototype.makeNotifications = function(data) {
      var gnode = this;
      var groot = this;
      var speed = 1;
      if (setup.debug) { speed = 0 }
      // Perp Notifications
      if (data.error) {
        var n = {};
        n.game_type = "Error";
        n.title = data.error.title;
        n.subtitle = data.error.subtitle;
        n.description = data.error.description;
        n.config = {
          template: 'lost_socket.html',
          extendClass: 'Alert',
          delay:0
        };
        gnode.cueNotification(n);
        /*
        //n.nonblocking = 2000;
        n.scriptedEvents = [];
        n.scriptedEvents.push(function(){
        });
        */
      }

      if (data.mission_complete) {
        var mission = groot.Missions.getMission(data.mission_complete);
        var n = mergeData({},mission.data);
        n.game_type = "MissionComplete";
        n.mission_decorator = _._('Mission complete!');
        n.states = mission.states;
        n.config = {
          template: 'popup_mission_complete.html',
          extendClass: 'Mission',
          delay:2500,
          delayScript:1000
        };
        n.scriptedEvents = [];
        n.scriptedEvents.push(function(){
          groot.renderNode.FXMissionComplete();
        });
        gnode.cueNotification(n);
      }
      if (data.mission_active) {
        var mission = groot.Missions.getMission(data.mission_active);
        n = mergeData({},mission.data);
        n.game_type = "MissionNew";
        n.states = mission.states;
        n.mission_decorator = _._('New Mission!');
        n.mission = mission;
        n.config = {
          template: 'popup_mission.html',
          extendClass: 'Mission'
        };
        /*
        n.scriptedEvents = [];
        n.scriptedEvents.push(function(){
          groot.renderNode.FXLevelUpBling(data.levelup);
        });
        */
        gnode.cueNotification(n);
      }
      if (data.levelup) {
        var n = {};
        n.game_type = "LevelUp";
        n.config = {
          template: 'levelup.html',
          extendClass: 'Tutorial',
          placeBottom: true,
          delay:1200
        };
        //n.nonblocking = 2000;
        n.scriptedEvents = [];
        n.scriptedEvents.push(function(){
          groot.renderNode.FXLevelUpBling(data.levelup);
        });
        gnode.cueNotification(n);
      }
      // FIXME: this turns off notifications during tutorials in general, currently only set by level
      //if (data.perps && groot.states.tutorial_active !== true && groot.xp_level.number > 2) {
      if (data.perps && groot.xp_level.number > groot.notification_level) {
        _.each(data.perps,function(gestalt){
          var n = {};
          n.config = n.config || {}
          n.config.extendClass = 'NewItems';
          var type = gnode.getType(gestalt);
          n.game_type = type.game_type;
          var tdata = gnode.getTypeData(gestalt);
          if (type && tdata && !getByGestalt(gestalt)) {
            var parentIsBuilt = false;
            var parentTypes = gnode.getParentTypes(gestalt);
            _.each(parentTypes, function(parentType){
              var parentTypeData = parentType.type_data;
              parentsBuilt = getAllByGestalt(parentType.gestalt).length;
              parentIsBuilt = (parentIsBuilt) ? parentIsBuilt : parentsBuilt > 0;
              n.perp = {data:tdata};
              n.title = tdata.ntitle;
              n.says = _._('Mark says:');
              if (parentTypeData && parentTypeData.title) {
                n.text = _.sprintf(tdata.ntext, _.span(parentTypeData.title));
                eachByGestalt(parentType.gestalt, function(v,k) {
                  if (v.renderNode) {
                    v.markNewItems();
                    v.checkProvidedByLevel();
                    v.checkProvidedByRequiredPerps();
                    v.highlightTabs = v.highlightTabs || [];
                    v.highlightTabs.push(n.game_type);
                  }
                });
              } else {
                n.text = _.sprintf(tdata.ntext, _.span(tdata.title));
              }
            });
            if (parentIsBuilt) {
              gnode.cueNotification(n);
            }
          }
        });
      }
      // Powerup Notifications
      // FIXME same as by perps
      //if (data.powerups && groot.states.tutorial_active !== true) {
      if (data.powerups && groot.xp_level.number > groot.notification_level) {
        // remap the response and prepare the types 'n' data.
        var pow_register = {};
        _.each(data.powerups,function(project_pows, projectgestalt){
          var project = getByGestalt(projectgestalt);
          if (project) {
            _.each(project_pows, function(powerup){
              var powgestalt = powerup.game_gestalt;
              if (!project.getType(powgestalt)) {
                project.addType(powgestalt,powerup);
              }
              var powerup_type = project.getType(powgestalt);
              if (!pow_register.hasOwnProperty(powerup.game_gestalt)) {
                pow_register[powerup.game_gestalt] = {};
              }
              var pow_reg = pow_register[powerup.game_gestalt];
              pow_reg.game_type = powerup_type.game_type;
              pow_reg.type_data = powerup_type.type_data;
              pow_reg.projects = pow_reg.projects || [];
              pow_reg.projects.push(project);
              pow_reg.projects = _.uniq(pow_reg.projects, true);
            });
          }
        });

        _.each(pow_register,function(pow_reg, powgestalt){
            var n = {};
            n.config = {
              extendClass: 'NewItems'
            };
            n.game_type = pow_reg.game_type;
            n.perp = { data: pow_reg.type_data };
            n.title = pow_reg.type_data.ntitle;;
            var projectstext = "";
            // add those decorators and make the projects notification text
            _.each(pow_reg.projects, function(project, k) {
              project.markNewItems();
              project.highlightTabs = project.highlightTabs || [];
              project.highlightTabs.push(n.game_type);
              var sep = (k < pow_reg.projects.length -1 ) ? ", " : "";
              projectstext = projectstext + project.data.title + sep;
            });
            n.says = _._('Mark says:');
            n.text = _.sprintf(pow_reg.type_data.ntext, _.span( projectstext ));
            // popup only if notification = true;
            if (pow_reg.type_data.notification) {
              gnode.cueNotification(n);
            }
        });
      }
      // Karmalizer Notification
      if (data.karma) {
        groot.compileProvidedKarma();
        var gestalt = data.karma.gestalt;
        var n = groot.getTypeData(gestalt);
        n.selectortitle = _._('Choose your counter measures');
        n.karma_dec = data.karma.dec;
        n.button = _._('Do nothing');
        n.config = {
          template: 'popup_karma.html',
          extendClass: 'Alert',
          delay:650
        };
        n.providedKarma = groot.data.providedKarma;
        var type = gnode.getType(gestalt);
        n.game_type = type.game_type;
        gnode.cueNotification(n);
      }

      // Simplemessage
      if (data.simplemessage) {
        var n = {};
        n.game_type = "Story";
        n.button = _._('Next');
        n.description = data.simplemessage.text;
        n.says = _._('Mark says:');
        n.config = {
          template: 'notification_tutorial.html',
          extendClass: 'Tutorial',
          placeBottom: true,
          delay:0,
        };
        gnode.cueNotification(n);
      }

      // Tutorials and Missions
      if (data.story && data.storyPerp) {
        var n = {};
        n.game_type = "Story";
        n.button = _._('Next');
        n.description = data.story.text;
        n.says = _._('Mark says:');
        n.scriptedEvents = [];
        n.scriptedEvents.push(function() {
          groot.trigger('switch_view',[data.storyPerp.ViewMap.id]);
          groot.activeView.renderNode.scrollTo(data.storyPerp.renderNode.getPosition(),1000);
        });
        n.config = {
          template: 'notification_tutorial.html',
          extendClass: 'Tutorial',
          placeBottom: true,
          delay:0,
        };
        gnode.cueNotification(n);
      }
      if (data.tutorial) {
        _.each(data.tutorial,function(tutorial){
          var n = tutorial;
          n.button = _._('Next');
          n.says = _._('Mark says:');
          n.config = {
            template: 'notification_tutorial.html',
            extendClass: 'Tutorial',
            placeBottom: true,
            delay:600 * speed,
            delayScript:0
          };
          n.game_type = "Tutorial";
          // TODO: handle/compile scripted events
          // n.buyPerp
          // n.buyParent
          // n.buyPerpPos
          // n.viewmap
          // n.viewmapPos
          // n.integrateProfileSet
          var doadd = true;
          // TODO: make sequence and add delays to actions.
          // TODO: do not queue notifications with scripts already done.
          n.scriptedEvents = [];
          if (n.viewmap) {
            n.config.delay = 0;
            // FIXME: Hack for CMS fail
            n.scriptedEvents.push(function() {
              if (n.viewmap === "empire001") { n.viewmap = "Imperium"; }
              if (n.viewmap === "database001") { n.viewmap = "Database"; }
              groot.trigger('switch_view',[n.viewmap]);
            });
          }
          if (n.viewmapPos) {
            n.config.delay = (n.nodelay) ? 500 : 1000;
            n.config.delay *= speed;
            n.scriptedEvents.push(function() {
              groot.activeView.renderNode.scrollTo({x:n.viewmapPos.x,y:n.viewmapPos.y},1000);
            });
          }
          if (n.buyPerp && n.buyParent) {
            var buyPerp = getByGestalt(n.buyPerp);
            if (!buyPerp) {
              n.config.delay = (n.nodelay) ? 500 : 3000;
              n.config.delay *= speed;
            } else {
              n.config.delay = 650;
              n.config.delay *= speed;
            }
            n.scriptedEvents.push(function() {
              var parentNode = getByGestalt(n.buyParent);
              if (parentNode) {
                if (parentNode.renderNode.DecoratorNew) { parentNode.renderNode.DecoratorNew.remove(); }
                var buyPerp = getByGestalt(n.buyPerp);
                if (!buyPerp) {
                  buyPerp = parentNode.BuyPerp(n.buyPerp,n.buyPerpPos);
                } else {
                  groot.activeView.renderNode.scrollTo({
                    x: buyPerp.renderNode.getPosition().x,
                    y: buyPerp.renderNode.getPosition().y - 40
                  });
                }
              }
            });
          }
          if (n.integrateProfileSet) {
            n.config.delay = (n.nodelay) ? 500 : 5000;
            n.config.delay *= speed;
            n.scriptedEvents.push(function() {
              var ps = _.find(groot.getDatabase().queue.set, function(ps){ return ps.origin.gestalt === "city002" });
              if (ps) { groot.getDatabase().mergeCued(ps.psid); }
            });
          }
          gnode.cueNotification(n);
        });
      }

      // sort em by type!
      var sort_types = [
        'Error',
        'Story',
        'MissionComplete',
        'LevelUp',
        'Tutorial',
        'Karmalizer',
        'CityPerp',
        'ProxyPerp',
        'ProjectPerp',
        'AgentPerp',
        'ContactPerp',
        'PusherPerp',
        'ClientPerp',
        'TokenPerp',
        'UpgradePowerup',
        'AdPowerup',
        'TeamMemberPowerup',
        'MissionNew'
      ];
      gnode.NotificationQueue = _.sortBy(gnode.NotificationQueue, function(ni){
        return sort_types.indexOf(ni.game_type);
      });
      if (gnode.NotificationQueue.length) {
        gnode.openNotification(gnode.NotificationQueue[0]);
      }
    };

    GameRoot.prototype.cueNotification = function(notification) {
      this.NotificationQueue.push(notification);
    };
 
    GameRoot.prototype.startNotificationQueue = function() {
    };


    GameRoot.prototype.uncueNotification = function(notification) {
      var index = this.NotificationQueue.indexOf(notification);
      if (index !== -1) {
        this.NotificationQueue.splice(index, 1);
      }
    };

    GameRoot.prototype.compileProvidedKarma = function() {
      var gnode = this;
      var groot = this;
      gnode.data.providedKarma = [];

      _.each(groot.getTypes('Karmalauter'),function(v,k){
        var karma = {};
        karma.data = v.type_data;
        karma.data.slot_background = gnode.data.slot_background;
        karma.gestalt = v.gestalt;
        // FIXME: lock level
        if (karma.data.required_level > groot.xp_level.number) {
          karma.locked = true;
        }
        gnode.data.providedKarma.push(karma);
      });
      gnode.data.providedKarma = _.sortBy(gnode.data.providedKarma, function(k){ return k.data.price; });
      return gnode.data.providedKarma;
    };


    GameRoot.prototype.BuyPerp = function(gestalt, placePos) {
      // Wrapper for misc Buy operations
      var gtype = this.getTypeFromGestalt(gestalt);
      if (gtype === "CityPerp") {
        var DBPerp = getByType('DatabasePerp');
        if (DBPerp.length) {
          DBPerp = DBPerp[0];
        } else {
          return;
        }
        return DBPerp.BuyCity(gestalt, placePos);
      } else if (gtype === "Karmalauter") {
        //console.log('buy a karma?',gestalt);
        return this.BuyKarma(gestalt);
      } else {
        //console.log('ERROR, computer says: can\'t buy',gestalt,gtype);
        this.Error('The computer says NOOOO',data);
      }
    };
    
    GameRoot.prototype.BuyKarma = function(bgestalt) {
      var gnode = this;
      var groot = this;
      
      app.remote.buyKarma(app.token, bgestalt).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            // Probably no cash
            if (gnode.renderPopup && gnode.renderPopup.open) {
              gnode.renderPopup.trigger('no_cash');
            } else {
              gnode.renderNode.FXNoCash();
            }
            return;
          }
          var karma_points = groot.getTypeData(bgestalt).karma_points;
          var karma_value = groot.karma_value;
          var karma_up = (karma_points + karma_value <= 100) ? karma_points : 100 - karma_value;
          if (gnode.renderPopup) { 
            gnode.renderPopup.trigger('popup_close'); 
            groot.renderNode.FXKarmaBling(karma_up);
          }
          if (gnode.notificationPopup) { 
            gnode.notificationPopup.trigger('popup_close'); 
            groot.renderNode.FXKarmaBling(karma_up);

          }
          //TODO: Karma Up Animation?
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
        } else if (data.result && data.result.error) {
          if (popup) {
            popup.trigger('error');
          } 
        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };

    GameNode.prototype.openGenericPopup = function(config) {
      var gnode = config.gnode || this;
      var groot = this.GameRoot;
      var config = config || {};
      var data = config.data || gnode.data;

      gnode.popupTemplateData = {};
      gnode.popupTemplateData.status_icons = gnode.GameRoot.data.status_icons;
      gnode.popupTemplateData.states = config.states || {};
      gnode.popupTemplateData.data = data;
      //gnode.popupTemplateData.data.gestalt = 'Database';
      //gnode.popupTemplateData.data.id = this.id;
      gnode.popupTemplateData.groot = groot;
      gnode.popupTemplateData.data = data;

      var popupConfig = {
        gameNode: this,
        template: config.template || 'popup.html',
        extendClass: config.extendClass || "",
        templateData: gnode.popupTemplateData,
        popupContainer: this
      };

      var popup = this.renderPopup = new Render.Popup(popupConfig);

      gnode.renderNode.addPopup(popup);

      gnode.initPopupEvents();
      

      /*
      popup.on('button_click.MainButton',function(e) {
        e.stopPropagation();
        popup.close();
      });

      popup.on('popup_close',function(e) {
        e.stopPropagation();
        popup.close();
        delete gnode.renderPopup;
      });
      */

      return popup;
    };



    GameRoot.prototype.openNotification = function(notification) {
      var gnode = this;
      var groot = this;
      var config = notification.config || {};
      if (groot.notificationPopup) { return; }
      var popupTemplateData = {};
      popupTemplateData.status_icons = gnode.GameRoot.data.status_icons;
      popupTemplateData.states = notification.states || {};
      popupTemplateData.data = notification || {};
      popupTemplateData.data.id = this.id;
      popupTemplateData.groot = groot;

      config.template = config.template || 'notification.html';
      config.templateData = popupTemplateData;
      config.popupContainer = this;

      var popup = gnode.notificationPopup = new Render.Popup(config);
      //gnode.lock();

      window.setTimeout(function(){
        if (notification.scriptedEvents && notification.scriptedEvents.length) {
          _.each(notification.scriptedEvents,function(s){
            s();
          });
        }
      }, config.delayScript || 0);

      window.setTimeout(function(){
        gnode.renderNode.addPopup(popup);
        gnode.initPopupEvents(popup);
      }, config.delay || 0);
      
      popup.callback = function(){
        groot.uncueNotification(notification);
        delete groot.notificationPopup;
        if (groot.NotificationQueue.length) {
          gnode.openNotification(groot.NotificationQueue[0]);
        }
      };

      if (notification.nonblocking) {
        window.setTimeout(function(){
          popup.trigger('popup_close');
        }, notification.nonblocking);
      }
      return popup;
    };


    GameRoot.prototype.toggleFullScreen = function() {
      var groot = this;
      if (groot.fullScreenOn || groot.fullScreenOn === undefined) {
        var width = $(window).width();
        var height = $(window).height();
        groot.setSize(width-32,height-64);
        groot.fullScreenOn = false;
      } else {
        groot.setSize(groot.data.width,groot.data.height);
        groot.fullScreenOn = true;
      }
    };

    GameRoot.prototype.setSize = function(width,height) {
      width = width || this.renderNode.width;
      height = height || this.renderNode.height;
      var maxwidth = this.getImperium().renderNode.width;
      var maxheight = this.getImperium().renderNode.height;
      width = (width > maxwidth) ? maxwidth : width;
      width = (width < this.data.width) ? this.data.width : width;
      height = (height > maxheight) ? maxheight : height;
      height = (height < this.data.height) ? this.data.height : height;
      this.renderNode.setSize({
        width:width,
        height:height
      });
      this.renderMenu.setSize({
        width:width
      });
      this.renderStatusbar.render();
      this.getDatabase().renderDBQueue.render();
    };

    GameRoot.prototype.initStatusBar = function() {
      this.data.status_bar.gameNode = this;
      this.updateStatusBarValues();
    };

    GameRoot.prototype.setLevel = function(levelnum, nolevelup) {
      var lvl;
      if (levelnum) {
        lvl = this.getLevel(levelnum);
      } else {
        lvl = this.getLevel();
      }
      if (lvl !== this.getLevelByXP(this.xp_value)) {
        this.xp_value = lvl.xp_min;
      }
      this.xp_level = lvl;
      APTicker.interval = lvl.ap_inc_interval;
      if (!nolevelup) { 
        APTicker.reset(); 
      }
      this.setAP();
      this.setXP();
      return this.xp_level;
    };

    GameRoot.prototype.getLevel = function(level) {
      if (level) {
        return this.data.levels[level-1];
      } else {
        return this.data.levels[this.data.game_values.xp_level-1];
      }
    };
    GameRoot.prototype.getLevelByXP = function(xp) {
      if (!xp) { return {}; }
      var level = _.find(this.data.levels,function(lvl){
        return ((xp >= lvl.xp_min) && (xp <= lvl.xp_max));
      });
      return level;
    };


    GameRoot.prototype.APTick = function() {
      if (this.xp_level.ap_max > this.ap_value) {
        this.ap_value += this.xp_level.ap_inc_value;
        this.setAP();
        // Remove No-AP decorators
        this.renderNode.jdomelem.find('.Popup .no_AP').removeClass('no_AP disabled active');
      }
    }

    GameRoot.prototype.updateStatusBarValues = function() {
      // Map and evantually crunch game_values to statusbar values, without rendering
      this.setProfiles();
      this.setCash();
      this.setAP();
      this.setKarma();
      this.setXP();
    };

    GameRoot.prototype.initGameValues = function() {
      var gnode = this;
      var gv = this.data.game_values; // FIXME: Added var; check for side-effects
      this.ap_value = gv.ap_initial;
      this.ap_offset = gv.ap_offset;
      this.profiles_value = gv.profiles_value;
      this.profiles_max = gv.profiles_max;
      this.cash_value = gv.cash_value;
      this.karma_value = gv.karma_value;
      this.karma_max = 100;
      this.xp_value = gv.xp_value;
      this.setLevel(gv.xp_level, true);
      APTicker.addListener(this);
      APTicker.start(this.ap_offset);
    };

    GameRoot.prototype.updateGameValues = function(game_values,levelup,missions,silent) {
      var groot = this;
      var gv = game_values;
      if (missions) {
          groot.Missions.updateMissions(missions, game_values);
          // FIXME: TESTING when mission completed, do not yet update game_values
          //silent = true;
      }
      if (gv.profiles_max !== undefined) {
        groot.profiles_max = gv.profiles_max;
      }
      if (gv.profiles_value !== undefined && gv.profiles_value !== groot.profiles_value) {
        groot.setProfiles(gv.profiles_value,silent);
      }
      if (gv.cash_value !== undefined && gv.cash_value !== groot.cash_value) {
        groot.setCash(gv.cash_value,silent);
      }
      if (gv.ap_increment) {
        groot.useAP(gv.ap_increment,silent);
      }
      if (gv.karma_value !== undefined && gv.karma_value !== groot.karma_value) {
        groot.setKarma(gv.karma_value,silent);
      }
      if (gv.xp_value !== undefined) {
        groot.setXP(gv.xp_value,silent);
      }
      // levelup
      if (gv.ap_snapshot !== undefined && levelup === true) {
        groot.setAP(gv.ap_snapshot,silent);
        if (!silent) {
          groot.getDatabase().checkNotifications();
          groot.makeNotifications({levelup: groot.xp_level.number});
        }
      }
    };

    GameRoot.prototype.useAP = function(inc) {
      this.setAP(this.ap_value + inc);
    };

    var sb; // Added declaration; check for side-effects
    GameRoot.prototype.setAP = function(num,silent) {
      if (num !== undefined) {
        this.ap_value = num;
      }
      if (this.ap_value > this.xp_level.ap_max) {
        this.ap_value = this.xp_level.ap_max;
      }
      sb = this.data.status_bar;
      // Only clip AP display: internally it can be -1 since that's the server's bonus
      var clipap = (this.ap_value < 0) ? 0 : this.ap_value
      sb.AP.val = (this.ap_value < 0) ? 0 : this.ap_value;
      sb.AP.max = this.xp_level.ap_max;
      sb.AP.barsize = Math.round((sb.AP.val/this.xp_level.ap_max)*120);
      if (this.renderStatusbar && !silent) { this.renderStatusbar.FXUpdateAP(); }
    };

    GameRoot.prototype.setCash = function(num,silent) {
      if (num !== undefined) {
        this.cash_value = num;
      }
      sb = this.data.status_bar;
      sb.cash.val = this.cash_value;
      sb.cash.barsize = Math.round((this.cash_value/this.cash_max)*120);
      if (this.renderStatusbar && !silent) { this.renderStatusbar.FXUpdateCash(); }
    };

    GameRoot.prototype.setProfiles = function(num,silent) {
      if (num !== undefined) {
        this.profiles_value = num;
      }
      if (this.profiles_value > this.profiles_max) {
        this.profiles_value = this.profiles_max;
      }
      sb = this.data.status_bar;
      sb.profiles.val = this.profiles_value;
      sb.profiles.max = this.profiles_max;
      sb.profiles.barsize = Math.round((this.profiles_value/this.profiles_max)*120);
      sb.profiles.crosssum = this.getDBTokensCrossSum();
      this.getDBTokensLength();
      sb.profiles.tokenslength = this.DBTokensLength;
      sb.profiles.tokenslengthmax = this.DBTokensLengthMax;
      if (this.renderStatusbar && !silent) { this.renderStatusbar.FXUpdateProfiles(); }
    };

    GameRoot.prototype.setKarma = function(num,silent) {
      // FIXME TEST values
      //num = 33;
      if (num !== undefined) {
        this.karma_value = num;
      }
      if (this.karma_value > this.karma_max) {
        this.karma_value = this.karma_max;
      }
      if (this.karma_value < -this.karma_max) {
        this.karma_value = -this.karma_max;
      }

      sb = this.data.status_bar;
      sb.karma.val = this.karma_value;
      sb.karma.max = this.karma_max || 100;
      //var val_center = 50 - this.karma_value;
      //FIXME: set to correct level not 50;
      sb.karma.barsize = Math.round((this.karma_value/this.karma_max)*59);
      if (this.renderStatusbar && !silent) { this.renderStatusbar.FXUpdateKarma(); }
    };

    GameRoot.prototype.setXP = function(num,silent) {
      if (num !== undefined) {
        if (num > this.xp_value) {
          this.xp_value = num;
        }
      }
      if (this.xp_value > this.xp_level.xp_max) {
        this.setLevel(this.getLevelByXP(this.xp_value).number);
      }
      if (this.xp_value < this.xp_level.xp_min) {
        this.setLevel(this.getLevelByXP(this.xp_value).number);
      }
      sb = this.data.status_bar;
      sb.XP.val = this.xp_value;
      sb.XP.level = this.xp_level.number;
      sb.XP.barsize = Math.round(((this.xp_value - this.xp_level.xp_min) / (this.xp_level.xp_max - this.xp_level.xp_min)) * 96);
      if (this.renderStatusbar && !silent) { this.renderStatusbar.FXUpdateXP(); }
    };


    ///////////////////////////////////////
    // Loading a Game happens here:
    //////////////////////////////////////

    GameRoot.prototype.loadGame = function(data) {
      // Clear if there are instances in the singleton
      clear();
      // Initialize the Game with self (reminder: there should only be one GameRoot!)
      var game = this;
      game.APTicker = APTicker;

      if (setup.debug) {
        app.Game = Game;
      }

      // Register all types (applies to all game_types)
      _.each(data.type_registry,function(v,k){
        game.addType(k,v);
      });

      // Register dummy gestalt of GameRoot (needed for type_settings):
      game.addType('GameRoot',{
        game_type: 'GameRoot',
        type_data: data.type_data || {}
      });
      game.addType('ProfileSet',{
        game_type: 'ProfileSet',
        type_data:{}
      });


      // Basic config of the GameRoot
      var config = {
        "id": data._id,
        "userdata": data.user,
        "raw_data": data,
        "data": mergeData(game.getTypeData('GameRoot'),data),
        "gameType": "GameRoot"
      };
      this.init(config);

      this.initGameValues();

      this.makeRenderConfig();


      // Make Main Tabs
      _.each(['Imperium', 'Database'],function(v){
        game.addType(v,{
          game_type: v,
          type_data: data[v].type_data || {}
        });
        var viewmap = new Game[v]({
          "id": data[v].game_id,
          "path": data[v].full_path,
          "data": mergeData(game.getTypeData(v),data[v].instance_data),
          "renderNodeParent": game.id,
          "gameType" : v
        });
        game[v] = viewmap;
        game.addChild(viewmap);
      });

      // Make Missions Tab
      game.addType('Missions',{
        game_type: 'Missions',
        type_data: {}
      });
      var viewmap = new Game.Missions({
        "id": "Missions",
        "data": game.getTypeData('Missions'),
        "renderNodeParent": game.id,
        "gameType" : 'Missions'
      });
      game.Missions = viewmap;
      game.addChild(viewmap);

      // Make Topscores Tab
      game.addType('Topscores',{
        game_type: 'Topscores',
        type_data: {}
      });
      game.addType('Topscore',{
        game_type: 'Topscore',
        type_data: {}
      });

      topscores = new Game.Topscores({
        "id": "Topscores",
        "data": game.getTypeData('Topscores'),
        "renderNodeParent": game.id,
        "gameType" : 'Topscores'
      });
      game.Topscores = topscores;
      game.addChild(topscores);
      _.each(topscores.data.type_titles, function(title,type){
        topscores.initTopscore(type);
      });

      // Fill DBTokens lookup table
      _.each(_.where(game.raw_data.nodes,{game_type:"TokenPerp"}),function(t){
        game.DBTokens[t.gestalt] = t.instance_data.amount;
      });

      game.getDBTokensLength();
      game.getDBTokensLengthMax();

      // Create Imperium and Database GameNode Tree Structure without recursion
      var sortnodes = _.sortBy(data.nodes, function(elem){return elem.full_path;});

      // exclude origin tokens
      sortnodes = _.filter(sortnodes, function(n){ if (n.gestalt) { return n.gestalt.substring(0,6) !== 'origin'; } else { return true; }  });

      _.each(sortnodes, function(datanode,k) {
        var parentGameNode = getParentFromPath(datanode.full_path);
        // get gestalt from full_type if not available:
        if (!datanode.gestalt) {
          datanode.gestalt = getGestalt(datanode.full_type);
        }
        // register dummy type when node not in typeRegistry:
        if (!game.getType(datanode.gestalt)) {
          game.addType(datanode.gestalt, {
            game_type: datanode.game_type,
            type_data: datanode.type_data
          });
        }
        var type_data = game.getTypeData(datanode.gestalt);
        var node_data = mergeData(type_data,datanode.instance_data);
        var perp = new Game[datanode.game_type]({
              "id": datanode.game_id,
              "gestalt": getGestalt(datanode.full_type),
              "path": datanode.full_path,
              "data": node_data,
              // Render perps to first item in path (Imperium or Database)
              "renderNodeParent": getFirstId(datanode.full_path),
              "ViewMap": getByFirstId(datanode.full_path),
              "parentNode": parentGameNode,
              "gameType": datanode.game_type
        });
        parentGameNode.addChild(perp);
      });

      _.each(data.nodes_charging, function(v) {
        var gnode = getByLastId(v.path);
        var timerconf = {
          serverTime: game.raw_data.server_time.$date,
          duration: gnode.data.charge_time,
          serverStart: gnode.data.charge_start.$date
        };
        gnode.setAttrs({_loadTimer: timerconf});
      });

      _.each(data.nodes_collect, function(v) {
        var gnode = getByLastId(v.path);
        gnode.setAttrs({_loadReady: true});
      });

      // register Missions...
      game.Missions.initMissions(data);

      _.each(data.db_queue, function(v) {
        game.getDatabase().cue(v.profile_set,v.origin,v.collect_id);
      });

      // register Karmalizers and Karmalauters...
      _.each(data.karmalauters,function(p,key){
        game.addType(p.type_data.gestalt,p);
      });
      _.each(data.karmalizers,function(p,key){
        game.addType(p.type_data.gestalt,p);
      });


      // compile origin tokens for Database
      game.compileOriginTokens(data.nodes);

      game.on('after_render', function(){
        game.renderNode.show();
        AniTicker.start();
      });
      game.on('before_render', function(){
        game.renderNode.hide();
      });

      game.render();

      // Visual FIX, when new_game scroll to top
      if (data.is_new_game) {
        game.getImperium().renderNode.scrollTo({x:1024,y:0},0);
      }


      app.socket.queue.start();

      return game;
    };


    GameRoot.prototype.getImperium = function() {
      // FIXME: this is just a wrapper
      return this.Imperium;
    };

    GameRoot.prototype.getDatabase = function() {
      // FIXME: this is just a wrapper
      return this.Database;
    };

    ///////////////////////////////////
    // The ProfileSet
    ///////////////////////////////////

    var ProfileSet = function(config,tokens) {
      // Used both as Template and cued Object in DBQueue
      this.init(config);
      var gnode = this;
      var groot = this.GameRoot;

      tokens = _.clone(tokens);
      this.data = groot.getTypeData("ProfileSet");
      var filter_is_query = this.filter_is_query;
      
      if (this.convertTokens) {
        _.each(tokens, function(t,k){
           tokens[k] = { gestalt: t };
        });
      }

      this.tokens_map = {};
      this.tokens_set = [];
      var addtokens = [];
      // Check if tokens is object with keys or array
      if (tokens.length === undefined && gnode.origin) {
        // Asuming its a token_map from the queue or collect
        // FIXME: this messes with sorting, either we use a kind of sort key, or backend can give me an array!
        _.each(tokens.tokens_map, function(v,k){
          var addme = {
            gestalt:k,
            amount:v.amount,
            // collect_amount is profiles value here
            collect_amount:gnode.profiles_value
          };
          // exclude origin tokens
          if (addme.gestalt.substring(0,6) !== 'origin') {
            addtokens.push(addme);
          }
        });
        this.tokens_map = tokens.tokens_map;
      } else {
        // Asuming its from the source perp
        // exclude origin tokens
        addtokens = _.filter(tokens, function(n){ if (n.gestalt) { return n.gestalt.substring(0,6) !== 'origin' } });
        if (config.filter_is_query) {
          var is_query = (filter_is_query==="blue");
          addtokens = _.filter(tokens, function(n){ { return n.is_query === is_query  } });
        }
      }

      // We build and extend the token_set
      _.each(addtokens,function(token,k){
        // don't mess with the original data
        var t = _.extend({}, token);
        t.data = groot.getTypeData(token.gestalt);
        if (gnode.DBAmounts) {
          t.database_amount = groot.DBTokens[token.gestalt] || 0;
          t.database_absoluteAmount = groot.DBTokensAbsolute[token.gestalt] || 0;
        }
        if (gnode.markNew) {
          if (!groot.DBTokens.hasOwnProperty(token.gestalt)) {
            t.new = true;
          }
        } 
        if (gnode.lockAmountZero && token.amount === 0) {
          t.locked = true;
        }
        if (gnode.lockNotInDB && !groot.DBTokens.hasOwnProperty(token.gestalt)) {
          t.locked = true;
        }
        if (gnode.markUpgradeValues && gnode.lastUpgradeValues && !t.locked) {
          var lastProfileValues = gnode.lastUpgradeValues.profiles_value;
          var lastAmount = gnode.lastUpgradeValues.token_map[t.gestalt] || 0;
          var lastAbsoluteAmount = (lastProfileValues * lastAmount) / 100;
          var currentAbsoluteAmount = gnode.GameRoot.DBTokensAbsolute[t.gestalt];
          t.diffAbsoluteAmount = currentAbsoluteAmount - lastAbsoluteAmount;
          t.doneAbsoluteAmount = t.database_absoluteAmount - t.diffAbsoluteAmount;
          t.diffAmount = 100 / (groot.profiles_value / t.diffAbsoluteAmount);
          t.doneAmount = t.database_amount - t.diffAmount;
        } else if (gnode.markUpgradeValues && !gnode.lastUpgradeValues && !t.locked) {
          t.diffAbsoluteAmount = groot.DBTokensAbsolute[token.gestalt] || 0;
          t.diffAmount = groot.DBTokens[token.gestalt] || 0;
          t.doneAmount = 0;
          t.doneAbsoluteAmount = 0;
        }


        // FIXME: Show origin data for debug reasons only
        if (token.origin_gestalt) {
          t.data = groot.getTypeData(token.origin_gestalt);
        }
        if (t.data) {
          gnode.tokens_set.push(t);
        }
      });
      // sort when locked tokens are marked

      if (gnode.lockAmountZero || gnode.lockNotInDB || 0 === 0) {
        var sorted = gnode.tokens_set;
        // FIXME: sortBy Gestalt for messed up TokenSets from CMS/Backend (DBQueue and Clients)
        if (gnode.sortByGestalt) { 
          sorted = _.sortBy(gnode.tokens_set, function(t){ return t.gestalt; });
        }
        var grouped = _.groupBy(sorted, function(t){
          return (t.locked) ? 1 : 0 ;
        });
        gnode.tokens_set = _.flatten(grouped);
        /*
        gnode.tokens_set = _(gnode.tokens_set).sortBy(function(t,k){
          if (t.locked) {
            return k+gnode.tokens_set.length;
          }  
          else {
            return k;
          }
        });
        */
      }

      return this;
    };
    extend(ProfileSet, GameNode);


    ProfileSet.prototype.updateNewMarker = function(){
      var ps = this;
      var groot = this.GameRoot;
      _.each(ps.tokens_set,function(token){
        if (!groot.DBTokens.hasOwnProperty(token.gestalt)) {
          token.new = true;
        } else {
          token.new = false;
        }
      });
      if (ps.popupTemplateData) { ps.popupTemplateData.ProfileSet = ps };
    };

    ///////////////////////////////////
    // The Imperium
    ///////////////////////////////////

    var Imperium = function(config) {
      this.init(config);
      this.ViewMap = this;
      return this;
    };

    extend(Imperium, GameNode);

    Imperium.prototype.renderType = "ViewMap";

    Imperium.prototype.extendRender = function() {
      this.setState('active',true);
      // FIXME: name should be in data
      //this.GameRoot.renderMenu.addButton(this.renderData.config.name, this.id, this.states);
      this.GameRoot.renderMenu.addButton(_._('My Empire'), this.id, this.states);
    };

    Imperium.prototype.lock = function() {
      this.renderNode.lock();
    };

    Imperium.prototype.unlock = function() {
      this.renderNode.unlock();
    };

    ///////////////////////////////////
    // The Database
    ///////////////////////////////////

    var Database = function(config) {
      gnode = this;
      groot = this.GameRoot;
      this.ViewMap = this;
      this.queue = new Set();
      this.init(config);

      return this;
    };
    extend(Database, GameNode);

    Database.prototype.renderType = "ViewMap";

    Database.prototype.compileSuperTokens = function() {
      var gnode = this;
      var groot = this.GameRoot;
      // FIXME create buyable supertokens for DB
      gnode.data.providedPerps = [];
      gnode.data.buyToken_xp_level_min = 99999;
      var buyable = _.filter(groot.typeRegistry,function(v){ 
        if (v.type_data.is_buyable) {
          gnode.data.buyToken_xp_level_min = (v.type_data.required_level < gnode.data.buyToken_xp_level_min) ? v.type_data.required_level : gnode.data.buyToken_xp_level_min;
        }
        return v.type_data.is_buyable && !groot.DBTokens.hasOwnProperty(v.gestalt);
      });
      _.each(buyable,function(t){
        var provided = {};
        //provided.locked = _.find(gnode.data.buyablePerps,function(v){ return v === t.gestalt }) === undefined;
        provided.gestalt = t.gestalt;
        provided.data = mergeData({},groot.getTypeData(t.gestalt));
        provided.data.requiredTokens= [];
        provided.locked = false;

        _.each(provided.data.contained_tokens,function(v,k){
          if (v.is_required === true) {
            provided.data.requiredTokens.push(groot.getType(v.gestalt));
            // check if all required tokens are there, else set to locked
            if (!groot.DBTokens.hasOwnProperty(v.gestalt)) {
              provided.locked = true;
            } else if (groot.DBTokens[v.gestalt] === 0) {
              provided.locked = true;
            }
          }
        });
        if (provided.data.required_level > groot.xp_level.number) {
          provided.locked = true;
        }
        gnode.data.providedPerps.push(provided);
      });
      var sorted = _.sortBy(gnode.data.providedPerps, function(v){ return v.data.required_level; });
      var grouped = _.groupBy(sorted, function(v){
        return (v.locked) ? 1 : 0 ;
      });
      gnode.data.providedPerps = _.flatten(grouped);
    }

    Database.prototype.openUpgradesPopup = function() {
      var gnode = this;
      // Popup instantiated for the first time
      if (!gnode.popupTemplateData) {
        gnode.popupTemplateData = {};
        gnode.popupTemplateData.status_icons = gnode.GameRoot.data.status_icons;
        gnode.popupTemplateData.states = {};
        gnode.popupTemplateData.data = gnode.data;
        gnode.popupTemplateData.data.gestalt = 'Database';
        gnode.popupTemplateData.data.id = this.id;
        gnode.popupTemplateData.data.title = _._("database_buytokens title");
        gnode.popupTemplateData.data.subtitle = _._("database_buytokens subtitle");
        gnode.popupTemplateData.data.description = _._("database_buytokens description");
        gnode.popupTemplateData.data.selectortitle = _._("database_buytokens selector title");
        gnode.popupTemplateData.data.mainsprites_class = "DBUpgrade";
        gnode.popupTemplateData.groot = gnode.GameRoot;
      }
      gnode.popupTemplateData.data = gnode.data;

      var popupConfig = {
        gameNode: this,
        template: 'popup.html',
        templateData: gnode.popupTemplateData,
        popupContainer: this
      };

      var popup = this.renderPopup = new Render.Popup(popupConfig);

      gnode.renderNode.addPopup(popup);

      gnode.initPopupEvents();

      return popup;
    };

    Database.prototype.BuyPerp = function(bgestalt, placePos) {
      return this.BuyToken(bgestalt,placePos);
    }

    Database.prototype.BuyToken = function(bgestalt, placePos) {
      // Buy Supertokens
      var gnode = this;
      var groot = this.GameRoot;
      app.remote.buyPerp(app.token, gnode.path, bgestalt).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            // Probably no cash
            if (gnode.renderPopup && gnode.renderPopup.open) {
              gnode.renderPopup.trigger('no_cash');
            } else {
              gnode.renderNode.FXNoCash();
            }
            return;
          }
          if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }
          if (data.result.node) {
            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
            var node = data.result.node
            var node_data = groot.getTypeData(bgestalt);
            var perp = new Game[node.game_type]({
              "id": node.game_id,
              "gestalt": bgestalt,
              "path": node.full_path,
              noConnect:true,
              "data": mergeData(node_data,node.instance_data),
              // Render perps to first item in path (Imperium or Database)
              "renderNodeParent": getFirstId("Database"),
              "ViewMap": getByFirstId("Database"),
              "gameType":node.game_type
            });
            gnode.addChild(perp);

            var perpNode = gnode.renderNode;
            var viewMap = getByFirstId("Database").renderNode;
            var placePos = placePos || { 
              x: viewMap.width/2,
              y: viewMap.height/2
            };
            if (perp.data.contained_tokens.length) {
              var firstContained = _.findWhere(perp.data.contained_tokens, {is_required:true});
              if (firstContained) {
                var placeNear = getByGestalt(firstContained.gestalt);
                placePos = placeNear.renderNode.getPosition();
              }
            }
            perp.renderData.config.placeRandom = placePos;
            perp.renderData.config.hidden = true;

            perp.render();
            perp.renderNode.addDecorator(new Render.DecoratorNew({text: _._("New!"), extendClass: "NewPerp"}));
            perp.renderNode.hide();
            perp.renderNode.parentNode.scrollTo(perp.renderNode.getPosition());
            groot.trigger('saveCoords', [perp.path, perp.renderNode.getPosition()]);
            window.setTimeout(function(){
              perp.renderNode.FXArise(function(){
                  perp.renderNode.FXBounce(); 
              });
            },300);
            // save coords to backend
          } 
        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };

    Database.prototype.extendRender = function() {
      // FIXME: name should be in data
      //this.GameRoot.renderMenu.addButton(this.renderData.config.name, this.id,this.states);
      this.GameRoot.renderMenu.addButton(_._('Database'), this.id,this.states);
      this.compileSuperTokens();
      this.renderDBQueue = new Render.DBQueue({data:this.data,queue:this.queue});
      this.renderDBQueue.gameNode = this;
      this.renderNode.addChild(this.renderDBQueue,true);
    };

    Database.prototype.lock = function() {
      // TODO: Lock Profileset Queue etc...
      this.renderNode.lock();
    };

    Database.prototype.unlock = function() {
      // TODO: Unlock Profileset Queue etc...
      this.renderNode.unlock();
    };

    Database.prototype.cue = function(profileset,path,collect_id) {
      // Add a ProfileSet to the DB queue
      // profileset has profiles_value (num) and token_map object with gestalt ids containing token amount
      // path refers to the origin object
      var ps = new ProfileSet({
        psid: collect_id,
        origin: getByLastId(path),
        profiles_value:profileset.profiles_value,
        markNew: true,
        sortByGestalt: true
      },profileset);

      var q = this.queue;
      q.prepend(ps);

      if (this.renderDBQueue) {
        this.renderDBQueue.render();
      }
      return ps;
    };

    Database.prototype.getToken = function(gestalt) {
      return _.findWhere(this.children.set,{gestalt:gestalt});
    };

    Database.prototype.getCued = function(psid) {
      var queue = this.queue;
      var ps = _.findWhere(queue.set, {psid : psid});
      return ps;
    };

    Database.prototype.mergeCued = function(psid) {
      // Do the merging/integrate stuff
      var gnode = this;
      var groot = this.GameRoot;
      var ps = this.getCued(psid);
      var update_tokens = [];
      var new_tokens = [];
      var all_tokens;

      // TODO: backend api call goes here, check for AP and give feedback in renderer etc...
      //groot.useXP(1);


      if (groot.ap_value < 1) {
        if (gnode.renderPopup && gnode.renderPopup.open) {
          gnode.renderPopup.trigger('no_AP');
        } else {
          gnode.renderDBQueue.jdomelem.find('.selected').removeClass('selected');
          gnode.renderDBQueue.FXNoAP();
        }
        return;
      }

      app.remote.integrateCollected(app.token, psid).done(function(data) {
        if (data.result) {
          // FIXME returned error 0
          if (data.result.error !== undefined) {
            // No AP
            if (gnode.renderPopup && gnode.renderPopup.open) {
              gnode.renderPopup.trigger('no_AP');
            } else {
              gnode.renderDBQueue.jdomelem.find('.selected').removeClass('selected');
              gnode.renderDBQueue.FXNoAP();
            }
            return;
          }
          if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }
          // TODO game_values
          var gv = data.result.game_values;
          //groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions,true);
          groot.setProfiles(data.result.game_values.profiles_value,true);
          var profiles_increment = data.result.result.increment;
          var profiles_dup = data.result.result.dup;
          
          // FIXME: compile for checkNotifications
          //gnode.compileSuperTokens();
          gnode.checkNotifications();

          // exclude origin tokens
          all_tokens = _.filter(data.result.result.nodes, function(n){ if (n.gestalt) { return n.gestalt.substring(0,6) !== 'origin' } });

          // compile origin tokens
          groot.compileOriginTokens(data.result.result.nodes);

          // update all token amounts and renderNode if they already exist
          _.each(all_tokens, function(t){
            var ti = getById(t.game_id);
            if (ti) {
              ti.setAmount(t.instance_data.amount);
              var tir = Render.getById(t.game_id);
              if (tir && !ps.tokens_map.hasOwnProperty(t.gestalt)) { 
                //tir.DecoratorAmount.setAmount(t.instance_data.amount); 
                ti.updateRenderAmount();
              }
              //ti.updateGear();
            }
          });
          var triggerQueue = [];
          _.each(ps.tokens_map,function(v,gestalt){
            var token = gnode.getToken(gestalt);
            if (token) {
              // collect update tokens
              update_tokens.push(token);
            } else {
              // create new tokens
              var type = groot.getType(gestalt);
              if (type.game_type === "TokenPerp") {
                var token_instance = _.findWhere(all_tokens,{'gestalt':gestalt});
                if (token_instance) {
                  token = new Game.TokenPerp({
                    "id": token_instance.game_id,
                    "gestalt": gestalt,
                    "path": token_instance.full_path,
                    "data": mergeData(type.type_data,token_instance.instance_data),
                    // Render perps to first item in path (Imperium or Database)
                    "renderNodeParent": getFirstId("Database"),
                    "ViewMap": getByFirstId("Database"),
                    "gameType":type.game_type
                  });
                  gnode.addChild(token);
                  triggerQueue.push(token);
                  new_tokens.push(token);
                }
              }
            }
          });

          var delay = 250;
          var wait = 0;
          _.each(update_tokens,function(t,k){
            wait = wait + delay;
            //var text = "+" + _.toKSNum(t.data.absoluteIncPerc) + "%";
            var text = "+" + _.toKSNum(t.data.absoluteInc);
            window.setTimeout(function(){
              if (t.renderNode) {
                t.renderNode.FXWheee({psid: psid, isnew: false, text: text});
                //t.renderNode.DecoratorAmount.setAmount(); 
              }
            },wait);
          });
          delay = 250;
          if (new_tokens.length) {
            wait = 0;
          }
          _.each(new_tokens,function(t,k){
            wait = wait + delay;
            //var text = "+" + _.toKSNum(t.data.absoluteIncPerc) + "%";
            var text = "+" + _.toKSNum(t.data.absoluteInc);
            window.setTimeout(function(){
              t.render();
              t.renderNode.addDecorator(new Render.DecoratorNew({text: _._("New!"), extendClass: "NewToken"}));
              t.renderNode.hide();
              //t.renderNode.FXArise(function(){
              t.renderNode.FXWheee({psid: psid, isnew: true, text: text});
              //});
              // save coords to backend
              groot.trigger('saveCoordsQueue', [t.path,t.renderNode.getPosition()]);
            },wait);
          });

          gnode.renderDBQueue.FXMerge(psid,profiles_increment,profiles_dup,wait);

          // finally remove the ProfileSet GameNode
          gnode.queue.remove(ps);
          ps.remove();
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          groot.setProfiles();
          window.setTimeout(function(){
            _.each(triggerQueue,function(t){
              t.trigger('after_create');
            });

            gnode.checkNotifications();
            groot.updateGears();
          },500 + wait);
          window.setTimeout(function(){
          },8000);

          } else {
            gnode.Error('The computer says NOOOO',data);
          }
        });
    };

    // TODO: Move this to GameRoot
    GameRoot.prototype.updateGears = function() {
      _.each(getByType('TokenPerp'), function(t){
        t.updateGear();
      });
    };

    Database.prototype.checkNotifications = function() {
      // FIXME: this doesn't work;
      var gnode = this;
      var groot = this.GameRoot;
      var change = false;
      if (!gnode.data.providedPerps) {
        gnode.compileSuperTokens();
        return;
      }
      var before = _.pluck(_.where(gnode.data.providedPerps, {locked:false}),'gestalt');
      gnode.compileSuperTokens();
      var after = _.pluck(_.where(gnode.data.providedPerps, {locked:false}),'gestalt');
      var newbuyable = _.difference(after,before);
      if (newbuyable.length) {
        groot.makeNotifications({
          perps: newbuyable
        });
        groot.getDatabase().renderDBQueue.render();
        groot.getDatabase().renderDBQueue.jdomelem.addClass('NewBuyable');
      }
    }

    Database.prototype.openProfileSetPopup = function(ps) {
      var gnode = this;
      var origin = ps.origin;
      ps.updateNewMarker();
      // Popup instantiated for the first time
      if (!ps.popupTemplateData) {
        ps.popupTemplateData = {};
        ps.popupTemplateData.ProfileSet = ps,
        ps.popupTemplateData.states = origin.states;
        ps.popupTemplateData.status_icons = gnode.GameRoot.data.status_icons;
        ps.popupTemplateData.data = {};
        ps.popupTemplateData.data.gestalt = origin.gestalt;
        ps.popupTemplateData.data.id = origin.id;
      }

      // Update data with current gnode data
      _.extend(ps.popupTemplateData.data, origin.data);

      var popupConfig = {
        gameNode: this,
        template: 'popup_profileset.html',
        templateData: ps.popupTemplateData,
        popupContainer: this
      };

      var popup = this.renderPopup = new Render.Popup(popupConfig);

      gnode.renderNode.addPopup(popup);

      popup.on('button_click.MainButton',function(e) {
        e.stopPropagation();
        gnode.mergeCued(ps.psid);
      });

      popup.on('popup_close',function(e) {
        e.stopPropagation();
        popup.close();
        delete gnode.renderPopup;
      });

      return popup;
    };


    Database.prototype.initEventHandlers = function() {
      var gnode = this;

      // FIXME MAKE POPUP for supertoken purchases

      gnode.on('select_upgrades',function(e){
        //gnode.fetchProvided(function(){
          gnode.renderDBQueue.jdomelem.removeClass('NewBuyable');
          gnode.compileSuperTokens();
          gnode.openUpgradesPopup();
        //});
      });


      gnode.on('profileset_click',function(e,psid){
        var ps = gnode.getCued(psid);
        gnode.openProfileSetPopup(ps);
      });
      gnode.on('profileset_shift_click',function(e,psid){
        e.stopPropagation();
        var ps = gnode.getCued(psid);
        gnode.mergeCued(ps.psid);
      });
      gnode.on('popup_cancel',function(e,psid){
        gnode.renderDBQueue.jdomelem.find('.selected').removeClass('selected');
      });
    };


    ///////////////////////////////////
    // The GamePerp Base Class
    ///////////////////////////////////

    var GamePerp = function(config) {
      this.init(config);

      return this;
    };

    extend(GamePerp, GameNode);

    GamePerp.prototype.cableType = "in";
    GamePerp.prototype.labelClass = undefined;
    GamePerp.prototype.sticky = true;
    GamePerp.prototype.popupTemplate = 'popup.html';

    GamePerp.prototype.extendRender = function() {
      var render = this.renderData || {};
      var node = this.renderNode;
      node.sticky = this.sticky;

      // TODO: Some mixed Renderer rules, review/rewrite and split up to subclasses when we know how to better handle this
      if (!this.noConnect && this.renderType === "Perp" && this.parentNode && this.parentNode.renderType === "Perp") {
        this.parentNode.renderNode.cableTo(node,{mode:this.cableType});
      }
      if (render.config.label) {
        node.addDecorator(new Render.DecoratorLabel({text:render.config.label,extendClass:this.labelClass}));
      }
      if (this._loadReady) {
        this.markReady();
        this._loadReady = undefined;
      } else if (this._loadTimer) {
        this.markTimer(this._loadTimer);
        this._loadTimer = undefined;
      }
    };

    GamePerp.prototype.markTimer = function(conf){
      if (!conf) { return false; }
      this.setState('idle',false);
      this.setState('chargeRunning',true);
      this.renderTimer = this.renderNode.addDecorator(new Render.DecoratorTimer({
        duration: conf.duration,
        serverTime: conf.serverTime,
        serverStartTime: conf.serverStart
      }));
      this.renderTimer.FXSproing();
    };

    GamePerp.prototype.initEventHandlers = function() {
      var gnode = this;
      var groot = this.GameRoot;
      gnode.on('dragend',function(e) {
        e.stopPropagation();
        // FIXME: Testing Save Coords...
        gnode.GameRoot.trigger('saveCoordsQueue',[gnode.path,gnode.renderNode.getPosition()]);
      });
      gnode.on('vclick',function(e) {
        e.stopPropagation();
      });
      gnode.on('vdblclick',function(e) {
        e.stopPropagation();
      });

      gnode.on('after_buy after_create',function(e){
        e.stopPropagation();
        if (gnode.data.story) {
          groot.makeNotifications({ story: gnode.data.story, storyPerp: gnode });
        }
      });


      if (gnode.AniTick) {
        gnode.on('states_chargeRunning', function(e,state) {
          e.stopPropagation();
          if (state) {
            AniTicker.addListener(gnode);
          } else {
            AniTicker.removeListener(gnode);
          }
        });
      }

      if (this.extendEventHandlers) {
        this.extendEventHandlers();
      }
    };


    ///////////////////////////////////
    // GamePerp open a Popup
    ///////////////////////////////////

    GamePerp.prototype.updateTemplateData = function() {
      var gnode = this;
      var groot = this.GameRoot;
      // Popup instantiated for the first time
      if (!this.popupTemplateData) {
        this.popupTemplateData = {};
        this.popupTemplateData.states = gnode.states;
        this.popupTemplateData.status_icons = gnode.GameRoot.data.status_icons;
        this.popupTemplateData.data = {};
        this.popupTemplateData.data.gestalt = this.gestalt;
        this.popupTemplateData.data.id = this.id;
        this.popupTemplateData.loading = true;
        this.popupTemplateData.groot = groot;
      }
      // highlight Tabs in popups
      this.popupTemplateData.highlightTabs = gnode.highlightTabs || [];
      _.extend(this.popupTemplateData.data,this.data);
      // FIXME: make this get game values method on groot
      this.popupTemplateData.game_values = {
        xp_level : groot.xp_level
      };
    };

    GamePerp.prototype.openPopup = function() {
      var gnode = this;
      var groot = this.GameRoot;
      //gnode.renderNode.setFrame('active');

      // Update TemplateData with current gnode data
      gnode.updateTemplateData();

      var popupConfig = {
        // Fixme: gameNode only used for debug info on logo click
        gameNode: this,
        template: this.popupTemplate,
        templateData: this.popupTemplateData,
        popupContainer: this.ViewMap
      };

      var popup = this.renderPopup = new Render.Popup(popupConfig);

      gnode.ViewMap.renderNode.addPopup(popup);

      gnode.initPopupEvents();

      return popup;
    };

    GameNode.prototype.initPopupEvents = function(popup) {
      var gnode = this;
      var groot = this.GameRoot;

      var popup = popup || gnode.renderPopup;

      if (!popup) {
        return;
      }

      popup.on('button_click.MainButton',function(e) {
        e.stopPropagation();
        popup.trigger('popup_close');
      });

      popup.on('button_click.ChargeButton',function(e) {
        e.stopPropagation();
        gnode.Charge();
      });

      popup.on('button_click.CollectButton',function(e) {
        e.stopPropagation();
        gnode.collect();
      });

      popup.on('popup_close',function(e) {
        e.stopPropagation();
        if (gnode.highlightTabs) {
          gnode.highlightTabs = [];
        }
        if (gnode.renderNode && gnode.renderNode.DecoratorNew) {
          _.each(getAllByGestalt(gnode.gestalt), function(gn){
            gn.renderNode.DecoratorNew.remove();
          });
        }
        if (popup.callback) {
          popup.close(popup.callback);
        } else {
          popup.close();
        }
        delete gnode.renderPopup;
      });
      
      popup.on('button_click.PowerupBuyButton',function(e,bgestalt,bslot) {
         e.stopPropagation();
         gnode.BuyPowerup(bgestalt,bslot);
      });

      popup.on('button_click.PowerupBuySlotsButton',function(e,bgestalt,bslot) {
         e.stopPropagation();
         gnode.BuySlots(bslot, bgestalt);
      });


      popup.on('button_click.PowerupSellButton',function(e,bgestalt,bslot) {
         e.stopPropagation();
         gnode.SellPowerup(bgestalt,bslot);
      });

      popup.on('button_click.PerpBuyButton',function(e,bgestalt) {
        e.stopPropagation();
        var gtype = groot.getTypeFromGestalt(bgestalt);
        if (gtype === "CityPerp") {
          var DBPerp = getByType('DatabasePerp');
          if (DBPerp.length) {
            DBPerp = DBPerp[0];
          } else {
            return;
          }
          return DBPerp.BuyCity(bgestalt);
        } else {
           gnode.BuyPerp(bgestalt);
        }
      });

      popup.on('button_click.UpgradeButton',function(e) {
        e.stopPropagation();
        gnode.Charge();
      });

      groot.bindDisplayNameValidation(popup);

      popup.on('button_click.SaveDisplayName',function(e) {
        e.stopPropagation();
        groot.saveDisplayName(popup);
      });

      popup.jdomelem.on('click touchend','a.ml',function(e) {
        e.stopPropagation();
        e.preventDefault();
        var link = $(this).attr('href');
        // FIX for FF open link in external window to prevent socketloss
        //document.location.href = link;
        window.open(link);
      });
      
      popup.jdomelem.on('click touchend','a.mln',function(e) {
        e.stopPropagation();
        e.preventDefault();
        var link = $(this).attr('href');
        window.open(link);
      });

      
      popup.on('button_click.RefreshButton',function(e) {
        e.stopPropagation();
        gnode.GameRoot.refresh();
      });

      popup.on('button_click.ResetButton',function(e) {
        e.stopPropagation();
        var r = confirm(_._("Do you really want to delete and reset your game? (all your progress will be lost, forever!)"));
        if (r==true) {
          gnode.GameRoot.lock();
          app.remote.resetGame(app.token).done(function(){
            location.reload();
          });
        } else {
          $(this).find('.Button[data-button-id="ResetButton"].active').removeClass('active');
        }
      });

    };

    GameRoot.prototype.saveDisplayName = function(container) {
      var groot = this;
      var popup = container;
      var button = popup.jdomelem.find('.Button[data-button-id=SaveDisplayName]');
      var dnameinput = popup.jdomelem.find(".DisplayName");
      var dname = dnameinput.val();
      app.remote.setDisplayName(app.token,dname).done(function(data){
        if (data.result && data.result.error === undefined) {
          groot.data.user.display_name = dname;
          button.removeClass('active');
          button.addClass('disabled');
          button.text(_._('user Displayname saved.'));
          dnameinput.blur();
          groot.Topscores.updateScores();
          popup.jdomelem.find(".DisplayNameOnce").delay('600').animate({height:0,opacity:0},400).hide(200);
        } else {
          console.error('Displayname set failed', data);
          popup.trigger('error');
          if (popup.buttonTimeOut) {
            window.clearTimeout(popup.buttonTimeOut);
          }
          popup.buttonTimeOut = window.setTimeout(function(){
            button.removeClass('ERROR disabled');
          }, 1000);
        }
      })
      .fail(function(data){
        console.error('Displayname set failed', data);
        popup.trigger('error');
      });
    };

    GameRoot.prototype.bindDisplayNameValidation = function(container){
      var popup = container;
      var button = popup.jdomelem.find('.Button[data-button-id=SaveDisplayName]');
      popup.jdomelem.find('.DisplayName').off("keypress");
      popup.jdomelem.find('.DisplayName').off("focus");
      popup.jdomelem.find('.DisplayName').on("focus", function (event) {
        button.removeClass('disabled');
        button.text(_._('user Save'));
      });
      popup.jdomelem.find('.DisplayName').on("keypress", function (event) {
        var txtinput = $(this);
        txtinput.width = txtinput.width;
        txtinput.removeClass('error');
        button.removeClass('disabled');
        button.text(_._('user Save'));
        if (event.charCode===13) {
          popup.trigger('button_click.SaveDisplayName');
        }
        else if (event.charCode!=0) {
          //var regex = new RegExp(/^[\u00C0-\u1FFF\u2C00-\uD7FF\w-][\u00C0-\u1FFF\u2C00-\uD7FF\w- ]+$/)
          var regex = new RegExp(/^[\u00C0-\u1FFF\u2C00-\uD7FF\w- ]+$/)
          //var regex = new RegExp("^[a-zA-Z]+$");
          var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
          //var key = txtinput.val();
          if (!regex.test(key)) {
            event.preventDefault();
            txtinput.width(txtinput.width()).addClass('error');
            return false;
          }
        }
      });
    };

    //FIXME: this could be abused høhø
    GameRoot.prototype.evilResetGame = function() {
      var r = confirm(_._("Do you really want to delete and reset your game? (all your progress will be lost, forever!)"));
      if (r==true) {
        gnode.GameRoot.lock();
        app.remote.resetGame(app.token).done(function(){
          location.reload();
        });
      }
    };

    GamePerp.prototype.updatePopup = function() {
      var gnode = this;

      if (gnode.popupTemplateData) {
        //gnode.popupTemplateData.loading = false;
      }

      // Update data with current gnode data
      //_.extend(this.popupTemplateData.data,gnode.data);
      gnode.updateTemplateData();

      var popupConfig = {
        gameNode: this,
        template: this.popupTemplate,
        templateData: this.popupTemplateData,
        popupContainer: this.ViewMap
      };

      if (this.renderPopup) { this.renderPopup.remove(); }
      var popup = this.renderPopup = new Render.Popup(popupConfig);

      gnode.ViewMap.renderNode.addPopup(popup);

      gnode.initPopupEvents();

      return popup;
    };

    GamePerp.prototype.BuyPerp = function(bgestalt,placePos) {
      var gnode = this;
      var groot = this.GameRoot;
      // TODO: backendcall and do purchase...
      app.remote.buyPerp(app.token, gnode.path, bgestalt).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            // Probably no cash
            if (gnode.renderPopup && gnode.renderPopup.open) {
              if (data.result.error === 2 || data.result === 2) {
                gnode.renderPopup.trigger('no_cash');
              } else if (gnode.gameType=== "ProxyPerp" && data.result.error === 3) {
                gnode.renderPopup.trigger('error');
                groot.makeNotifications({simplemessage:{text: _._('projectbuy_proxyslotsfull')}})
              } else {
                gnode.renderPopup.trigger('error');
              }
            } else {
              gnode.renderNode.FXNoCash();
            }
            return;
          }
          if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }
          if (data.result.node) {
            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
            var node = data.result.node
            var node_data = groot.getTypeData(bgestalt);
            var perp = new Game[node.game_type]({
              "id": node.game_id,
              "gestalt": bgestalt,
              "path": node.full_path,
              noConnect:true,
              "data": mergeData(node_data,node.instance_data),
              // Render perps to first item in path (Imperium or Database)
              "renderNodeParent": getFirstId("Imperium"),
              "ViewMap": getByFirstId("Imperium"),
              "gameType":node.game_type
            });
            gnode.addChild(perp);
            // FIXME: fishy but works?
            var perpNode = gnode.renderNode;
            var vector = gnode.parentNode.renderNode.getVectorTo(gnode.renderNode);
            // golden ratio:
            if (placePos) {
            } else {
              placePos = gnode.renderNode.getVectorPos(vector,0.61803398875);
              perp.renderData.config.placeRandom = placePos;
              perp.renderData.config.placeParentRadius = 320;
            }

            perp.renderData.config.placeRandom = placePos;
            perp.renderData.config.placeParentRadius = 0;
            perp.renderData.config.hidden = true;

            perp.render();
            groot.trigger('saveCoords', [perp.path,perp.renderNode.getPosition()]);
            perp.renderNode.addDecorator(new Render.DecoratorNew({text: _._("New!"), extendClass: "NewPerp"}));
            perp.renderNode.hide();
            perp.renderNode.parentNode.scrollTo(perp.renderNode.getPosition());
            //perp.renderNode.hide();
            window.setTimeout(function(){
              perp.renderNode.FXArise(function(){
                gnode.renderNode.cableAnimatedTo(perp.renderNode,{mode:perp.cableType},function(){ 
                  if (perp.cableType == "in") {
                    perp.renderNode.FXBounce(); 
                  } else if (perp.cableType == "out") {
                    gnode.renderNode.FXBounce(); 
                  } else {
                    gnode.renderNode.FXBounce(); 
                    perp.renderNode.FXBounce(); 
                  }
                  if (perp.data.provided_perps && perp.data.provided_perps.length) {
                    var n = {};
                    if (perp.gameType === "PusherPerp") {
                      n.perps = perp.getProvidedByRequiredPerps();
                    } else {
                      n.perps = perp.getProvidedByLevel();
                    }
                    var thefirst = getAllByGestalt(perp.gestalt).length <= 1;
                    if (thefirst) {
                      groot.makeNotifications(n);
                    } else {
                      perp.markNewItems();
                    }
                  }
                });
              });
            },300);
            // save coords to backend
            perp.trigger('after_buy');
            return perp;
          } 
        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };

    // FIXME DEBUG: testpopup for each gameperp (gets overwritten)
    GamePerp.prototype.extendEventHandlers = function() {
      var gnode = this;
      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        var popup = this.openPopup();
      });
    };



    ///////////////////////////////////
    // The Top Scores
    ///////////////////////////////////

    var Topscores = function(config) {
      var gnode = this;
      var groot = this.GameRoot;
      this.ViewMap = this;
      this.queue = new Set();
      this.init(config);
      return this;
    };
    extend(Topscores, GameNode);

    Topscores.prototype.renderType = "ViewTab";

    Topscores.prototype.extendRender = function() {
      this.GameRoot.renderMenu.addButton(_._('Topscores'), this.id,this.states);
    };

    Topscores.prototype.initTopscore = function(type) {
      var gnode = this;
      var groot = this.GameRoot;
      if (type === undefined) return;

      score = new Game.Topscore({
        "id": 'Topscore' + type,
        "gestalt": 'topscore_'+ type,
        "states" : { complete:false, active:false },
        "scoretype": type,
        "data": groot.getTypeData('Topscore'),
        "renderNodeParent": getFirstId("Topscores"),
        "ViewMap": getByFirstId("Topscores"),
        "gameType": "Topscore"
      });
      gnode.addChild(score);
      score.render();
      score.renderNode.hide();
      return score;
    };

    Topscores.prototype.updateScores = function(){
      this.children.each(function(score){
        score.fetchScore(score.scoretype,true);
      });
    };

    Topscores.prototype.extendEventHandlers = function() {
      var gnode = this;
      var groot = this.GameRoot;

      gnode.on('button_click.SaveDisplayName',function(e) {
        e.stopPropagation();
        var node = gnode.renderNode;
        groot.saveDisplayName(node);
      });


      gnode.on('viewtab_selected',function(e,type) {
        var all_hidden = true;
        gnode.children.each(function(score){
          score.fetchScore();
          if (!score.renderNode.hidden) {
            all_hidden = false;
          }
        });
        var first = gnode.children.set[0];
        if (first && all_hidden && gnode.children.length) {
          groot.bindDisplayNameValidation(gnode.renderNode);
          first.renderNode.show();
          gnode.renderNode.jdomelem.find('.ViewTabMenuButton[data-button-gestalt="' + first.scoretype + '"]').addClass('active');
        }
      });

      gnode.on('button_click.ViewTabMenuButton',function(e,type) {
        e.stopPropagation();
        var score = getByGestalt('topscore_' + type);
        gnode.children.each(function(ts){
          ts.renderNode.hide();
        });
        score.renderNode.show();
        score.fetchScore();
      });

    };


    //////////////////////////////////

    var Topscore = function(config) {
      this.init(config);
      return this;
    };
    extend(Topscore, GameNode);
    
    Topscore.prototype.renderType = "TopscorePerp";

    Topscore.prototype.fetchScore = function(type,force){
      var gnode = this;
      var groot = this.groot;
      var type = type || gnode.scoretype;
      var now = new Date();
      // cache fetching for 30sec
      if (!force && gnode.lastFetch && (now - gnode.lastFetch < 30000)) {
        gnode.renderNode.jdomelem.removeClass('loading');
        return;
      }
      app.remote.getRanking(app.token,type).done(function(data){
        if (data.result && data.result.error === undefined) {
          gnode.data = mergeData(gnode.data, data.result);
          gnode.data.user_in_top = _.findWhere(gnode.data.top, {self:true}) !== undefined;
          gnode.renderNode.renderRank();
          gnode.renderNode.renderList();
          gnode.renderNode.jdomelem.removeClass('loading');
          gnode.lastFetch = new Date();
        } else {
          console.error('getRanking failed', data);
        }
      })
      .fail(function(data){
        console.error('getRanking failed', data);
      });
    };

    Topscore.prototype.extendEventHandlers = function() {
      var gnode = this;
      var groot = this.GameRoot;
      var node = this.renderNode;

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.renderNode.jdomelem.addClass('loading');
        gnode.fetchScore();
      });
    };


    ///////////////////////////////////
    // The Missions and Mission Classes
    ///////////////////////////////////

    var Missions = function(config) {
      gnode = this;
      groot = this.GameRoot;
      this.ViewMap = this;
      this.queue = new Set();
      this.init(config);
      return this;
    };
    extend(Missions, GameNode);

    Missions.prototype.renderType = "ViewTab";

    Missions.prototype.extendRender = function() {
      this.GameRoot.renderMenu.addButton(_._('Missions'), this.id,this.states);
    };

    Missions.prototype.getMission = function(gestalt) {
      return this.Missions[gestalt] || {};
    };

    Missions.prototype.initMissions = function(raw_data) {
      // raw_data = rd = {}
      // rd.mission_goals
      // rd.missions = [missions+type_data]
      // rd.active_missions
      // rd.mission_goals = [object,...]
      // TODO: how to compile completed missions?
      var mroot = this;
      var groot = this.GameRoot;
      if (!mroot.Missions) {
        mroot.Missions = {};
      }

      var active_missions = raw_data.active_missions;

      raw_data.missions.reverse();

      _.each(raw_data.missions,function(m,key){
        groot.addType(m.type_data.gestalt,m);
      });
      _.each(raw_data.missions,function(mission,key){
        mission = new Game.Mission({
          "id": mission.gestalt,
          "gestalt": mission.gestalt,
          "states" : { complete:false, active:false },
          "data": groot.getTypeData(mission.gestalt),
          "renderNodeParent": getFirstId("Missions"),
          "ViewMap": getByFirstId("Missions"),
          "gameType": "Mission"
        });
        mroot.Missions[mission.gestalt] = mission;
        mroot.addChild(mission);
      });
      if (raw_data.mission_goals) {
        mroot.updateMissionGoals(raw_data.mission_goals);
      }
      if (active_missions.length) {
        _.each(active_missions, function(gestalt){
          var active_mission = mroot.getMission(gestalt);
          if (active_mission.setState) {
              active_mission.setState('active', true);
            _.each(active_mission.getBranch(), function(mission){
              mission.setState('complete', true);
              mission.setState('active', false);
            });
          }
        });
      } else {
        // FIXME: all missions done, process all missions
         _.each(mroot.Missions, function(mission){
            mission.setState('complete', true);
            mission.setState('active', false);
        });
      }
      mroot.checkProjectGoals();
    };

    Missions.prototype.getActiveMissions = function(){
      var mroot = this;
      var groot = this.GameRoot;
      return _.filter(mroot.Missions, function(m){ return (m.states.active === true && m.states.complete === false); });
    };

    Missions.prototype.getVisibleMissions = function(){
      var mroot = this;
      var groot = this.GameRoot;
      return _.filter(mroot.Missions, function(m){ return (m.states.active === true || m.states.complete === true); });
    };

    Missions.prototype.getCompletedMissions = function(){
      var mroot = this;
      var groot = this.GameRoot;
      return _.filter(mroot.Missions, function(m){ return (m.states.active === false && m.states.complete === true); });
    };

    Missions.prototype.getNextMissions = function(){
      var mroot = this;
      var groot = this.GameRoot;
      var next_missions = {};
      var active_missions = _.each(mroot.getActiveMissions(), function(mission){
        var next = mission.getNext();
        if (next) { 
          next_missions[next.gestalt] = next; 
        }
      });
      return _(next_missions).values();
    }


    Missions.prototype.checkProjectGoals = function(){
      var mroot = this;
      var groot = this.GameRoot;
      var fetch_project_data = {};
      var update_missions = [];
      
      var checkMission = function(mission) {
        _.each(mission.data.goals, function(goal){
          if (goal.project) {
            fetch_project_data[goal.project] = mission;
            update_missions.push(mission);
          }
        });
      };

      _.each(mroot.getVisibleMissions(), checkMission);
      _.each(mroot.getNextMissions(), checkMission);

      _.each(fetch_project_data, function(mission, gestalt){
        groot.fetchProjectPowerupData(gestalt, function(){
          // FIXME: gotta update all missions with the project in the goals,
          // make this more light weight... best with deferred done callback?
          //mission.updateRender();
          _.each(update_missions,function(mission) {
            mission.updateRender();
          });
          update_missions = _.without(update_missions, mission);
        });
      });
    };

    Missions.prototype.updateMissions = function(missions, game_values) {
      var mroot = this;
      var groot = this.GameRoot;
      // missions is the mission data structure coming from the backend api
      // missions = {} 
      // missions.complete_missions = ['mission001',..]
      // missions.mission_data = {}
      // missions.mission_data.active_missions = ['mission001',...]
      // missions.mission_data.missions_goals = [object,...]
      // missions.mission_data.missions_goals[0] = {
      //      amount: 6000,
      //      current_amount: 2890,
      //      goal_id: "52949c22182e75a93d9c61af",
      //      mission: "mission001",
      //      position: 1,
      //      project: null,
      //      target: "contact035",
      //      workflow: "collect_profiles"
      // }
      // missions.updated_missions = ['mission001',..]
      // missions.rewards = {
      //  cash_value: 0
      //  karma_value: 0
      //  profile_sets: Array[0]
      //  xp_value: 0
      //}
      if (missions.complete_missions) {
        _.each(missions.complete_missions, function(gestalt){
          mroot.getMission(gestalt).setState('active',false);
          mroot.getMission(gestalt).setState('complete',true);
        });
      }
      mroot.updateMissionGoals();
      if (missions.mission_data && missions.mission_data.mission_goals) {
        _.each(missions.mission_data.mission_goals, function(goal){
          if (goal.complete) { groot.renderNode.FXMissionGoalComplete(); }
        });
        mroot.updateMissionGoals(missions.mission_data.mission_goals);
      }
      if (missions.mission_data, missions.mission_data.active_missions) {
        _.each(missions.mission_data.active_missions, function(gestalt){
          var am = mroot.getMission(gestalt);
          mroot.getMission(gestalt).setState('active',true);
        });
      }

      if (missions.rewards && missions.rewards.profile_sets) {
        _.each(missions.rewards.profile_sets, function(ps){
          groot.getDatabase().cue(ps.profile_set,ps.origin,ps.collect_id);
        });
      }

      mroot.checkProjectGoals();

      // TODO: check for notifications for complete and active missions
      //groot.makeNotifications({ missions: missions, game_values: game_values });
    };

    Missions.prototype.updateMissionGoals = function(goals) {
      var mroot = this;
      if (goals) {
        _.each(goals, function(goal){
          var mission = mroot.Missions[goal.mission];
          if (mission) {
             mission.updateGoal(goal);
          }
        });
      } else {
        _.each(mroot.Missions, function(mission){
          _.each(mission.data.goals, function(goal){
            mission.updateGoal(goal);
          });
        });
      }
    };



    ////////////////////////////////////

    var Mission = function(config) {
      this.init(config);
      return this;
    };
    extend(Mission, GameNode);
    
    Mission.prototype.renderType = "MissionPerp";
    Mission.prototype.popupTemplate = "popup_mission.html";
    
    Mission.prototype.getBranch = function(gestalt) {
      var mroot = this.parentNode;
      var branch = [];
      var mission = this;
      while (mission && mission.data && mission.data.required_mission) {
        mission = mroot.getMission(mission.data.required_mission);
        branch.push(mission);
      }
      return branch
    }

    Mission.prototype.getNext = function(gestalt) {
      var mission = this;
      var mroot = mission.parentNode;
      gestalt = gestalt || this.gestalt;
      return _.find(mroot.Missions, function(m){ return ( m.data.required_mission && m.data.required_mission === gestalt) });
    };

    Mission.prototype.updateRender = function() {
      var mission = this;
      if (mission.renderNode) { mission.renderNode.render(); }
    };

    Mission.prototype.updateGoal = function(goal) {
      // TODO: take care of rendering
      var mission = this;
      var groot = this.GameRoot;
      if (goal.mission = this.gestalt) {
        // FIXME: if position equal to index of array -1 this could go faster ???
        _.each(mission.data.goals, function(mission_goal,k) {
          if (mission_goal.position === goal.position) {
            if (goal.complete) {
              if (!goal.amount) { goal.amount = 1; }
              goal.current_amount = goal.amount;
            }
            if (goal.workflow === 'integrate_profiles') {
              goal.current_amount = groot.DBTokensAbsolute[goal.target] || 0;
              goal.current_amount = (goal.current_amount <= goal.amount) ? goal.current_amount : goal.amount;
            }
            mission.data.goals[k] = goal;
          }
        });
        mission.updateRender();
      }
    };

    Mission.prototype.openMissionPopup = function(){
      var gnode = this;
      var groot = this.GameRoot;
      
      groot.openGenericPopup({
        states: gnode.states,
        data: gnode.data,
        template:'popup_mission.html',
        extendClass: 'Mission'
      });
    };

    Mission.prototype.checkTutorial = function() {
      var gnode = this;
      var groot = this.GameRoot;
      var mroot = groot.Missions;
      if (gnode.states.active && gnode.data.tutorial) {
        groot.setState('tutorial_active',true);
        // TODO: check each step for completion and delete everything before
        var steps = gnode.data.tutorial;
        var deletefrom = 0;
        _.each(steps, function(step,k){
          if (step.buyPerp && groot.IPerps.hasOwnProperty(step.buyPerp)) {
            deletefrom = k;
          }
          if (step.integrateProfileSet && groot.getOriginGestaltFromOriginTokenGestalt(step.integrateProfileSet)) {
            deletefrom = k;
            step.nodelay = true;
          }
        });
        steps = _.rest(steps, deletefrom);

        groot.makeNotifications({
          tutorial: steps
        });
        return true;
      } else {
        return false;
      }
    };

    Mission.prototype.extendEventHandlers = function() {
      var gnode = this;
      var groot = this.GameRoot;
      var mroot = groot.Missions;
      var node = this.renderNode;
      gnode.on('after_render',function(e) {
        if (gnode.states.active) {
          if (gnode.checkTutorial()) {
            groot.makeNotifications({
              mission_active: gnode.gestalt
            });
          }
        }
      });

      gnode.on('states_active',function(e,params) {
        e.stopPropagation();
        if (!params) { return; }
        gnode.checkTutorial();
        groot.makeNotifications({
          mission_active: gnode.gestalt
        });
      });

      gnode.on('local_states_complete',function(e,params) {
        _.each(gnode.data.goals, function(goal){
          goal.complete = true;
          gnode.updateGoal(goal)
        });
      });

      gnode.on('states_complete',function(e,params) {
        e.stopPropagation();
        if (!params) { return; }
        if (gnode.data.tutorial) {
          groot.setState('tutorial_active',false);
        }
        groot.makeNotifications({
          mission_complete: gnode.gestalt
        });
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.openMissionPopup();
      });
    };

    Mission.prototype.extendRender = function() {
      var gnode = this;
      if (!gnode.states.active && !gnode.states.complete) {
        //gnode.renderNode.hide();
      }
    };


    ///////////////////////////////////
    // The Database Perp
    ///////////////////////////////////

    var DatabasePerp = function(config) {
      this.init(config);
      return this;
    };

    extend(DatabasePerp, GamePerp);

    DatabasePerp.prototype.renderType = "Perp";

    DatabasePerp.prototype.extendEventHandlers = function() {
      var gnode = this;
      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.trigger('switch_view','Database');
      });
    };

    DatabasePerp.prototype.BuyCity = function(bgestalt, placePos) {
      var gnode = this;
      var groot = this.GameRoot;
      app.remote.buyPerp(app.token, gnode.path, bgestalt).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            // Probably no cash
            if (gnode.renderPopup && gnode.renderPopup.open) {
              gnode.renderPopup.trigger('no_cash');
            } else {
              gnode.renderNode.FXNoCash();
            }
            return;
          }
          if (groot.renderPopup) { groot.renderPopup.trigger('popup_close'); }
          _.each(getByType('CityPerp'),function(city){
             if (city.renderPopup) { city.renderPopup.trigger('popup_close'); }
          });

          if (data.result.node) {
            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);

            var node = data.result.node
            var node_data = groot.getTypeData(bgestalt);
            var perp = new Game[node.game_type]({
              "id": node.game_id,
              "gestalt": bgestalt,
              "path": node.full_path,
              noConnect:true,
              "data": mergeData(node_data,node.instance_data),
              // Render perps to first item in path (Imperium or Database)
              "renderNodeParent": getFirstId("Imperium"),
              "ViewMap": getByFirstId("Imperium"),
              "gameType":node.game_type
            });
            gnode.addChild(perp);
            var perpNode = gnode.renderNode;
            // place first city to a defined offset to the db, every other city on the opposite side of the first found city....
            if (placePos) {
            } else {
              placePos = gnode.renderNode.getPosition();
              placePos.x = placePos.x - 250;
              placePos.y = placePos.y + 50;
            }
            if (gnode.children.set && gnode.children.set.length >= 2) {
              var oppositeCity = _.findWhere(gnode.children.set,{gameType:"CityPerp"});
              var vector = oppositeCity.renderNode.getVectorTo(gnode.renderNode);
              placePos = gnode.renderNode.getVectorPos(vector,1);
            }
            perp.renderData.config.placeRandom = placePos;
            perp.renderData.config.placeParentRadius = 400;
            perp.renderData.config.hidden = true;

            perp.render();
            groot.trigger('saveCoords', [perp.path,perp.renderNode.getPosition()]);
            perp.renderNode.addDecorator(new Render.DecoratorNew({text: _._("New!"), extendClass: "NewPerp"}));
            perp.renderNode.hide();
            perp.renderNode.parentNode.scrollTo(perp.renderNode.getPosition());
            window.setTimeout(function(){
              perp.renderNode.FXArise(function(){
                gnode.renderNode.cableAnimatedTo(perp.renderNode,{mode:perp.cableType},function(){ 
                  if (perp.cableType == "in") {
                    perp.renderNode.FXBounce(); 
                  } else if (perp.cableType == "out") {
                    gnode.renderNode.FXBounce(); 
                  } else {
                    gnode.renderNode.FXBounce(); 
                    perp.renderNode.FXBounce(); 
                  }
                });
              });
            },300);
            
            // put profileset in DBQueue
            groot.getDatabase().cue(data.result.profile_set.profile_set, data.result.profile_set.origin, data.result.profile_set.collect_id);
            perp.trigger('after_buy');
            return perp;
          } 
        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };

    DatabasePerp.prototype.BuyPerp = DatabasePerp.prototype.BuyCity;

    ///////////////////////////////////
    // The City
    ///////////////////////////////////

    var CityPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(CityPerp, GamePerp);

    CityPerp.prototype.renderType = "Perp";
    CityPerp.prototype.cableType = "inout";
    CityPerp.prototype.popupTemplate = "popup_city.html";
    CityPerp.prototype.textNewItems = _._('New Items!');

    CityPerp.prototype.compileProvidedCities = function() {
      var gnode = this;
      var groot = this.GameRoot;
      gnode.data.providedCities = [];
      _.each(groot.getTypes('CityPerp'),function(p,key){
        var city = {};
        city.data = p.type_data;
        city.gestalt = p.gestalt;
        // FIXME: no game_type in template
        city.data.is_city = true;
        if (!getByGestalt(p.gestalt)) {
          gnode.data.providedCities.push(city);
          if (city.data.required_level <= groot.xp_level.number) {
            gnode.data.buyablePerps.push(city.gestalt);
          }
        }
      });
      return gnode.data.providedCities;
    };

    CityPerp.prototype.compileProvided = function(){
      var gnode = this;
      var groot = this.GameRoot;


      var providedCache = {};
      
      providedCache.AgentPerp = _.filter(gnode.data.provided_perps,function(v){
        return v.substring(0,5) === 'agent';
      });
      providedCache.ProxyPerp = _.filter(gnode.data.provided_perps,function(v){
        return v.substring(0,5) === 'proxy';
      });
      providedCache.PusherPerp = _.filter(gnode.data.provided_perps,function(v){
        return v.substring(0,6) === 'pusher';
      });

      providedCache.CityPerp = _.pluck(gnode.compileProvidedCities(),'gestalt');

      gnode.data.providedTabs = {
        AgentPerp: [],
        PusherPerp: [],
        ProxyPerp: [],
        CityPerp: []
      };

      _.each(gnode.data.providedTabs,function(tab,k){
        _.each(providedCache[k],function(p,key){
          var perp = {};
          var type_data = groot.getTypeData(p);
          perp.data = type_data;
          perp.gestalt = p;
          perp.locked = _.find(gnode.data.buyablePerps,function(v){ return perp.gestalt === v }) === undefined;
          // FIXME: this property should come from the backend and doesn't need to be set here.
          if (!perp.data.max_instances) { 
            perp.data.max_instances = 1;
          }
          if (perp.data.max_instances) {
            if (getAllByGestalt(perp.gestalt).length >= perp.data.max_instances) {
              perp.locked = true;
              perp.bought = true;
            }
          }
          if ( perp.locked && groot.IPerps.hasOwnProperty(perp.gestalt) ) {
            perp.bought = true;
          } else {
          if (perp.locked) {
            if (perp.data.required_providers && perp.data.required_providers.length) {
              perp.data.requiredProviders = [];
              _.each(perp.data.required_providers,function(v,k){
                var tdata = groot.getTypeData(v);
                if (tdata && tdata.title) {
                  perp.data.requiredProviders.push(tdata.title);
                }
              });
            }
          }
          gnode.data.providedPerps.push(perp);
          tab.push(perp);
          }
        });
        var sorted = _.sortBy(tab, function(v){ return v.data.required_level; });
        gnode.data.providedTabs[k] = sorted;
      });
    };

    CityPerp.prototype.extendEventHandlers = function(){
      var gnode = this;
      var groot = this.GameRoot;
      
      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();

        // Empty the Tabs (later used for loader in popup)
        gnode.data.providedTabs = {
          agents: [],
          pusher: [],
          proxies: []
        };

        gnode.fetchProvided(function(){
          gnode.compileProvided();
          if (gnode.renderPopup) { 
            gnode.updatePopup(); 
          }
        });
        var popup = this.openPopup();
      });

    };

    GameNode.prototype.fetchProvided = function(cb) {
      var gnode = this;
      gnode.data.providedPerps = [];
      if (gnode.popupTemplateData) {
        gnode.popupTemplateData.loading = true;
      }

      app.remote.getProvidedPerps(app.token,gnode.path)
      .done(function(data){
        if (data.result && data.result.buyable) {
          gnode.data.buyablePerps = data.result.buyable;
          if (gnode.popupTemplateData) {
            gnode.popupTemplateData.loading = false;
          }
          if (cb) { cb(); }
        }
      })
      .fail(function(data){
        if (cb) { cb(); }
      });
    }

    ///////////////////////////////////
    // The Agent
    ///////////////////////////////////

    var AgentPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(AgentPerp, GamePerp);

    AgentPerp.prototype.renderType = "Perp";
    AgentPerp.prototype.cableType = "in";
    AgentPerp.prototype.popupTemplate = 'popup_agent.html';
    AgentPerp.prototype.textNewItems = _._('New Contacts!');

    AgentPerp.prototype.extendEventHandlers = function(){
      var gnode = this;
      var groot = this.GameRoot;

      gnode.compileProvided();

      gnode.on('after_render',function(e,renderNode) {
        gnode.checkProvidedByLevel();
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.fetchProvided(function(){
          gnode.compileProvided();
          if (gnode.renderPopup) { gnode.updatePopup(); }
        });
        var popup = this.openPopup();
      });
    };

    // FIXME: move this to the GamePerp section
    
    GamePerp.prototype.markNewItems = function(){
      /* FIXME? no decorator when max_slots is full?
      if (this.data && this.data.max_slots) {
        if (this.children.length >= this.data.max_slots) {
          return;
        }
      }
      */
      var text = this.textNewItems || _._("New Items!");
      this.renderNode.addDecorator(new Render.DecoratorNew({ text:text, arrow:true }));
    };
 
    GamePerp.prototype.checkProvidedByRequiredPerps = function(){
      // checks for provided perps by required providers
      var gnode = this;
      var groot = this.GameRoot;
      _.each(gnode.data.provided_perps,function(gestalt,key){
        var type = groot.getType(gestalt);
        if (type.type_data.required_providers && !groot.IPerps.hasOwnProperty(gestalt)) {
          _.each(type.type_data.required_providers, function(provided){
            if (groot.IPerps.hasOwnProperty(provided)) {
              gnode.markNewItems();
            }
          });
        }
      });
    };

    GamePerp.prototype.getProvidedByRequiredPerps = function(){
      // returns all provided perps by required providers
      var gnode = this;
      var groot = this.GameRoot;
      var perps = [];
      _.each(gnode.data.provided_perps,function(gestalt,key){
        var type = groot.getType(gestalt);
        if (type.type_data.required_providers && !groot.IPerps.hasOwnProperty(gestalt)) {
          _.each(type.type_data.required_providers, function(provided){
            if (groot.IPerps.hasOwnProperty(provided)) {
              perps.push(gestalt);
            }
          });
        }
      });
      return perps;
    };

    GamePerp.prototype.checkProvidedByLevel = function(){
      // checks for same level
      var gnode = this;
      var groot = this.GameRoot;
      _.each(gnode.data.provided_perps,function(gestalt,key){
        var type = groot.getType(gestalt);
        if (type.type_data.required_level === groot.xp_level.number && !groot.IPerps.hasOwnProperty(gestalt)) {
          gnode.markNewItems();
        }
      });
    };

    GamePerp.prototype.getProvidedByLevel = function(){
      // returns all available perp gestalten
      var gnode = this;
      var groot = this.GameRoot;
      var perps = [];
      _.each(gnode.data.provided_perps,function(gestalt,key){
        var type = groot.getType(gestalt);
        if (type.type_data.required_level <= groot.xp_level.number && !groot.IPerps.hasOwnProperty(gestalt)) {
          perps.push(gestalt);
        }
      });
      return perps;
    };


    GamePerp.prototype.compileProvided = function(){
      var gnode = this;
      var groot = this.GameRoot;
      gnode.data.providedPerps = [];
      if (gnode.data.buyablePerps === undefined) {
        return;
      }
      _.each(gnode.data.provided_perps,function(p,key){
        var perp = {};
        var type_data = groot.getTypeData(p);
        perp.data = type_data;
        perp.gestalt = p;
        perp.locked = _.find(gnode.data.buyablePerps,function(v){ return perp.gestalt === v }) === undefined;
        if (perp.locked && perp.data.required_level && !perp.data.required_providers && perp.data.required_level <= groot.xp_level.number && !groot.IPerps.hasOwnProperty(perp.gestalt)) {
          perp.locked = false;
        }
        // FIXME: When Project only check for project in city
        if ( perp.locked && groot.IPerps.hasOwnProperty(perp.gestalt) ) {
          perp.bought = true;
        } else {
          if (perp.locked) {
            if (perp.data.required_providers && perp.data.required_providers.length) {
              perp.data.requiredProviders = [];
              _.each(perp.data.required_providers,function(v,k){
                var tdata = groot.getTypeData(v);
                if (tdata && tdata.title) {
                  perp.data.requiredProviders.push(tdata.title);
                }
              });
            }
          }
          gnode.data.providedPerps.push(perp);
        }
      });
      var sorted = _.sortBy(gnode.data.providedPerps, function(v){ return v.data.required_level; });
      var grouped = _.groupBy(sorted,function(v){
        return (v.locked) ? 1 : 0 ;
      });
      gnode.data.providedPerps = _.flatten(grouped);
    };


    ///////////////////////////////////
    // The Contact
    ///////////////////////////////////

    var ContactPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(ContactPerp, GamePerp);

    ContactPerp.prototype.renderType = "Perp";
    ContactPerp.prototype.popupTemplate = "popup_contact.html";
    ContactPerp.prototype.cableType = "in";
    ContactPerp.prototype.sticky = false;

    ContactPerp.prototype.extendEventHandlers = function() {
      var gnode = this;
      var groot = this.GameRoot;

      gnode.on('vshiftclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.Charge();
      });
      gnode.on('vclick',function(e,renderNode) {

        e.stopPropagation();
        // FIXME: Prepare data move this to own function
        gnode.data.ProfileSet = new ProfileSet({ markNew:true },gnode.data.tokens);

        var popup = this.openPopup();

      });
      gnode.on('node_ready',function(e,result) {
        e.stopPropagation();
        // FIXME result has no meaning here?! since A) event can be triggered by non-socket-io b) markready takes no argument.
        //gnode.markReady(result);
        //onsole.log('node_ready',result);
        gnode.markReady();
      });

    };

    ContactPerp.prototype.Charge = function() {
      var gnode = this;
      var groot = this.GameRoot;
      // No request when not enough cash
      if (gnode.data.charge_cost > groot.cash_value) {
        // No cash
        if (gnode.renderPopup && gnode.renderPopup.open) {
          gnode.renderPopup.trigger('no_cash');
        } else {
          gnode.renderNode.FXNoCash();
        }
        return;
      }
      if (!gnode.states.chargeRunning && gnode.states.idle) {
        app.remote.chargePerp(app.token, gnode.path).done(function(data) {
          if (data.result) {
            if (data.result.error) {
              // No cash
              if (gnode.renderPopup && gnode.renderPopup.open) {
                gnode.renderPopup.trigger('no_cash');
              } else {
                gnode.renderNode.FXNoCash();
              }
              return;
            }
            if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }
            // TODO game_values
            var gv = data.result.game_values;
            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
            gnode.renderNode.FXCharge();
            gnode.markTimer({
              duration: data.result.duration,
              serverTime: 0,
              serverStartTime: 0
            });
          } else {
            gnode.Error('The computer says NOOOO',data);
          }
        })
        .fail(function(data){
            gnode.Error('The computer says NOOOO',data);
        });
      }
    };


    ContactPerp.prototype.collect = function() {
      var gperp = this;
      var gnode = this;
      var groot = this.GameRoot;
      var deco = this.renderReady;
      var popup = this.renderPopup;
      if (groot.ap_value < 1) {
        if (popup) {
          popup.trigger('no_AP');
        } else {
          deco.FXNoAP();
        }
        return;
      }
      deco.setClickable(false);
      deco.setFrame('active');
      deco.FXPulse();
      //var amount = _.toKSNum(Math.round(Math.random()*100000));
      app.remote.collectPerp(app.token, gperp.path).done(function(data) {
        // FIXME: It would be better if data.result was in a predefined state to prevent testing for both, undefined _and_ null...
        if (data.result && data.result.result) {
          var amount = data.result.result.profile_set.profiles_value;
          
          if (popup) { popup.trigger('popup_close'); }
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          if (data.result.karma_incident) {
            // Karmalizer
            var karma_dec = data.result.game_values.karma_value - groot.karma_value;
            groot.makeNotifications({
              karma: {
                gestalt: data.result.karma_incident,
                dec: karma_dec
              }
            });
          }

          deco.FXBling({text: _.toKSNum(amount), extendClass: "ProfileBling"});
          deco.FXSuck(function() {
            gperp.renderNode.FXDataOut();
            gperp.renderReady=undefined;
          });
          // Add to DB Queue
          //groot.getDatabase().cue(data.result.result.profile_set, data.result.result.origin, data.result.result.collect_id);
          groot.getDatabase().cue(data.result.result.profile_set, data.result.result.origin, data.result.result.collect_id);
          gperp.setState('idle',true);
        } else if (data.result && data.result.error) {
          if (popup) {
            popup.trigger('no_AP');
          } else {
            deco.FXNoAP();
          }
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
          console.warn('collect failed');
        } else {
          // ERROR
          gperp.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
          deco.FXError();
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
      });
    };

    ContactPerp.prototype.markReady = function() {
      var gperp = this;
      var groot = this.GameRoot;
      gperp.setState('idle',false);
      gperp.setState('chargeRunning',false);
      if (gperp.renderTimer) { gperp.renderTimer.FXPuff(); }
      var deco = this.renderReady = this.renderNode.addDecorator(new Render.DecoratorReady());
      deco.FXSproing();
      deco.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gperp.collect();
        // No Request when no AP
      });
    };

    /*
    ContactPerp.prototype.AniTick = function() {
      if (this.renderNode) {
        this.renderNode.FXBounce();
      }
    };
    */


    ///////////////////////////////////
    // The Pusher
    ///////////////////////////////////

    var PusherPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(PusherPerp, GamePerp);

    PusherPerp.prototype.renderType = "Perp";
    PusherPerp.prototype.cableType = "out";
    PusherPerp.prototype.labelClass = "client";
    PusherPerp.prototype.popupTemplate = 'popup_pusher.html';
    PusherPerp.prototype.textNewItems = _._('New Clients!');

    PusherPerp.prototype.extendEventHandlers = function(){
      var gnode = this;
      var groot = this.GameRoot;

      gnode.compileProvided();

      gnode.on('after_render',function(e,renderNode) {
        gnode.checkProvidedByRequiredPerps();
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.fetchProvided(function(){
          gnode.compileProvided();
          if (gnode.renderPopup) { gnode.updatePopup(); }
        });
        var popup = this.openPopup();
      });
    };



    ///////////////////////////////////
    // The Client (former Customer)
    ///////////////////////////////////

    var ClientPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(ClientPerp, GamePerp);

    ClientPerp.prototype.renderType = "Perp";
    ClientPerp.prototype.cableType = "out";
    ClientPerp.prototype.labelClass = "client";
    ClientPerp.prototype.sticky = false;
    ClientPerp.prototype.popupTemplate = 'popup_client.html';


/* NEW

class CollectableClient(CollectablePerpBase):

    def getCost(self):
        return {'ap': 1}

    def getPerpChargeData(self):
        db_state = self.getDBAmounts()
        token_amounts = [float(db_state.get(token['gestalt'], 0) * token['amount'])/10000 for token in self.node_type_data['consumed_tokens']]
        amount = sum(token_amounts, 0)
        db_fill_factor = self.getDBFactorNormalized(db_state)
        karma_penalty_factor = self.getKarmaPenalty()
        amount = (amount * db_fill_factor)**0.6
        result = int(karma_penalty_factor * round((self.node_type_data['income_base'] + (amount * self.node_type_data['income_base'] * (float(self.node_type_data['income_factor'])/1000)))/10)*10)
        return {'collect_cash': result}, self.getCost()

    def getKarmaPenalty(self):
        karma = self.game_values.get('karma_value', 0)
        karma_factor = float(karma + 100)/200 + 0.5
        return min(1, karma_factor)

*/



    ClientPerp.prototype.AniTick = function() {
      if (this.renderNode) {
        this.renderNode.FXDataIn();
      }
    };

    ClientPerp.prototype.getKarmaPenalty = function(){
      var gnode = this;
      var groot = this.GameRoot;
      var karma = groot.karma_value;
      var karma_factor = (karma + 100)/200 + 0.5;
      karma_factor = (karma_factor > 1) ? 1 : karma_factor;
      if (karma_factor < 1) {
        gnode.data.karma_penalty = true;
      } else {
        gnode.data.karma_penalty = false;
      }
      return karma_factor;
    };
    
    
/*
     def getPerpChargeData(self):
        db_state = self.getDBAmounts()
        token_amounts = [float(db_state.get(token['gestalt'], 0) * token['amount'])/10000 for token in self.node_type_data['consumed_tokens']]
        amount = sum(token_amounts, 0)
        db_fill_factor = self.getDBFactorNormalized(db_state)
        karma_penalty_factor = self.getKarmaPenalty()
        amount = (amount * db_fill_factor)**0.6
        #result = int(karma_penalty_factor * round((self.node_type_data['income_base'] + (amount * self.node_type_data['income_base'] * (float(self.node_type_data['income_factor'])/1000)))/10)*10)
        result = int(karma_penalty_factor * round((self.node_type_data['income_base'] + (amount * self.node_type_data['income_base'] * (float(self.node_type_data['income_factor'])/1000)))))
        return {'collect_cash': result}, self.getCost()
*/


    ClientPerp.prototype.getIncome = function(nopenalty){
      var groot = this.GameRoot;
      var gnode = this;
      var base_income = gnode.data.income_base;
      var base_income_factor = gnode.data.income_factor;
      var consumed_tokens = gnode.data.consumed_tokens;
      var db_profiles = groot.DBTokens;
      var sum = [];
      _.each(consumed_tokens,function(token,k){
        sum.push( (groot.getDBTokenAmount(token.gestalt) * token.amount )/10000 );
      });
      var amount=0;
      amount = _.reduce(sum, function(memo, num){ return memo + num; }, 0);
      var db_fill_factor = groot.getDBFactorNormalized();
      var karma_penalty_factor = (nopenalty) ? 1 : gnode.getKarmaPenalty();
      amount = Math.pow((amount * db_fill_factor), 0.6);
      //var result = parseInt( karma_penalty_factor * Math.round( (base_income + (amount * base_income * (base_income_factor/1000))) /10 ) * 10 );
      var result = parseInt( karma_penalty_factor * Math.round( (base_income + (amount * base_income * (base_income_factor/1000)))) );
      return result;
    }

    GameRoot.prototype.getCityOriginAmounts = function(){
      var cities = _.where(this.DBOriginTokens,{ originGameType : "CityPerp" });
      var city_amounts = {}
      _.each(cities, function(c){
        city_amounts[c.gestalt] = c.cityMaxAmount;
      });
      return city_amounts;
    };

    GameRoot.prototype.getDBFactorNormalized = function(){
      var cityamounts = this.getCityOriginAmounts()
      return _.reduce(_.values(cityamounts), function(memo, num){ return memo + num; }, 0);
    };


    ClientPerp.prototype.extendEventHandlers = function() {
      var gnode = this;

      gnode.on('vshiftclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.Charge();
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();

        // FIXME: Compile some data, move to extra method
        //gnode.data.ProfileSet = new ProfileSet({ convertTokens:true, DBAmounts:true, lockNotInDB:true }, gnode.data.provided_tokens);
        gnode.data.ProfileSet = new ProfileSet({  DBAmounts:true, lockNotInDB:true, filter_is_query: "blue", sortByGestalt:true }, gnode.data.consumed_tokens);
        gnode.data.ConsumedProfileSet = new ProfileSet({ lockNotInDB:true, DBAmounts:true, filter_is_query: "orange", sortByGestalt:true }, gnode.data.consumed_tokens);
        gnode.data.income = gnode.getIncome();
        gnode.data.income_nopenalty = gnode.getIncome(true);

        var popup = this.openPopup();

      });
      
      gnode.on('node_ready',function(e,result) {
        e.stopPropagation();
        gnode.markReady();
      });

    };

    ClientPerp.prototype.collect = function() {
      var gperp = this;
      var gnode = this;
      var groot = this.GameRoot;
      var deco = gperp.renderReady;
      // No Request when no AP
      var popup = gperp.renderPopup;
      // No Request when no AP
      if (groot.ap_value < 1) {
        if (popup) {
          popup.trigger('no_AP');
        } else {
          deco.FXNoAP();
        }
        return;
      }
      deco.setClickable(false);
      deco.setFrame('active');
      deco.FXPulse();
      //var amount = _.toKSNum(Math.round(Math.random()*100000));
      app.remote.collectPerp(app.token, gperp.path).done(function(data) {
        // FIXME: It would be better if data.result was in a predefined state to prevent testing for both, undefined _and_ null...
        if (data.result && data.result.result) {
          var amount = data.result.result.cash;

          if (popup) { popup.trigger('popup_close'); }

          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          deco.FXBling({text:'$' + _.toKSNum(amount), extendClass: "MoneyBling",wait:600});

          if (data.result.karma_incident) {
            // Karmalizer
            var karma_dec = data.result.game_values.karma_value - groot.karma_value;
            groot.makeNotifications({
              karma: {
                gestalt: data.result.karma_incident,
                dec: karma_dec
              }
            });
          }
          deco.FXKatsching(function() {
            gperp.renderReady.remove();
            gperp.renderReady=undefined;
            delete gperp.renderReady;
          });

          gperp.setState('idle',true);
        } else if (data.result && data.result.error) {
          if (popup) {
            popup.trigger('error');
          } else {
            deco.FXError();
          }
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
          console.warn('collect failed', data.result.error);
        } else {
          // ERROR
          gperp.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
          deco.FXError();
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
      });
    };




    ClientPerp.prototype.markReady = function() {
      var gperp = this;
      var groot = this.GameRoot;
      gperp.setState('idle',false);
      gperp.setState('chargeRunning',false);
      if (gperp.renderTimer) { gperp.renderTimer.FXPuff(); }

      var deco = gperp.renderReady = new Render.DecoratorReady({mode:"money"});
      gperp.renderNode.addDecorator(deco);
      deco.FXSproing();

      deco.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gperp.collect();
      });
    };

    ClientPerp.prototype.Charge = function() {
      var gnode = this;
      var groot = this.GameRoot;
      // No request when not enough cash
      if (groot.ap_value < 1) {
        // No AP
        if (gnode.renderPopup && gnode.renderPopup.open) {
          gnode.renderPopup.trigger('no_AP');
        } else {
          gnode.renderNode.FXNoAP();
        }
        return;
      }
      if (!gnode.states.chargeRunning && gnode.states.idle) {
        app.remote.chargePerp(app.token, gnode.path).done(function(data) {
          if (data.result) {
            if (data.result.error) {
              // No AP
              if (gnode.renderPopup && gnode.renderPopup.open) {
                gnode.renderPopup.trigger('no_AP');
              } else {
                gnode.renderNode.FXAP();
              }
              return;
            }
            if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }

            gnode.renderNode.FXDataIn();
            // TODO game_values
            var gv = data.result.game_values;
            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
            gnode.renderNode.FXCharge('AP');
            gnode.markTimer({
              duration: data.result.duration,
              serverTime: 0,
              serverStartTime: 0
            });
          } else {
            gnode.Error('The computer says NOOOO',data);
          }
        })
        .fail(function(data){
            gnode.Error('The computer says NOOOO',data);
        });
      }
    };

    ///////////////////////////////////
    // The Proxy
    ///////////////////////////////////

    var ProxyPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(ProxyPerp, GamePerp);

    ProxyPerp.prototype.renderType = "Perp";
    ProxyPerp.prototype.cableType = "in";
    ProxyPerp.prototype.popupTemplate = 'popup_proxy.html';
    ProxyPerp.prototype.textNewItems = _._('New Ventures!');

    ProxyPerp.prototype.extendEventHandlers = function(){
      var gnode = this;
      var groot = this.GameRoot;
      
      gnode.compileProvided();

      gnode.on('after_render',function(e,renderNode) {
        gnode.checkProvidedByLevel();
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.data.used_slots = gnode.children.set.length;
        gnode.fetchProvided(function(){
          gnode.compileProvided();
          if (gnode.renderPopup) { gnode.updatePopup(); }
        });
        var popup = this.openPopup();
      });

      gnode.on('after_render', function(){
        gnode.updateRenderSlotStatus();
      });

    };
    
    ProxyPerp.prototype.updateRenderSlotStatus = function(){
      var gnode = this;
      var node = gnode.renderNode;
      gnode.data.used_slots = gnode.children.set.length;
      if (gnode.data.used_slots < gnode.data.max_slots) {
        node.addDecorator(new Render.DecoratorLabel({text: gnode.data.label + "<br />"+ gnode.data.used_slots +"/"+ gnode.data.max_slots }));
      } else {
        node.addDecorator(new Render.DecoratorLabel({text: gnode.data.label }));
      }

    };


    ///////////////////////////////////
    // The Project
    ///////////////////////////////////

    var ProjectPerp = function(config) {
      this.init(config);
      this.GameRoot.IPerps[this.gestalt] = true;
      return this;
    };

    extend(ProjectPerp, GamePerp);

    ProjectPerp.prototype.renderType = "Perp";
    ProjectPerp.prototype.cableType = "in";
    ProjectPerp.prototype.sticky = false;
    ProjectPerp.prototype.popupTemplate = "popup_project.html";
    ProjectPerp.prototype.textNewItems = _._('New Powerups!');

    ProjectPerp.prototype.compileProfileSet = function() {
      var gnode = this;
      gnode.data.ProfileSet = new ProfileSet({markNew:true, lockAmountZero:true}, gnode.data.tokens);
    };

    ProjectPerp.prototype.extendEventHandlers = function() {
      var gnode = this;
      var groot = this.GameRoot;


      gnode.on('vshiftclick',function(e,renderNode) {
        e.stopPropagation();
        gnode.Charge();
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();

        var popup = this.openPopup();
        
        gnode.fetchPowerups(function(){
          gnode.compilePowerups();
          gnode.compileProfileSet();
          if (gnode.renderPopup) { gnode.updatePopup(); }
        });

      });

      gnode.on('node_ready',function(e,result) {
        e.stopPropagation();
        gnode.markReady();
      });
    };

    /*
    ProjectPerp.prototype.AniTick = function() {
      if (this.renderNode) {
        this.renderNode.FXBounce();
      }
    };
    */

    ProjectPerp.prototype.fetchPowerups = function(cb) {
      this.GameRoot.fetchProjectPowerupData(this.gestalt,cb);
      return;
      var gnode = this;
        // Register Powerups in typeRegistry if opend for the first time move this to compilePowerupsa
        if (!gnode.data.powerups_compiled) {
          app.remote.getPowerups(app.token,gnode.gestalt,app.version)
          .done(function(data){
            _.each(data.result,function(v,k){
              gnode.addType(v.game_gestalt, v);
            });
            if (gnode.renderPopup) {
              // FIXME: get rid of caching flag for now?
              gnode.renderPopup.templateData.cached = true;
              // FIXME: only update tabs don't redraw everything
              //gnode.compilePowerups();
              //gnode.updatePopup();
              if (cb) { cb(); }
            }
          });
        } else {
          if (cb) { cb(); }
        }
    };

    GameRoot.prototype.fetchProjectPowerupData = function(project_gestalt,cb) {
      var groot = this;
      var gnode = getByGestalt(project_gestalt);
      // Register Powerups in typeRegistry
      if (gnode && !gnode.data.powerupsCached) {
        app.remote.getPowerups(app.token,project_gestalt,app.version)
        .done(function(data){
          _.each(data.result,function(v,k){
            groot.addSubType(project_gestalt, v.game_gestalt, v);
          });
          if (gnode.renderPopup) {
            gnode.renderPopup.templateData.cached = true;
          }
          gnode.data.powerupsCached = true;
          if (cb) { cb(); }
        });
      } 
      else if (gnode && gnode.renderPopup && gnode.renderPopup.templateData) {
        gnode.renderPopup.templateData.cached = true;
        if (cb) { cb(); }
      } else {
        app.remote.getPowerups(app.token,project_gestalt,app.version)
        .done(function(data){
          _.each(data.result,function(v,k){
            groot.addSubType(project_gestalt, v.game_gestalt, v);
          });
          if (cb) { cb(); }
        });
      }
    };

    ProjectPerp.prototype.compilePowerups = function() {
      var gnode = this;
      var powerups = {};
      if (gnode.data) {
        _.each(gnode.data.provided_ads,function(powerup){
          powerup.data = mergeData(gnode.getType(powerup.gestalt).type_data,powerup.instance_data);
          powerup.game_type = gnode.getType(powerup.gestalt).game_type;
        });
        _.each(gnode.data.provided_upgrades,function(powerup){
          powerup.data = mergeData(gnode.getType(powerup.gestalt).type_data,powerup.instance_data);
          powerup.game_type = gnode.getType(powerup.gestalt).game_type;
        });
        _.each(gnode.data.provided_teammembers,function(powerup){
          powerup.data = mergeData(gnode.getType(powerup.gestalt).type_data,powerup.instance_data);
          powerup.game_type = gnode.getType(powerup.gestalt).game_type;
        });
        _.each(gnode.data.powerups,function(powerup){
          gnode.removeProvidedPowerup(powerup.gestalt);
          if (gnode.getType(powerup.gestalt)) {
            powerup.data = mergeData(gnode.getType(powerup.gestalt).type_data,powerup.instance_data);
            powerup.game_type = gnode.getType(powerup.gestalt).game_type;
          } else { 
            console.warn('Error no type_data',powerup.gestalt);
          }
        });
      }

      _.each(['UpgradePowerup','AdPowerup','TeamMemberPowerup'],function(game_type){
        var pcat = convertPowerupType(game_type);
        if (!powerups[game_type]) {
          // init powerup slots
          powerups[game_type] = {
            slots : [],
            provided : [],
            typelower:pcat,
            slots_left:gnode.data['max_'+pcat+'_slots']- gnode.data[pcat+'_slots']
          };
          var slotslen = 0;
          var provided = [];
          if (game_type === 'UpgradePowerup') {
            slotslen = gnode.data.upgrade_slots;
            powerups[game_type].provided = _.filter(gnode.data.provided_upgrades, function(p){ return p.bought !== true });
          }
          else if (game_type === 'AdPowerup') {
            slotslen = gnode.data.ad_slots;
            powerups[game_type].provided = _.filter(gnode.data.provided_ads, function(p){ return p.bought !== true });
          }
          else if (game_type === 'TeamMemberPowerup') {
            slotslen = gnode.data.teammember_slots;
            powerups[game_type].provided = _.filter(gnode.data.provided_teammembers, function(p){ return p.bought !== true });
          }
          // adding slots to override default game inconsistencies
          var slots = [];
          var pagesize = 10;
          var pages = Math.ceil(slotslen/pagesize);
          _.each(_.range(0,slotslen),function(v){
            slots[v] = 'free';
          });
          // TODO: only add locked if slots < max_length of slots
          if (powerups[game_type].slots_left>0) {
            slots.push('locked');
          }
          powerups[game_type].slots = slots;
        }
      });
      _.each(gnode.data.powerups,function(p){
        // No game type? abort.
        if (!p.game_type) { 
          return;
        }
        // test if slot is free - THIS SHOULD NOT HAPPEN!
        if (powerups[p.game_type].slots[p.slot] === 'free') {
          powerups[p.game_type].slots[p.slot] = p;
        }
      });
    gnode.data.powerups_compiled = powerups;
    };
    
    ProjectPerp.prototype.removeProvidedPowerup = function(bgestalt) {
      // Does not actually remove powerup but flags as bought
      var gnode = this;
      var provided = {
        provided_ads: gnode.data.provided_ads,
        provided_upgrades: gnode.data.provided_upgrades,
        provided_teammembers: gnode.data.provided_teammembers
      };
      _.each(provided,function(p,key){
        var deleteme = _.findWhere(p,{gestalt:bgestalt});
        if (deleteme) {
          deleteme.bought = true;
          //gnode.data[key] = _.without(p, deleteme);
        }
      });
    };

    ProjectPerp.prototype.addProvidedPowerup = function(bgestalt) {
      // Does not actually add powerup but unflags as bought
      var gnode = this;
      var provided = {
        provided_ads: gnode.data.provided_ads,
        provided_upgrades: gnode.data.provided_upgrades,
        provided_teammembers: gnode.data.provided_teammembers
      };
      _.each(provided,function(p,key){
        var addme = _.findWhere(p,{gestalt:bgestalt});
        if (addme) {
          addme.bought = false;
        }
      });
    };

    GameNode.prototype.Error = function(errormsg,data){
      // TODO: consolidate Error Codes on Backend and parse them with this function
      // try to display an error or fallback to game root
      var gnode = this;
      var groot = this.GameRoot;
      if (gnode.renderPopup && gnode.renderPopup.open) {
        gnode.renderPopup.trigger('error');
      } else if (gnode.renderNode) {
        gnode.renderNode.FXError();
      } else if (groot) {
        groot.renderNode.FXError();
      } 
      if (setup.debug) {
        console.error(errormsg,data);
      }
    };

    GameNode.prototype.NoCash = function(){
      var gnode = this;
      if (gnode.renderPopup && gnode.renderPopup.open) {
        gnode.renderPopup.trigger('no_cash');
      } else {
        gnode.renderNode.FXNoCash();
      }
    };

    GameNode.prototype.NoAP = function(){
      var gnode = this;
      if (gnode.renderPopup && gnode.renderPopup.open) {
        gnode.renderPopup.trigger('no_AP');
      } else {
        gnode.renderNode.FXNoAP();
      }
    };

    ProjectPerp.prototype.BuyPowerup = function(bgestalt,bslot) {
      var gnode = this;
      var groot = this.GameRoot;
      // TODO: backendcall and do purchase...
      if (bgestalt === undefined || bslot === undefined) {
        gnode.Error('Buy powerup is missing parameters');
        return;
      }
      if (bgestalt.split(':')[0]==='buyslots') {
        gnode.BuySlots(bslot,bgestalt);
        return;
      }
      app.remote.buyPowerup(app.token, gnode.path, bslot, bgestalt).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            if (data.result.error === 3) {
              gnode.NoCash();
            } else {
              gnode.Error('The computer says NOOOO', data);
            }
            return;
          }
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          gnode.data = mergeData(gnode.data,data.result.node.instance_data);
          gnode.removeProvidedPowerup(bgestalt);
          gnode.compilePowerups();
          gnode.compileProfileSet();
          gnode.renderPopup.trigger('close_powerup',function(){
            // NOTE: close_powerup has callback with timeout
            gnode.updatePopupGracefully(bslot, bgestalt);
          });

        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
        if (data.error && data.error.message) {
          gnode.Error(data.error.message,data);
        } else {
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };

    ProjectPerp.prototype.SellPowerup = function(bgestalt,bslot) {
      var gnode = this;
      var groot = this.GameRoot;
      // TODO: backendcall and do purchase...

      app.remote.sellPowerup(app.token, gnode.path, parseInt(bslot), bgestalt).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            gnode.Error('The computer says NOOOO',data);
            return;
          }
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          //gnode.data = mergeData(gnode.data, data.result.node.instance_data);
          gnode.data = mergeData(groot.getTypeData(gnode.gestalt), data.result.node.instance_data);
          gnode.addProvidedPowerup(bgestalt);
          gnode.compilePowerups();
          gnode.compileProfileSet();
          gnode.renderPopup.trigger('close_powerup',function(){
            gnode.updatePopupGracefully(bslot, bgestalt, true);
          });
        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
        if (data.error && data.error.message) {
          gnode.Error(data.error.message,data);
        } else {
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };


    ProjectPerp.prototype.BuySlots = function(num,bgestalt) {
      var pcat = convertPowerupType(bgestalt.split(':')[1]);

      var gnode = this;
      var groot = this.GameRoot;
      
      app.remote.buySlots(app.token, gnode.path, pcat, num).done(function(data) {
        if (data.result) {
          if (data.result.error !== undefined) {
            // Probably no cash
            gnode.NoCash();
            return;
          }
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          gnode.data = mergeData(gnode.data,data.result.node.instance_data);
          gnode.compilePowerups();
          // FIXME: do this gracefully
          gnode.renderPopup.trigger('close_powerup',function(){
            gnode.updatePopup();
          });
        } else {
          // Server Error
          gnode.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
        if (data.error && data.error.message) {
          gnode.Error(data.error.message,data);
        } else {
          gnode.Error('The computer says NOOOO',data);
        }
      });
    };

    ProjectPerp.prototype.updatePopupGracefully = function(bslot, bgestalt, selling) {
      var gnode = this;
      var pcat = getPowerupTypeFromGestalt(bgestalt);
      gnode.updateTemplateData();
      if (gnode.popupTemplateData) {
        gnode.popupTemplateData.loading = false;
      }

      if (!gnode.renderPopup) { return; }
      
      var popup = gnode.renderPopup;
      popup.renderDataTab();
      popup.renderPowerupSelectors(pcat);

      var jpop = gnode.renderPopup.jdomelem;
      var jtab = jpop.find('.PopupTab[data-tab="'+ pcat +'"]');
      if (!selling) {
        // Buying a Powerup
        var slot = jtab.find('.Powerup.free[data-button-data="'+bslot+'"]');
        slot.removeAttr('data-subpop-id');
        var powerup = _.findWhere(gnode.data.powerups,{gestalt:bgestalt});
        var jpowerup = _.renderView('powerup.html', {  powerup: powerup,
                           slot: bslot,
                           key: pcat+bslot,
                           updating: true
                         });
        jtab.find('.Subpop[data-subpop-id="' + pcat+bslot + '"]').remove();
        var jpowerupSubpop = _.renderView('subpop_powerup.html', {  powerup: powerup,
                           slot: bslot,
                           key: pcat+bslot,
                         });
        jtab.find('.SubpopContainer').append(jpowerupSubpop);

        var parsed = $.parseHTML(jpowerup);
        slot.addClass('updating hide ');
        window.setTimeout(function(){
          slot.replaceWith(parsed);
          slot = jtab.find('.Powerup.updating[data-button-data="'+bslot+'"]');
          window.setTimeout(function(){
            slot.removeClass('updating').addClass('taken new');
          },400);
        },400);
        /*
        window.setTimeout(function(){
          slot = jtab.find('.Powerup.updating[data-button-data="'+bslot+'"]');
          slot.find('.PowerupBackground').delay(400).fadeOut(150,function(){
            slot.removeClass('updating').addClass('taken new');
          }).fadeIn(250);
        },800);
        */
      } else {
        // Selling a Powerup
        //gnode.updatePopup();
        var slot = jtab.find('.Powerup.taken[data-button-data="'+bslot+'"]');
        slot.removeAttr('data-subpop-id');
        var jpowerup = _.renderView('powerup_free.html', {  
                           slot: bslot,
                           slot_background: gnode.data.slot_background,
                           pkey: pcat,
                           data: gnode.popupTemplateData.data,
                           typelower: convertPowerupType(pcat),
                           updating: true
                         });
        var parsed = $.parseHTML(jpowerup);
        slot.addClass('updating hide');
        window.setTimeout(function(){
          slot.replaceWith(parsed);
          slot = jtab.find('.Powerup.updating[data-button-data="'+bslot+'"]');
          window.setTimeout(function(){
            slot.removeClass('updating').addClass('free');
          },400);
        },400);
        /*
        window.setTimeout(function(){
          slot = jtab.find('.Powerup.updating[data-button-data="'+bslot+'"]');
          slot.find('.PowerupBackground').delay(400).fadeOut(150,function(){
            slot.removeClass('updating').addClass('free');
          }).fadeIn(250);
        },800);
        */

      }
    };

    ProjectPerp.prototype.Charge = function() {
      var gnode = this;
      var groot = this.GameRoot;
      // No request when not enough cash
      if (gnode.data.charge_cost > groot.cash_value) {
        // No cash
        if (gnode.renderPopup && gnode.renderPopup.open) {
          gnode.renderPopup.trigger('no_cash');
        } else {
          gnode.renderNode.FXNoCash();
        }
        return;
      }
      if (!gnode.states.chargeRunning && gnode.states.idle) {
        // FIXME: rename Remote Call
        app.remote.chargePerp(app.token, gnode.path).done(function(data) {
          if (data.result) {
            if (data.result.error) {
              // No cash
              if (gnode.renderPopup && gnode.renderPopup.open) {
                gnode.renderPopup.trigger('no_cash');
              } else {
                gnode.renderNode.FXNoCash();
              }
              return;
            }
            if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }
            var gv = data.result.game_values;
            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);

            gnode.renderNode.FXCharge();
            gnode.markTimer({
              duration: data.result.duration,
              serverTime: 0,
              serverStartTime: 0
            });
          } else {
            // Server Error
            gnode.Error('The computer says NOOOO',data);
          }
        })
        .fail(function(data){
            gnode.Error('The computer says NOOOO',data);
        });
      }
    };

    ProjectPerp.prototype.collect = function() {
      var gperp = this;
      var gnode = this;
      var groot = this.GameRoot;
      var deco = this.renderReady;
      var popup = gperp.renderPopup;
      // No Request when no AP
      if (groot.ap_value < 1) {
        if (popup) {
          popup.trigger('no_AP');
        } else {
          deco.FXNoAP();
        }
        return;
      }
      deco.setClickable(false);
      deco.setFrame('active');
      deco.FXPulse();
      app.remote.collectPerp(app.token, gperp.path).done(function(data) {
        // FIXME: It would be better if data.result was in a predefined state to prevent testing for both, undefined _and_ null...
        if (data.result && data.result.result) {
          var amount = data.result.result.profile_set.profiles_value;
          if (popup) { popup.trigger('popup_close'); }

          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          if (data.result.karma_incident) {
            // Karmalizer
            var karma_dec = data.result.game_values.karma_value - groot.karma_value;
            groot.makeNotifications({
              karma: {
                gestalt: data.result.karma_incident,
                karma_value: karma_dec
              }
            });
          }
          deco.FXBling({text: _.toKSNum(amount), extendClass: "ProfileBling"});
          deco.FXSuck(function() {
            gperp.renderNode.FXDataOut();
            gperp.renderReady=undefined;
          });
          // Add to DB Queue
          groot.getDatabase().cue(data.result.result.profile_set, data.result.result.origin, data.result.result.collect_id);
          gperp.setState('idle',true);
        } else if (data.result && data.result.error) {
          if (popup) {
            popup.trigger('no_AP');
          } else {
            deco.FXNoAP();
          }
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
          //console.log('collect failed');
        } else {
          // ERROR
          gperp.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
          deco.FXError();
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
      });
    };


    ProjectPerp.prototype.markReady = function() {
      var gperp = this;
      var groot = this.GameRoot;
      gperp.setState('idle',false);
      gperp.setState('chargeRunning',false);
      if (gperp.renderTimer) { gperp.renderTimer.FXPuff(); }
      var deco = this.renderReady = this.renderNode.addDecorator(new Render.DecoratorReady());
      deco.FXSproing();
      deco.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gperp.collect();
      });
    };


    ///////////////////////////////////
    // The Token
    ///////////////////////////////////

    var TokenPerp = function(config) {
      this.init(config);
      if (config && config.data && config.data.amount) {
        this.setAmount(config.data.amount);
      } else {
        this.setAmount(0);
      }
      return this;
    };

    extend(TokenPerp, GamePerp);

    TokenPerp.prototype.renderType = "Perp";
    TokenPerp.prototype.cableType = "in";
    TokenPerp.prototype.popupTemplate = "popup_token.html";

    TokenPerp.prototype.setAmount = function(amount) {
      var groot = this.GameRoot;
      var absoluteAmount = (groot.profiles_value * amount) / 100;
      if (this.data.absoluteAmount) {
        this.data.previousAbsoluteAmount = this.data.absoluteAmount;
      } else {
        // FIXME: only true if new, not if game loaded
        this.data.previousAbsoluteAmount = 0;
      }
      this.data.absoluteAmount = absoluteAmount;
      this.amount = this.data.amount = amount;
      this.data.absoluteInc = this.data.absoluteAmount - this.data.previousAbsoluteAmount;
      this.data.absoluteIncPerc = (100/this.data.absoluteAmount) * this.data.absoluteInc;
      groot.DBTokens[this.gestalt] = amount;
      groot.DBTokensAbsolute[this.gestalt] = absoluteAmount;
    };

    TokenPerp.prototype.updateRenderAmount = function() {
      this.renderNode.DecoratorAmount.setAmount(this.data.amount);
    };

    TokenPerp.prototype.updateGear = function() {
      var gnode = this;
      if (gnode.data.contained_tokens.length === 0 || gnode.renderNode === undefined) {
        return;
      }
      gnode.makeProfileSet();
      var node = this.renderNode;
      var av = gnode.getUpgradeAverage();
      var frame = (av > 0) ? "normal" : "inactive";
      if (!node.DecoratorGear === undefined) {
        node.addDecorator(new Render.DecoratorGear());
      } 
      node.DecoratorGear.setFrame(frame);
    };

    TokenPerp.prototype.getUpgradeAverage = function() {
      var gnode = this;
      gnode.setState('zeroresult', true);
      if (!gnode.data.ProfileSet) {
        return 0;
      }
      var amounts = [];
      _.each(gnode.data.ProfileSet.tokens_set, function(token){
        if (!token.locked && token.diffAmount !== undefined) {
          amounts.push(token.diffAmount);
        }
      });
      var len = amounts.length || 1;
      gnode.data.upgradeAverage = Math.round((_.reduce(amounts, function(memo, num){ return memo + num; }, 0) / len) * 100 ) / 100;
      if (gnode.data.upgradeAverage > 0) {
        gnode.setState('zeroresult', false);
      }
      return gnode.data.upgradeAverage;
    };

    TokenPerp.prototype.extendRender = function() {
      var render = this.renderData || {};
      var gnode = this;
      var groot = this.GameRoot;
      var node = this.renderNode;
      node.sticky = this.sticky;

      if (render.config.label) {
        node.addDecorator(new Render.DecoratorLabel({text: render.config.label, extendClass: this.labelClass, offsetToParent: {x: 0,y: 6}}));
      }
      var amount = this.data.amount || 0;

      node.addDecorator(new Render.DecoratorAmount({amount:amount,decoratedNode:node}));
      
      if (this.data.contained_tokens && this.data.contained_tokens.length) {
        node.addDecorator(new Render.DecoratorGear());
        gnode.updateGear();
      }

      if (this._loadReady) {
        this.markReady();
        this._loadReady = undefined;
      } else if (this._loadTimer) {
        this.markTimer(this._loadTimer);
        this._loadTimer = undefined;
      }

      if (gnode.states.idle === false && gnode.data.contained_tokens.length) {
        _.each(gnode.data.contained_tokens,function(t){
          var ct = getByGestalt(t.gestalt);
          if (ct && ct.renderNode) {
            gnode.renderNode.cableTo(ct.renderNode, {cableMaxLength:1920,mode:'in',noWobble:true});
          }
        });
      }


    };

    TokenPerp.prototype.makeProfileSet = function() {
      var gnode = this;
      gnode.data.ProfileSet = new ProfileSet({
        lockNotInDB:true, 
        DBAmounts:true, 
        markUpgradeValues: true, 
        lastUpgradeValues: gnode.data.last_upgrade_values 
      }, gnode.data.contained_tokens);
    };

    TokenPerp.prototype.extendEventHandlers = function() {
      var gnode = this;
      
      gnode.on('vshiftclick',function(e,renderNode) {
        e.stopPropagation();
        if (gnode.data.contained_tokens.length) {
          gnode.Charge();
        }
      });

      gnode.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        if (gnode.data.contained_tokens) {
          var lastUpgradeValues = gnode.data.last_upgrade_values;
          gnode.makeProfileSet();
        }
        var popup = this.openPopup();
      });
      
      gnode.on('node_ready',function(e,result) {
        e.stopPropagation();
        // FIXME result has no meaning here?! since A) event can be triggered by non-socket-io b) markready takes no argument.
        //gnode.markReady(result);
        //console.log('node_ready',result);
        gnode.data.last_upgrade_values = result.last_upgrade_data;
        gnode.markReady();
      });
      
    };


    TokenPerp.prototype.Charge = function() {
      var gnode = this;
      var rnode = this.renderNode;
      var groot = this.GameRoot;
      // No request when not enough AP
      if (groot.ap_value < 1) {
        // No AP
        if (gnode.renderPopup && gnode.renderPopup.open) {
          gnode.renderPopup.trigger('no_AP');
        } else {
          gnode.renderNode.FXNoAP();
        }
        return;
      }
      if (!gnode.states.chargeRunning && gnode.states.idle && !gnode.states.zeroresult) {

        //console.log('charge');
        app.remote.chargePerp(app.token, gnode.path).done(function(data) {
          if (data.result) {
            if (data.result.error) {
              // No AP
              if (gnode.renderPopup && gnode.renderPopup.open) {
                gnode.renderPopup.trigger('no_AP');
              } else {
                gnode.renderNode.FXAP();
              }
              return;
            }
            if (gnode.renderPopup) { gnode.renderPopup.trigger('popup_close'); }

            groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
            gnode.renderNode.FXCharge('AP');

            rnode.DecoratorGear.remove();
            gnode.markTimer({
              duration: data.result.duration,
              serverTime: 0,
              serverStartTime: 0
            });

            var wait = 300;
            
            _.each(gnode.data.contained_tokens,function(t){
              var ct = getByGestalt(t.gestalt);
              if (ct && ct.renderNode) {
                window.setTimeout(function(){
                  var cable = gnode.renderNode.cableAnimatedTo(ct.renderNode, {cableMaxLength:1920,mode:'in',noWobble:true});
                  window.setTimeout(function(){
                    cable.FXDataIn(function(){
                      gnode.renderNode.FXBounce();
                    });
                  },wait+400);
                },wait);
                wait = wait+150;
              }
            });

          } else {
            gnode.Error('The computer says NOOOO',data);
          }
        })
        .fail(function(data){
            gnode.Error('The computer says NOOOO',data);
        });
      }

    };

    TokenPerp.prototype.collect = function() {
      var gperp = this;
      var groot = this.GameRoot;
      var deco = this.renderReady;
      if (groot.ap_value < 1) {
        deco.FXNoAP();
        return;
      }

      var popup = gperp.renderPopup;
      deco.setClickable(false);
      deco.setFrame('active');
      deco.FXPulse();

      app.remote.collectPerp(app.token, gperp.path).done(function(data) {
        if (data.result && data.result.result) {

          if (popup) { popup.trigger('popup_close'); }
          // FIXME: compile for checkNotifications
          groot.getDatabase().compileSuperTokens();
          var amount = data.result.result.token_upgraded_amount;
          gperp.setAmount(amount);
          groot.updateGameValues(data.result.game_values,data.result.levelup,data.result.missions);
          //deco.FXBling({text: _.toKSNum(gperp.data.absoluteIncPerc) + "%", extendClass: "ProfileBling"});
          deco.FXSuck(function() {
            //gperp.renderNode.DecoratorGear.show();
            gperp.renderNode.addDecorator(new Render.DecoratorGear());
            gperp.updateGear();
            gperp.renderNode.DecoratorGear.FXSproing();
            gperp.renderReady=undefined;
            window.setTimeout(function(){
              groot.getDatabase().checkNotifications();
              groot.updateGears();
            },2000);
          });
          var wait = 0;

          /* 
          //FX WITHOUT CABLES 
          _.each(gperp.data.contained_tokens,function(t){
            var ct = getByGestalt(t.gestalt);
            if (ct && ct.renderNode) {
              window.setTimeout(function(){gperp.renderNode.FXSpark({oPos:ct.renderNode.getPosition(),text: 'snu'})},wait);
              wait = wait+200;
            }
          });
          */
          
          // FX WITH CABLES
          _.each(gperp.data.contained_tokens,function(t){
            var ct = getByGestalt(t.gestalt);
            if (ct && ct.renderNode) {
              //window.setTimeout(function(){
                //ct.renderNode.FXDataOut();
                window.setTimeout(function(){
                  gperp.renderNode.cableAnimatedRemove(ct.renderNode);
                },wait+200);
              //},wait);
              wait = wait+200;
            }
          });
          // FIXME when previous was 0 there's something wrong here...
          //var text = "+" + _.toKSNum(gperp.data.absoluteIncPerc) + "%";
          var text = "+" + _.toKSNum(gperp.data.absoluteInc);
          window.setTimeout(function(){
            gperp.renderNode.FXSpinner({text: text,duration:wait},function(){
              gperp.updateRenderAmount();
              //gperp.renderNode.DecoratorAmount.setAmount(gperp.data.amount); 
            });
          },800);
          // FIXME Merge to DB

          gperp.setState('idle',true);
        } else if (data.result && data.result.error) {
          deco.FXNoAP();
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
          //console.log('collect failed');
        } else {
          // ERROR
          gperp.Error('The computer says NOOOO',data);
        }
      })
      .fail(function(data){
          deco.FXError();
          deco.FXStop();
          deco.setClickable(true);
          deco.setFrame('normal');
      });
    };



    TokenPerp.prototype.markReady = function() {
      var gperp = this;
      var groot = this.GameRoot;
      gperp.setState('idle',false);
      gperp.setState('chargeRunning',false);
      if (gperp.renderTimer) { gperp.renderTimer.FXPuff(); }
      var deco = this.renderReady = this.renderNode.addDecorator(new Render.DecoratorReady({mode:'gear'}));
      deco.FXSproing();
      deco.on('vclick',function(e,renderNode) {
        e.stopPropagation();
        gperp.collect();
      });
    };



    ///////////////////////////////////
    // The Supertoken
    ///////////////////////////////////

    var SupertokenPerp = function(config) {
      this.init(config);
      return this;
    };

    extend(SupertokenPerp, GamePerp);

    SupertokenPerp.prototype.renderType = "Perp";
    TokenPerp.prototype.cableType = "inout";
    
    ////////////////////////////////////////////
    // The API Publisher
    ////////////////////////////////////////////

    var Game = {
      get : get,
      getById : getById,
      getByType : getByType,
      getByGestalt : getByGestalt,
      getAllByGestalt : getAllByGestalt,
      eachByGestalt : eachByGestalt,
      APTicker : APTicker,
      init:init,
      _instances:_instances,
      _ids:_ids,
      GameNode:GameNode,
      GameRoot:GameRoot,
      Mission:Mission,
      Missions:Missions,
      Topscores:Topscores,
      Topscore:Topscore,
      Imperium:Imperium,
      Database:Database,
      DatabasePerp:DatabasePerp,
      CityPerp:CityPerp,
      AgentPerp:AgentPerp,
      ContactPerp:ContactPerp,
      PusherPerp:PusherPerp,
      ClientPerp:ClientPerp,
      TokenPerp:TokenPerp,
      ProxyPerp:ProxyPerp,
      ProjectPerp:ProjectPerp,
      SupertokenPerp:SupertokenPerp
    };

    return Game;
  };

  var game;

  return {
    getGame: function() {
      game = game || Game();
      return game;
    }
  };

});
