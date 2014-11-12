define(function(require) {

  var Render = function() {

    var _ = require('underscore');
    var $ = require('jquery');
    //var routie = require('routie');

    var Scroller = require('zynga-scroller');
    var core = require('zynga-animate');

    var Easel = require('createjs-easel');
    var Tween = require('createjs-tween');
    var Sound = require('createjs-sound');
    var Ticker = Easel.Ticker;
    var Ease = Easel.Ease;

    var app = require('app').getApplication();
    var setup = require('setup');
    var extend = require('util').extend;

    var renderConf = {
      cableResolution : 2,
      tickerFramerate : 60,
      slowTickerFrameRate: 120,
      viewMapPerspective: setup.viewMapPerspective,
      viewMapStopZone : setup.viewMapStopZone
    };

    /* FIXME: IE checks in renderengine
    var IE = false;
    if (!$.support.style) {
      IE = true;
    }
    */

    Ticker.setFPS(renderConf.tickerFramerate);
    Ticker.useRAF = true;


    //////////////////////////////////////////
    //
    // The Render API
    //
    // Instantiates a tree like structure of
    // render nodes, feeds events back to
    // Game controller if available.
    // Uses mostly jQuery and Vanilla-JS to 
    // manipulate the DOM
    // 
    // Here be dragons and sea serpents...
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

    var getById = function(id) {
      return _ids[id];
    };

    var remove = function(_id){
      if (get(_id)) {
        delete _ids[get(_id).id];
      }
      _instances[_id]=undefined;
    };

    var clear = function() {
      // Clear everything that has been rendered so far
      for (var n=0;n<_instances.length;n++) {
        var node = _instances[n];
        if (node) {
          node.remove();
        }
      }
      _instances.length = 0;
    };


    /////////////////////////////////////////////
    // The Draghandler
    /////////////////////////////////////////////

    var DragHandler = function() {
      this.jdomelem = $(window);
      this.domelem = window;
      this.scale=1;
      this.listeners=[];
      this.init();
      this.state='stopped';
      this.dragging=false;
    };

    DragHandler.prototype.addListener = function(node){
      //if (!node.draggable) return;
      node.dragStartPos = {
        x: node.getPosition().x,
        y: node.getPosition().y
      };
      node.dragging=true;
      node.trigger('dragstart');
      this.listeners.push(node);
    };

    DragHandler.prototype.removeListener = function(node){
      var index = this.listeners.indexOf(node);
      if (index !== -1) {
        this.listeners[index].trigger('dragend');
        this.listeners.splice(index, 1);
      }
    };

    DragHandler.prototype.dragVector = {};
    DragHandler.prototype.dragstart = function(e) {
      var dm = this;
      dm.state='started';
      // FIXME: trigger touchhandling broken?!
      var touch;
      if (e.originalEvent) {
        touch = (e.originalEvent.touches) ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : undefined;
      }
      var userPos = (touch) ? {x:touch.pageX,y:touch.pageY} : {x:e.pageX,y:e.pageY};
      dm.dragMovePos = dm.dragStartPos = userPos;
      dm.dragging = true;
      delete dm.dragVector.x;
      delete dm.dragVector.y;
      dm.dragVector.x = (dm.dragMovePos.x - dm.dragStartPos.x)*dm.scale;
      dm.dragVector.y = (dm.dragMovePos.y - dm.dragStartPos.y)*dm.scale;
    };

    DragHandler.prototype.dragend = function(e){
      var dm = this;
      dm.state='stopped';

      for (var i=0;i<dm.listeners.length;i++) {
        var node = dm.listeners[i];
        node.dragging=false;
        node.trigger('dragend');
      }
      dm.listeners.length=0;
      dm.dragging = false;
    };

    DragHandler.prototype.on = function(event,func){
      this.jdomelem.on(event,func);
    };

    DragHandler.prototype.off = function(event){
      this.jdomelem.off(event);
    };


    DragHandler.prototype.trigger = function(event,params){
      this.jdomelem.trigger(event,params);
    };



    DragHandler.prototype.getCollisionPos = function(node,newPos) {
      var result = {
        x: newPos.x,
        y: newPos.y,
        coll:false
      };
      var posX = newPos.x-node.offsetX;
      var posY = newPos.y-node.offsetY;
      var width   = node.getSize().width;
      var height  = node.getSize().height;
      var rect1 = {
          tl: { x: posX, y: posY },
          tr: { x: posX + width, y: posY },
          bl: { x: posX, y: posY + height },
          br: { x: posX + width, y: posY + height }
      };

      this.collisionNodes.each(function(node2,k){
        if (node2 !== node) {
          var posX2 = node2.getPosition().x-node2.offsetX;
          var posY2 = node2.getPosition().y-node2.offsetY;
          var width2   = node2.getSize().width;
          var height2  = node2.getSize().height;
          var rect2 = {
              tl: { x: posX2, y: posY2 },
              tr: { x: posX2 + width2, y: posY2 },
              bl: { x: posX2, y: posY2 + height2 },
              br: { x: posX2 + width2, y: posY2 + height2 }
          };
          if (!(
            rect1.br.x < rect2.bl.x ||
            rect1.bl.x > rect2.br.x ||
            rect1.bl.y < rect2.tl.y ||
            rect1.tl.y > rect2.bl.y
          )) {
            // Oooh myyy
            result.coll = true;
            var width12 = width/2 + width2/2;
            var height12 = height/2 + height2/2
            var overlapX = (rect1.tr.x - rect2.tl.x) - width12;
            var overlapY = (rect1.bl.y - rect2.tl.y) - height12;
            if (Math.abs(overlapY) > Math.abs(overlapX)) {
              if (overlapY > 0) {
                result.y = newPos.y + (height12 - overlapY);
              } else {
                result.y = newPos.y - (height12 + overlapY);
              }
            } else {
              if (overlapX > 0) {
                result.x = newPos.x + (width12 - overlapX);
              } else {
                result.x = newPos.x - (width12 + overlapX);
              }
            }
            return result;
          }
        }
      });
      return result;
    };

    DragHandler.prototype.testCollisions = function(node,newPos) {
      var coll = false;
      var posX = newPos.x-node.offsetX;
      var posY = newPos.y-node.offsetY;
      var width   = node.getSize().width;
      var height  = node.getSize().height;
      var rect1 = {
          tl: { x: posX, y: posY },
          tr: { x: posX + width, y: posY },
          bl: { x: posX, y: posY + height },
          br: { x: posX + width, y: posY + height }
      };

      this.collisionNodes.each(function(node2,k){
        if (node2 !== node) {
          var posX2 = node2.getPosition().x-node2.offsetX;
          var posY2 = node2.getPosition().y-node2.offsetY;
          var width2   = node2.getSize().width;
          var height2  = node2.getSize().height;
          var rect2 = {
              tl: { x: posX2, y: posY2 },
              tr: { x: posX2 + width2, y: posY2 },
              bl: { x: posX2, y: posY2 + height2 },
              br: { x: posX2 + width2, y: posY2 + height2 }
          };
          if (!(
            rect1.br.x < rect2.bl.x ||
            rect1.bl.x > rect2.br.x ||
            rect1.bl.y < rect2.tl.y ||
            rect1.tl.y > rect2.bl.y
          )) {
            coll = true;
            return coll;
          }
        }
      });
      return coll;
    };


    DragHandler.prototype.getCollisions = function(node) {
      if (this.collisionNodes.set.length === 0) {
        return false;
      }
      var data = [];
      // TODO: Calculate or store Bounding-Box on Perp generation for performance reasons
      //       and to get better visual collisions (e.g. store in framemaps...)
      this.collisionNodes.each(function(node){
        // Add / Subtract 20px for less annyoing detection for now.
        var posX = node.getPosition().x-node.offsetX;
        var posY = node.getPosition().y-node.offsetY;
        var width   = node.getSize().width;
        var height  = node.getSize().height;

        data.push({
          tl: { x: posX, y: posY },
          tr: { x: posX + width, y: posY },
          bl: { x: posX, y: posY + height },
          br: { x: posX + width, y: posY + height }
        });
      });

      var i, l;

      i = data.length;
      while(i--) {
        l = data.length;
        while(l-- && l !== i) {
          if (!(
            data[l].br.x < data[i].bl.x ||
            data[l].bl.x > data[i].br.x ||
            data[l].bl.y < data[i].tl.y ||
            data[l].tl.y > data[i].bl.y
          )) {
            return true;
          }
        }
      }
      return false;
    };

    DragHandler.prototype.init = function(){
      var dm = this;
      dm.collisionNodes = new Set();

      this.on('mouseup touchend',function(e){
        e.preventDefault();
        e.stopPropagation();
        dm.dragend(e);
      });
      this.on('mousemove touchmove',function(e){
        if (!dm.dragging) {
          return;
        }
        /* Uncomment to delay dragging for timeout and then snap into position
        if (!dm.listeners.length) {
          return;
        }*/
        dm.state='moved';
        // FIXME: touchhandling broken?!
        var touch;
        if (e.originalEvent) {
          touch = (e.originalEvent.touches) ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : undefined;
        }
        var userPos = touch ? {x: touch.pageX, y: touch.pageY} : {x: e.pageX, y: e.pageY};
        dm.dragMovePos = userPos;
        dm.dragVector.x = (dm.dragMovePos.x - dm.dragStartPos.x)*dm.scale;
        dm.dragVector.y = (dm.dragMovePos.y - dm.dragStartPos.y)*dm.scale;
        // Drag pixel threshold
        if (Math.abs(dm.dragVector.x) > 16 || Math.abs(dm.dragVector.y) > 16) {
          dm.trigger('catchup');
        }
        for (var i=0;i<dm.listeners.length;i++) {
          var node = dm.listeners[i];
          node.trigger('dragmove');
          var oldPos = {
            x : node.getPosition().x,
            y : node.getPosition().y
          };
          var newPos = {
            x: node.dragStartPos.x + dm.dragVector.x,
            y: node.dragStartPos.y + dm.dragVector.y
          };
          if (e.shiftKey) {
            newPos.x = Math.round(newPos.x/20)*20;
            newPos.y = Math.round(newPos.y/20)*20;
          }

          // Start: Perp related special draghandling
          newPos = node.clipCablePos(newPos);

          // Delete line below to turn on collisions
          node.moveTo(newPos);
          /* uncomment for collisions on drag
          var collPos = dm.getCollisionPos(node,newPos);
          if (collPos.coll === true ) {
            node.FXSimple({x:collPos.x,y:collPos.y},50,'linear');
          } else {
            node.moveTo(collPos);
          }
          */
        }
      });
    };


    ///////////////////////////////////////////
    // The Set
    // An array of Nodes with some shortcuts
    ///////////////////////////////////////////

    var Set = function(set){
      if (!set) {
        set = [];
      }
      //this._id = _instances.length;
      //addSet(this);
      this.set = set;
      this.length = this.set.length;
      return this;
    };

    Set.prototype.add = function(node){
      this.set.push(node);
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

    Set.prototype.hide = function() {
      this.each(function(node) {
        node.hide();
      });
    };

    Set.prototype.show = function() {
      this.each(function(node) {
        node.show();
      });
    };

    Set.prototype.fade = function(opa) {
      this.each(function(node){
        node.setOpacity(opa);
      });
    };

    Set.prototype.draw = function() {
      this.each(function(node) {
        node.draw();
      });
    };

    Set.prototype.removeAll = function() {
      var set = this;
      while (this.set.length>0) {
        var node = this.set[0];
        this.remove(node);
        node.remove();
      }
    };

    Set.prototype.clear = function() {
      this.set.length=0;
    };


    /////////////////////////////////////////////
    // The SlowTicker
    /////////////////////////////////////////////

    // Written as Singleton, like original Ticker

    var SlowTicker = {
      start: function(){
        if (!this.timeout) {
          this.tick();
        }
      },
      tick: function(){
        this.listeners.each(function(node){
          node.tick();
        });
        this.timeout = window.setTimeout(function(){SlowTicker.tick();},renderConf.slowTickerFrameRate);
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
    SlowTicker.listeners = new Set();
    SlowTicker.start();


    /////////////////////////////
    // The Node
    // Basic Render Node with DOM Element
    /////////////////////////////

    var Node = function(config){
      config = config || {};
      this.jdomelem = config.jdomelem || $("<div class='Node'></div>");
      this.domelem = config.domelem || this.jdomelem[0];
      this.init(config);
      return this;
    };

    Node.prototype.init = function(config){
      // Add to the Render Getter
      this._id = _instances.length;
      this.id = config.id || "Node"+this._id;
      add(this);
      // Set Node defaults if undefined
      config = config || {};

      this.children = new Set();
      this.decorators = new Set();

      this.setAttrs(config);
      if (!this.jdomelem) { this.jdomelem = $(this.domelem); }
      this.jdomelem.attr('id',this.id);
      this.updateClass();
    };

    Node.prototype.x = 0;
    Node.prototype.y = 0;
    Node.prototype.z = 0;
    Node.prototype.position = 'absolute';
    Node.prototype.width = 0;
    Node.prototype.height = 0;
    Node.prototype.opacity = 1;
    Node.prototype.offsetX = 0;
    Node.prototype.offsetY = 0;
    Node.prototype.transX = 0;
    Node.prototype.transY = 0;
    Node.prototype.scaleX = 1;
    Node.prototype.scaleY = 1;
    Node.prototype.rotate = 0;
    Node.prototype.hidden = false;
    Node.prototype.display = 'block';
    Node.prototype.clickable = false;
    Node.prototype.draggable = false;
    Node.prototype.dragging = false;
    Node.prototype.sticky = false;
    Node.prototype.extendClass = undefined;

    Node.prototype.setAttrs = function(attrs){
      // Set any attribute(s)
      for (var key in attrs) {
        if (attrs.hasOwnProperty(key)) {
          this[key] = attrs[key];
        }
      }
    };

    Node.prototype.onAddInit = function(){
      // Init stuff when added to a Parent Node
      if (this.draggable) {
        this.setDraggable(true);
      }
      if (this.clickable) {
        this.setClickable(true);
      }
      this.updateRenderProp();
      this.draw();
    };

    Node.prototype.remove = function(){
      // Remove Node from all references and remove Domobject
      Ticker.removeListener(this);
      SlowTicker.removeListener(this);
      var node = this;
      if (this.decoratedNode) {
        this.decoratedNode.decorators.remove(this);
      }
      if (this.parentNode) {
        this.parentNode.children.remove(this);
      }
      if (this.children) {
        this.children.removeAll();
      }
      if (this.cables) {
        this.cables.removeAll();
      }
      if (this.decorators) {
        this.decorators.removeAll();
      }
      if (this.perpTo) {
        this.perpTo.cables.remove(node);
      }
      if (this.perpFrom) {
        this.perpFrom.cables.remove(node);
      }
      this.jdomelem.remove();
      remove(this._id);
    };

    Node.prototype.addChild = function(child){
      // Add a child to a Node
      // This actually draws an element on the screen when the topmost Node is inside the html body
      if (child.hidden) {
        child.hide();
      }
      this.jdomelem.append(child.domelem);
      child.parentNode = this;
      this.children.add(child);
      child.dragHandler = child.dragHandler || this.dragHandler;
      child.useDragHandler = this.dragHandler;
      child.onAddInit();
      return child;
    };

    Node.prototype.addPopup = function(popup){
      // Add a popup to a Node
      // This draws the popup on the screen inside the popupContainer of the node
      if (!this.popupContainerDomelem) { return; }
      this.popupContainerDomelem.empty();
      this.popupContainerDomelem.append(popup.jdomelem);
      //this.lock();
      popup.parentNode = this;
      this.children.add(popup);
      popup.dragHandler = popup.dragHandler || this.dragHandler;
      popup.useDragHandler = this.dragHandler;
      popup.onAddInit();
      return popup;
    };

    Node.prototype.addDecorator = function(deco){
      // Add a Decorator to a Node
      // This actually draws an element on the screen when the topmost Node is inside the html body
      if (!this.parentNode) {
        return 'Could not decorate';
      }
      //config = config || {};
      //var deco = new Render[type](config,this);
      this.decorators.add(deco);
      if (deco.decoType) {
        if (this[deco.decoType]) {
          this[deco.decoType].remove();
        }
        this[deco.decoType] = deco;
      }
      deco.decoratedNode=this;
      this.parentNode.addChild(deco);
      return deco;
    };

    Node.prototype.removeChild = function(node){
      this.children.remove(node);
    };

    Node.prototype.getPosition = function(){
      // Quickly return the relative position of an Node in respect to its offset
      return {x:this.x, y:this.y};
    };

    Node.prototype.getTopLeftPosition = function(){
      // Quickly return the relative position of an Node in disrespect to its offset
      var pos = this.getPosition();
      var off = this.getOffset();
      return {x: pos.x - off.x, y: pos.y - off.y};
    };

    Node.prototype.getTopRightPosition = function(){
      // Quickly return the relative position of an Node in disrespect to its offset
      var pos = this.getPosition();
      var off = this.getOffset();
      return {x: pos.x + this.width - off.x, y: pos.y - off.y};
    };


    Node.prototype.setPosition = function(pos){
      // Set the relative Position of a Node and invoke dragBound Method if available
      if (this.dragBound) {
        this.dragBound(pos);
      }
      // CSS translation offset is center by default, calculate offset for our coords
      var transOffset = {
        x:(this.getSize().width/2)-this.offsetX,
        y:(this.getSize().height/2)-this.offsetY
      };
      // Round for render performance and better sprite anti aliasing
      pos.x = Math.round(pos.x);
      pos.y = Math.round(pos.y);
      this.domelem.style.webkitTransformOriginZ = 0;
      // FIXME: Unsure if working correctly, test offset calculation
      this.domelem.style.webkitTransformOriginX = pos.x-transOffset.x + "px";
      this.domelem.style.webkitTransformOriginY = pos.y-transOffset.y + "px";
      // Fix for Mozilla offset:
      this.domelem.style.MozTransformOrigin = pos.x + "px " + pos.y + "px";

      this.domelem.style.msTransformOrigin = pos.x + "px " + pos.y + "px";

      this.setTransform({transX:pos.x-this.offsetX,transY:pos.y-this.offsetY});
      this.x = pos.x;
      this.y = pos.y;
    };

    Node.prototype.setOffset = function(offset) {
      // Set new Offset and place Object accordingly
      var offsetDiffX = this.offsetX-offset.x;
      var offsetDiffY = this.offsetY-offset.y;
      this.offsetX = offset.x;
      this.offsetY = offset.y;
      this.setPosition(this.getPosition());
    };

    Node.prototype.getOffset = function(offset) {
      return {
        x:this.offsetX,
        y:this.offsetY
      };
    };

    Node.prototype.getCenterPosition = function(){
      // The actual center regardless of Offset/Pivot and scaling
      return {
        x: this.x + (this.getSize().width / 2),
        y: this.y + (this.getSize().height / 2)
      };
    };

    Node.prototype.getScaledPosition = function(){
      // The actual center regardless of Offset/Pivot and scaling
      return {
        x:this.x+(this.getScaledSize().width/2),
        y:this.y+(this.getScaledSize().height/2)
      };
    };

    Node.prototype.moveTo = function(pos){
      // Wrapper for setPosition, overwritten by e.g. Perp to move along Decorators
      // and Cables
      this.setPosition(pos);
    };

    Node.prototype.moveBy = function(vector){
      // Move node by vector
      // and Cables
      this.moveTo({
        x: this.getPosition().x + vector.x,
        y: this.getPosition().y + vector.y
      });
    };

    Node.prototype.clipCablePos = function(newPos) {
      var node = this;
      if (node.cables && node.cables.set.length) {
        var cablecheck = false;
        //node.cables.each(node.cables.set,function(cable){ return cable.length > cable.cableMaxLength-10 });
        for (var n=0;n < node.cables.set.length; n++) {
          var cable = node.cables.set[n];
          if (cable.length > cable.cableMaxLength-10) {
            cablecheck = true;
            break;
          }
        }

        var dragBoundFunc = function(pos, otherPos, cableMaxLength) {
          var circle = {
            x: otherPos.x,
            y: otherPos.y,
            r: cableMaxLength
          };
          var scale = circle.r / Math.sqrt(
            Math.pow(pos.x-circle.x,2) +
            Math.pow(pos.y-circle.y,2)
          );
          if (scale < 1) {
            return {
              y: Math.round((pos.y-circle.y)*scale+circle.y),
              x: Math.round((pos.x-circle.x)*scale+circle.x)
            };
          }
          else {
            return pos;
          }
        };
        if (cablecheck) {
          node.cables.each(function(cable){
            var otherperp = (cable.perpFrom === node) ? cable.perpTo : cable.perpFrom;
            var otherPos = otherperp.getPosition();
            newPos = dragBoundFunc(newPos, otherPos, cable.cableMaxLength);
          });
        }
        return newPos;
      } else {
        return newPos;
      }
    };

    Node.prototype.testParentRadius = function(newPos,radius) {
      var node = this;
      radius = radius || 400;
      var otherperp = node.gameNode.parentNode.renderNode;
      var dragBoundFunc = function(pos) {
        var circle = {
          x: otherperp.getPosition().x,
          y: otherperp.getPosition().y,
          r: radius
        };
        var scale = circle.r / Math.sqrt(
          Math.pow(pos.x-circle.x,2) +
          Math.pow(pos.y-circle.y,2)
        );
        if (scale < 1) {
          return {
            y: Math.round((pos.y-circle.y)*scale+circle.y),
            x: Math.round((pos.x-circle.x)*scale+circle.x)
          };
        }
        else {
          return pos;
        }
      };
      var clipPos = dragBoundFunc(newPos);
      newPos.x = clipPos.x;
      newPos.y = clipPos.y;
      return newPos;
    };


    Node.prototype.hide = function(){
      this.css({
        'display': 'none'
      });
      this.hidden = true;
      if (this.decorators) { this.decorators.hide(); }
    };

    Node.prototype.show = function(){
      this.css({
        'display': this.display
      });
      this.hidden = false;
      if (this.decorators) { this.decorators.show(); }
    };

    Node.prototype.css = function(css) {
      // Wrapper for CSS manipulation of domelem, currently jQuery
      this.jdomelem.css(css);
    };

    Node.prototype.updateClass = function(){
      if (this.extendClass) {
        this.jdomelem.addClass(this.extendClass);
      }
    };

    Node.prototype.updateRenderProp = function() {
      // Update misc render properties, might be obsolete
      this.css({
        'z-index': this.z,
        'position': this.position,
        'top': 0,
        'left': 0,
        'display': this.display
      });
    };

    Node.prototype.setZ = function(z) {
      // Update misc render properties, might be obsolete
      this.z = z;
      this.css({
        'z-index': this.z
      });
    };

    Node.prototype.setOpacity = function(opacity) {
      this.opacity = opacity;
      this.css({
        opacity: opacity
        //display: (opacity === 0) ? "none" : this.display
      });
    };

    Node.prototype.setTransform = function(transf) {
      // Set one or more CSS Transforms with respect to the specific Browser APIs
      // settings: scaleX, scaleY, transX, transY, rotate
      // TODO: get rid of jQuery wrapper and implement native JS with fallbacks
      this.setAttrs(transf);
      this.css({
        "-webkit-transform-style": "preserve-3d",
        "-webkit-backface-visibility": "hidden",
        "-moz-transform-style": "preserve-3d", // Massive FF Performance Boost on Scrolling ;)
        "-webkit-transform": "rotateZ("+this.rotate+"deg) scale3d("+this.scaleX+","+this.scaleY+",1) translate3d("+ (this.transX) +"px,"+ (this.transY) +"px,0px)",
        "-moz-transform": "rotateZ("+this.rotate+"deg) scale3d("+this.scaleX+","+this.scaleY+",1) translate3d("+ (this.transX) +"px,"+ (this.transY) +"px,0px)",
        //"-moz-transform": "rotate("+this.rotate+"deg) scale("+this.scaleX+","+this.scaleY+") translate("+ (this.transX) +"px,"+ (this.transY) +"px)",
        // FIXME IE 2D
        //"-ms-transform": "rotate("+this.rotate+"deg) scale("+this.scaleX+","+this.scaleY+") translate("+ (this.transX) +"px,"+ (this.transY) +"px)",
        "-ms-transform": "rotateZ("+this.rotate+"deg) scale3d("+this.scaleX+","+this.scaleY+",1) translate3d("+ (this.transX) +"px,"+ (this.transY) +"px,0px)",
        "-transform": "rotateZ("+this.rotate+"deg) scale3d("+this.scaleX+","+this.scaleY+",1) translate3d("+ (this.transX) +"px,"+ (this.transY) +"px,0px)"
      });
    };

    Node.prototype.getTransform = function() {
      // Might be obsolete
      return {
        scaleX : this.scaleX,
        scaleY : this.scaleY,
        transX : this.transX,
        transY : this.transY,
        rotate : this.rotate
      };
    };

    Node.prototype.setSize = function(size){
      this.setAttrs(size);
      this.css({
        'width':this.width+"px",
        'height':this.height+"px"
      });
    };

    Node.prototype.getSize = function(){
      return {width: this.width, height: this.height};
    };

    Node.prototype.getScaledSize = function(){
      return {width: this.width * this.scaleX, height: this.height * this.scaleY};
    };

    Node.prototype.getVectorTo = function(node2) {
      // Get vector to other node
      return {
        x: node2.getPosition().x - this.getPosition().x,
        y: node2.getPosition().y - this.getPosition().y
      };
    };

    Node.prototype.getVectorPos = function(vector,scale) {
      // Get the endpos when adding vector, scale scales length of vector (0-1)
      scale = scale || 1;
      return {
        x: this.getPosition().x + vector.x*scale,
        y: this.getPosition().y + vector.y*scale
      };
    };


    Node.prototype.draw = function(){
      // Update domelem to current settings
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    Node.prototype.tick = function(){
      // Function to run on EasleJS Ticker Intervals
      this.draw();
    };

    Node.prototype.on = function(event,func){
      // Wrapper for ".on" events
      this.jdomelem.on(event,func);
    };

    Node.prototype.trigger = function(event,params){
      // Wrapper for ".trigger" events
      if (this.gameNode) {
        this.gameNode.trigger(event,params);
      }
      this.jdomelem.trigger(event,params);
    };

    Node.prototype.off = function(event){
      // Wrapper for ".off" events
      this.jdomelem.off(event);
    };


    ////////////////////////////////
    // Node Click and Draghandler
    ////////////////////////////////

    // TODO: wrap dragevents and add to seperate mousedown touchstart handler
    Node.prototype.setDraggable = function(bit){
      var node = this;
      if (bit) {
        node.draggable = true;
        if (node.detectCollisions) {
          node.useDragHandler.collisionNodes.add(node);
        }
        node.on('mousedown touchstart',function(e){
          e.preventDefault();
          e.stopPropagation();

          // Start dragging by timeout (visual hint)
          node.dragDelay = window.setTimeout(function(){
            node.useDragHandler.addListener(node);
            node.cancelClick = true;
            node.useDragHandler.off('catchup');
          },350);

          // Start dragging by mousemove > 10px
          node.useDragHandler.on('catchup',function(e){
            node.useDragHandler.addListener(node);
            node.cancelClick = true;
            node.useDragHandler.off('catchup');
            window.clearTimeout(node.dragDelay);
          });

          // Always start the draghandler
          node.useDragHandler.dragstart(e);

        });
        node.on('mouseup touchend',function(e){
          node.useDragHandler.off('catchup');
          window.clearTimeout(node.dragDelay);
        });
      } else {
        if (node.draggable) {
          node.off('mousedown touchstart');
          node.useDragHandler.off('catchup');
          node.draggable = false;
          if (node.detectCollisions) {
            node.useDragHandler.collisionNodes.remove(node);
          }
          if (node.clickable) {
            node.setClickable(true);
          }
        }
      }
    };

    Node.prototype.setClickable = function(bit){
      var node = this;
      node.cancelClick = true;
      if (bit) {
        node.clickable= true;
        node.on('mousedown touchstart',function(e){
          e.preventDefault();
          e.stopPropagation();
          node.cancelClick = false;
          if (node.cancelClickTimeout) {
            window.clearTimeout(node.cancelClickTimeout);
          }
          node.cancelClickTimeout = window.setTimeout(function(){
            node.cancelClick = true;
          },1000);
        });
        node.on('mouseup touchend',function(e){
          if (!node.cancelClick) {
              e.preventDefault();
              e.stopPropagation();
              if (e.shiftKey) {
                node.trigger('vshiftclick');
              } else {
                node.trigger('vclick');
              }
          }
          node.cancelClick = true;
          // Always propagate mouseup to draghandler to securly cancle dragging
          if (node.useDragHandler) {
            node.useDragHandler.trigger('mouseup');
          }
        });
        node.on('dblclick dbltap',function(e){
          e.preventDefault();
          e.stopPropagation();
          //if (node.dragging) return;
          node.trigger('vdblclick');
        });

        node.on('mouseenter',function(e){
          e.stopPropagation();
          node.trigger('vmouseover');
        });
        node.on('mouseleave',function(e){
          e.stopPropagation();
          node.trigger('vmouseout');
        });

        // FIXME: DEBUG those Events, remove
        node.on('vclick',function(e){
          e.stopPropagation();
        });
        node.on('vdblclick',function(e){
          e.stopPropagation();
        });

      } else {
        if (node.clickable) {
          node.off('mouseup touchend');
          node.off('dblclick dbltap');
          node.off('mouseenter');
          node.off('mouseleave');
          node.clickable = false;
        }
      }
    };


    ////////////////////
    // Node FX
    ////////////////////

    Node.prototype.FXSimple = function(config,duration,easing,callback){
      var node = this;
      Ticker.addListener(node);

      this.FXAnimation = Tween.get(node,{
        override:true
      })
      .to(config,duration,Ease[easing])
      .call(function(){
        Ticker.removeListener(node);
        if (callback) {
          callback();
        }
      });
      return this.FXAnimation;
    };

    Node.prototype.FXSimpleCue = function(config,duration,easing,callback){
      var node = this;
      Ticker.addListener(node);

      if (!Tween.hasActiveTweens(this)||!this.FXAnimation) {
        this.FXAnimation = Tween.get(node)
        .to(config,duration,Ease[easing])
        .call(function(){
          Ticker.removeListener(node);
          if (callback) {
            callback();
          }
        });
      } else if (Tween.hasActiveTweens(this)) {
        Ticker.addListener(node);
        this.FXAnimation
        .call(function(){Ticker.addListener(node);})
        .to(config,duration,Ease[easing])
        .call(function(){
          Ticker.removeListener(node);
          if (callback) {
            callback();
          }
        });
      }
      return this.FXAnimation;
    };

    Node.prototype.FXWaitCue = function(time,callback){
      var node = this;
      Ticker.addListener(node);
      if (!Tween.hasActiveTweens(this)||!this.FXAnimation) {
        this.FXAnimation = Tween.get(node)
        .wait(time)
        .call(function(){
          Ticker.removeListener(node);
          if (callback) {
            callback();
          }
        });
      } else if (Tween.hasActiveTweens(this)) {
        Ticker.addListener(node);
        this.FXAnimation
        .call(function(){Ticker.addListener(node);})
        .wait(time)
        .call(function(){
          Ticker.removeListener(node);
          if (callback) {
            callback();
          }
        });
      }
      return this.FXAnimation;
    };

    Node.prototype.FXStop = function(){
      this.FXSimple({},0,'linear');
    };

    Node.prototype.FXClearCue = function(){
      this.FXAnimation = undefined;
    };

    Node.prototype.FXSimpleLoop = function(config,duration,easing,callback){
      var node = this;
      Ticker.addListener(node);
      return Tween.get(node,{
        override:true,
        loop:true
      })
      .to(config.one,duration,Ease[easing])
      .to(config.two,duration,Ease[easing])
      .call(function(){
          if (callback) {
            callback();
          }
      });
    };

    Node.prototype.FXBounce = function(){
      //'12%':{'transform':'s1.1','easing':'>'},
      //'24%':{'transform':'s1.05','easing':'<'},
      //'76%':{'transform':'s1','easing':'bounce'}
      // 260ms
      var node = this;
      Ticker.addListener(node);
      return Tween.get(node,{
        override:true
      })
      .to({scaleX:1.15,scaleY:1.15},31,Ease.easeOut)
      .to({scaleX:1.1,scaleY:1.1},31,Ease.easeIn)
      .to({scaleX:1,scaleY:1},200,Ease.bounceOut)
      .call(function(){
        Ticker.removeListener(node);
      });
    };

    Node.prototype.FXSpinner = function(config,cb){
      var config = config || {};
      var text = config.text || '';
      var isnew = config.isnew || false;
      var duration = config.duration+400 || 2000;
      var node = this;
      if (!this.spinner) {
        this.spinner = new Sprite({
          frame: 'normal',
          frameSrc: "largespinner.png",
          frameMap: {
            normal : { x: 0, y: 0, width: 120, height: 120, pivotx: 60, pivoty: 60 }
          },
          z:-1,
          opacity:0
        });
      }
      var spinner = this.spinner;
      Ticker.addListener(node);
      Ticker.addListener(spinner);
      node.DecoratorAmount.hide();

      spinner.setFrame('normal');

      node.parentNode.addChild(spinner);
      var nPos = node.getPosition();
      spinner.setPosition(nPos);

      var speed = 1;
      var sps = (node.width > 99) ? 1.2 : 1 ;
      return Tween.get(spinner)
      .to({scaleX:0.8,scaleY:0.8, rotate:125*speed, opacity:0},0,Ease.linear)
      .to({scaleX:sps,scaleY:sps, rotate:0, opacity:1},250*speed,Ease.linear)
      .to({scaleX:sps,scaleY:sps, rotate:-1000*speed},duration*speed,Ease.easeIn)
      .to({scaleX:0.8,scaleY:0.8, rotate:-2000*speed, opacity:0},500*speed,Ease.easeIn)
      .call(function(){
        Ticker.removeListener(node);
        Ticker.removeListener(spinner);
        node.FXBounce();
        node.FXBling({text: text, extendClass: 'ProfileBlingSmall'});
        node.DecoratorAmount.show();
        node.DecoratorAmount.setAmount();
        spinner.remove();
        delete node.spinner;
        if (cb) cb();
      });
    };

    Node.prototype.FXSpark = function(config,cb){
      var config = config || {};
      var psid = config.psid || undefined;
      var oPos = config.oPos || undefined;
      var isnew = config.isnew || false;
      var node = this;
      var spark = new Sprite({
        x:0,
        y:0,
        frame: 'normal',
        frameSrc: "sprite_spark_big.png",
        frameMap: {
          normal : { x: 0, y: 0, width: 36, height: 36, pivotx: 18, pivoty: 18 }
        },
        //z:-2,
        z:5000,
        opacity:1
      });
      Ticker.addListener(node);
      Ticker.addListener(spark);
      node.DecoratorAmount.hide();
      spark.setFrame('normal');

      node.parentNode.addChild(spark);

      var nPos = node.getPosition();
      var oScale = 1;
      if (psid && !oPos) {
        oScale = (1/node.parentNode.zoomScale);
        var PSpos = $('.DatabaseQueue').find('.DatabaseQueueItem[data-psid='+psid+']').position();
        var PSleft = (PSpos) ? PSpos.left : 0;
        oPos = {
          x: (Math.abs(node.parentNode.x)+((node.parentNode.parentNode.width-720)/2+55)+PSleft)*oScale,
          y: (Math.abs(node.parentNode.y)+node.parentNode.parentNode.height-78)*oScale
        };
      } else if (!oPos) {
        if (cb) { cb(); }
        return;
      }
      var A = nPos.x - oPos.x;
      var O = oPos.y - nPos.y;
      var dir = (A > 0) ? 1 : -1;

      var deg = Math.atan(O/Math.abs(A)) * (180/Math.PI);

      var lenratio = Math.sqrt(Math.pow((oPos.x - nPos.x),2) + Math.pow((oPos.y - nPos.y),2))/108;

      spark.setPosition({x:oPos.x,y:oPos.y});
      spark.rotate = 180+((90-deg)*dir);

      spark.scaleX = oScale*2;
      spark.scaleY = oScale*2;
      //var speed = 0.5 + Math.random()*0.5;
      var speed = 1;

      Tween.get(spark)
      .to({scaleX:oScale*2,scaleY:oScale*2},0,Ease.linear)
      .wait(200)
      .to({scaleX:0.5,scaleY:lenratio},100,Ease.linear)
      .to({scaleX:1,x:nPos.x,y:nPos.y,opacity:1},300,Ease.easeOut)
      .to({scaleY:1},100,Ease.linear)
      .call(function(){
        spark.hide();
        if (isnew) { node.show(); }
        node.FXBounce();
        spark.remove();
        if (cb) { cb(); }
      });
    };

    Node.prototype.FXWheee = function(config){
      var node = this;
      node.FXSpark(config,function(){
        node.FXSpinner(config);
      });
    };

    Node.prototype.FXWheeeOld = function(config){
      var config = config || {};
      var text = config.text || '';
      var psid = config.psid || undefined;
      var oPos = config.oPos || undefined;
      var isnew = config.isnew || false;
      var node = this;
      var spinner = new Sprite({
        frame: 'normal',
        frameSrc: "largespinner.png",
        frameMap: {
          normal : { x: 0, y: 0, width: 120, height: 120, pivotx: 60, pivoty: 60 }
        },
        z:-1,
        opacity:0
      });
      var spark = new Sprite({
        x:0,
        y:0,
        frame: 'normal',
        frameSrc: "sprite_spark_big.png",
        frameMap: {
          normal : { x: 0, y: 0, width: 36, height: 36, pivotx: 18, pivoty: 18 }
        },
        //z:-2,
        z:5000,
        opacity:1
      });
      Ticker.addListener(node);
      Ticker.addListener(spinner);
      Ticker.addListener(spark);
      node.DecoratorAmount.hide();
      spinner.setFrame('normal');
      spark.setFrame('normal');

      node.parentNode.addChild(spark);
      node.parentNode.addChild(spinner);
      var nPos = node.getPosition();
      var oScale = 1;
      // TODO: make oPos dynamic
      if (psid && !oPos) {
        oScale = (1/node.parentNode.zoomScale);
        var PSleft = $('.DatabaseQueue').find('.DatabaseQueueItem[data-psid='+psid+']').position().left;
        oPos = {
          x: (Math.abs(node.parentNode.x)+((node.parentNode.parentNode.width-720)/2+55)+PSleft)*oScale,
          y: (Math.abs(node.parentNode.y)+node.parentNode.parentNode.height-78)*oScale
        };
      } else if (!oPos) {
        return;
      }
      spinner.setPosition(nPos);
      // 90  = -1
      // 270 = 1
      var A = nPos.x - oPos.x;
      var O = oPos.y - nPos.y;
      //var lenratio = O * (1/oPos.y);
      var lenratio = Math.sqrt(Math.pow((oPos.x - nPos.x),2) + Math.pow((oPos.y - nPos.y),2))/108;

      var dir = (A > 0) ? 1 : -1;
      //A = Math.abs(A);
      var deg = Math.atan(O/Math.abs(A)) * (180/Math.PI);

      spark.setPosition({x:oPos.x,y:oPos.y});
      spark.rotate = 180+((90-deg)*dir);

      spark.scaleX = oScale*2;
      spark.scaleY = oScale*2;
      //var speed = 0.5 + Math.random()*0.5;
      var speed = 1;

      Tween.get(spark)
      .to({scaleX:oScale*2,scaleY:oScale*2},0,Ease.linear)
      .wait(200)
      .to({scaleX:0.5,scaleY:lenratio},100,Ease.linear)
      .to({scaleX:1,x:nPos.x,y:nPos.y,opacity:1},300,Ease.easeOut)
      .to({scaleY:1},100,Ease.linear)
      .call(function(){
        spark.hide();
        if (isnew) { node.show(); }
        node.FXBounce();
      });
      //.to({scaleX:5,scaleY:5, opacity:0.7},2000,Ease.easeOut);
      var sps = (node.width > 80) ? 1.3 : 1 ;
      return Tween.get(spinner)
      .wait(500)
      .to({scaleX:0.8,scaleY:0.8, rotate:125*speed, opacity:0},0,Ease.linear)
      .to({scaleX:sps,scaleY:sps, rotate:0, opacity:1},250*speed,Ease.linear)
      .to({scaleX:sps,scaleY:sps, rotate:-1000*speed},2000*speed,Ease.easeIn)
      .to({scaleX:0.8,scaleY:0.8, rotate:-2000*speed, opacity:0},500*speed,Ease.easeIn)
      .call(function(){
        Ticker.removeListener(node);
        Ticker.removeListener(spinner);
        node.FXBounce();
        node.FXBling({text: text});
        node.DecoratorAmount.show();
        spinner.remove();
        spark.remove();
      });
    };


    Node.prototype.FXMeMeMe = function(cb){
      // Used on DecoratorReady hover
      var node = this;
      node.setFrame('hover');
      this.FXClearCue();
      this.FXSimpleCue({scaleX:1.1,scaleY:1.1},31,'easeOut');
      this.FXSimpleCue({scaleX:1.07,scaleY:1.07},31,'easeOut');
      this.FXSimpleCue({scaleX:1,scaleY:1},200,'bounceOut',function(){
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXNotMeMeMe = function(cb){
      // Used on DecoratorReady hover
      var node = this;
      node.setFrame('normal');
      if (cb) {
        cb();
      }
      return;
    };

    Node.prototype.FXFeedMe = function(cb){
      //'25%':{'transform':'s1.1,1'},
      //'50%':{'transform':'s1,1.1'},
      //'75%':{'transform':'s1.1'},
      //'100%':{'transform':'s1'}
      //},150);
      this.FXSimpleCue({scaleX:1.1,sacaleY:1},37);
      this.FXSimpleCue({scaleX:1,scaleY:1.1},37);
      this.FXSimpleCue({scaleX:1.1,scaleY:1.1},37);
      this.FXSimpleCue({scaleX:1,scaleY:1},37);
    };

    Node.prototype.FXSproing = function(cb){
      var node = this;
      Ticker.addListener(node);
      node.setTransform({scaleX:0.6,scaleY:0});
      node.setOpacity(0);
      return Tween.get(node,{
        override:true
      })
      .to({scaleX:0.8,scaleY:1.2,opacity:0.5},100,Ease.easeOut)
      .to({scaleX:1.1,scaleY:0.8,opacity:1},100,Ease.easeIn)
      .to({scaleX:1,scaleY:1},500,Ease.elasticOut)
      .call(function(){
        Ticker.removeListener(node);
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXPuff = function(cb){
      var node = this;
      //node.FXSimple({offsetX:42,offsetY:68,scaleX:1.5,scaleY:1.5,opacity:0},250,'easeOut',cb);
      node.FXSimple({scaleX:1.5,scaleY:1.5,opacity:0},250,'easeOut',function(){
        if (cb) {
          cb();
        }
      });
      // make shure it really gets removed (callbacks seem to be unstable)
      window.setTimeout(function(){ node.remove();},350);
    };

    Node.prototype.FXArise = function(cb){
      var node = this;
      var sparkConf = {
        x:node.getPosition().x,
        y:node.getPosition().y,
        frame: 'normal',
        frameSrc: "MainSprites.png",
        frameMap: {
          normal : { x: 679, y: 630, width: 100, height: 100, pivotx: 50, pivoty: 50 }
        },
        z:10,
        scaleX:0,
        scaleY:0,
        opacity:1
      };
      var spark = new Sprite(sparkConf);
      var spark2 = new Sprite(sparkConf);
      Ticker.addListener(spark);
      Ticker.addListener(spark2);

      spark.setFrame('normal');
      spark2.setFrame('normal');
      node.parentNode.addChild(spark);
      node.parentNode.addChild(spark2);

      Tween.get(spark)
      .to({rotate:90,scaleX:1,scaleY:1,opacity:1},100,Ease.linear)
      .to({rotate:200,scaleX:2.2,scaleY:2.2,opacity:1},500,Ease.easeOut)
      .to({rotate:300,scaleX:0,scaleY:0},500,Ease.easeOut)
      .call(function(){
        spark.remove();
      });
      Tween.get(spark2)
      .to({rotate:-100,scaleX:1,scaleY:1,opacity:1},100,Ease.linear)
      .to({rotate:-220,scaleX:1.8,scaleY:1.8},500,Ease.easeOut)
      .to({rotate:-320,scaleX:0,scaleY:0},500,Ease.easeOut)
      .call(function(){
        spark2.remove();
      });

      node.scaleX = 0;
      node.scaleY = 0;
      node.opacity = 0;
      node.draw();
      node.show();
      node.FXWaitCue(1000);
      node.FXSimpleCue({scaleX:1,scaleY:1,opacity:1},350,'backOut');
      if (cb) {
        window.setTimeout(function(){ node.opacity=1; cb(); },1200);
      }
    };


    Node.prototype.FXKatsching = function(cb){
      var node = this;
      //node.FXSimple({offsetX:42,offsetY:68,scaleX:1.5,scaleY:1.5,opacity:0},250,'easeOut',cb);
      // TODO change frame to Cash only and maybe find out absolutepos of cash indicator
      node.setZ(100);
      var sparkConf = {
        x:node.getPosition().x-4,
        y:node.getPosition().y-40,
        frame: 'normal',
        frameSrc: "MainSprites.png",
        frameMap: {
          normal : { x: 679, y: 630, width: 100, height: 100, pivotx: 50, pivoty: 50 }
        },
        z:10,
        scaleX:0,
        scaleY:0,
        opacity:0.5
      };
      var spark = new Sprite(sparkConf);
      var spark2 = new Sprite(sparkConf);
      Ticker.addListener(spark);
      Ticker.addListener(spark2);

      spark.setFrame('normal');
      spark2.setFrame('normal');
      node.parentNode.addChild(spark);
      node.parentNode.addChild(spark2);

      Tween.get(spark)
      .to({rotate:90,scaleX:1,scaleY:1,opacity:0.5},100,Ease.linear)
      .to({rotate:200,scaleX:2.2,scaleY:2.2,opacity:0.8},500,Ease.easeOut)
      .to({rotate:300,scaleX:0,scaleY:0,opacity:1},200,Ease.easeOut)
      .call(function(){
        spark.remove();
      });
      Tween.get(spark2)
      .to({rotate:-100,scaleX:1,scaleY:1,opacity:0.5},100,Ease.linear)
      .to({rotate:-220,scaleX:1.8,scaleY:1.8,opacity:0.6},500,Ease.easeOut)
      .to({rotate:-320,scaleX:0,scaleY:0,opacity:1},200,Ease.easeOut)
      .call(function(){
        spark2.remove();
      });

      this.FXAnimation = Tween.get(node,{
        override:true
      })
      .to({scaleX:1,scaleY:1},100,Ease.linear)
      .wait(500)
      .to({scaleX:2,scaleY:2,opacity:0},250,Ease.easeOut)
      .call(function(){
        Ticker.removeListener(node);
        if (cb) {
          cb();
          node.remove();
        }
      });
      // make shure it really gets removed (callbacks seem to be unstable)
      //window.setTimeout(function(){ node.remove();},350);
    };

    Node.prototype.FXPulse = function(cb){
      var node = this;
      node.FXSimpleLoop({
        one:{scaleX:0.9,scaleY:0.9},
        two:{scaleX:1,scaleY:1}
      },350,'linear',function(){
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXSnooze = function(cb){
      var node = this;
      node.FXSimpleLoop({
        one:{scaleX:0.9,scaleY:0.9},
        two:{scaleX:1,scaleY:1}
      },250,'bounceOut',function(){
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXSuck = function(cb){
      var node = this;
      node.FXSimple({scaleX:0.5,scaleY:0.5,opacity:0,offsetY:120},250,'easeOut',function(){
        if (cb) {
          cb();
        }
        node.remove();
      });
    };

    Node.prototype.FXCharge = function(frame,cb){
      var node = this;
      // Find out where to render and at which coordinates
      var nodePos = node.userClickAbsPos || node.getPosition();
      var renderParent = (node.userClickAbsPos) ? node : node.parentNode;
      var bling = new Sprite({
        x: nodePos.x,
        y: nodePos.y - 400,
        // FIXME: bring some meaning to the z values
        z:100000,
        hidden:true,
        frame: frame || 'cash',
        frameSrc:'MainSprites.png',
        frameMap: {
          'cash':{x: 145, y: 616, width: 56, height: 43, pivotx: 25, pivoty: 21},
          'AP':{x:202,y:616,width:41,height:48,pivotx:20,pivoty:24}
        }
      });
      renderParent.addChild(bling);
      if (frame!=='AP') {
        bling.FXSimpleCue({scaleX:5,scaleY:5,rotate: -360,opacity:0},0,'linear');
      } else {
        bling.FXSimpleCue({y:nodePos.y,scaleX:1,scaleY:10,rotate: 10,opacity:0},0,'linear');
      }
      bling.FXWaitCue(200);
      bling.FXSimpleCue({y:nodePos.y,scaleX:1,scaleY:1,rotate:0,opacity:1},200,'linear');
      bling.FXWaitCue(0);
      bling.FXSimpleCue({scaleX:0.1,scaleY:0.1,opacity:0},500,'backIn',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXKarmaBling = function(karma_points, cb){
      var node = this;
      // Find out where to render and at which coordinates
      //var nodePos = node.userClickAbsPos;
      var nodePos = node.getCenterPosition();
      nodePos.x += 130;
      nodePos.y = 100;
      var renderParent = node;
      var bling = new Sprite({
        x: nodePos.x,
        y: nodePos.y,
        // FIXME: bring some meaning to the z values
        z:10000,
        opacity:0,
        hidden:true,
        frame: 'karma_up',
        frameSrc:'MainSprites.png',
        frameMap: {
          'karma_up': {x:428,y:860,width:96,height:96,pivotx:48,pivoty:48}
        }
      });
      renderParent.addChild(bling);
      bling.FXWaitCue(0);
      bling.FXSimpleCue({scaleX:0,scaleY:0,rotate:720,opacity:0},0,'linear',function(){
        bling.FXBling({
          text: "+" + _.toKSNum(karma_points),
          wait:600,
          dur:1300,
          extendClass: "KarmaUpBling"
        });
      });
      bling.FXSimpleCue({y:nodePos.y, scaleX:1.2,scaleY:1.2, rotate:0,opacity:1},500,'easeOut');
      bling.FXSimpleCue({y:nodePos.y, scaleX:1,scaleY:1, rotate:0,opacity:1},250,'bounceOut');
      bling.FXWaitCue(800);
      bling.FXSimpleCue({y:nodePos.y-200, scaleX:0,scaleY:4.5,opacity:0},200,'linear',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXLevelUpBling = function(xp_level, cb){
      // should be invoked on gameroot
      var node = this;
      var nodePos = node.getCenterPosition();
      var renderParent = node;
      var bling = new Sprite({
        x: nodePos.x,
        y: nodePos.y,
        // FIXME: bring some meaning to the z values
        z:100000,
        opacity:0,
        hidden:true,
        frame: 'normal',
        frameSrc:'MainSprites.png',
        frameMap: {
          'normal': { x: 525, y: 842, width: 138, height: 138, pivotx: 69,pivoty: 69 }
        }
      });
      renderParent.addChild(bling);
      bling.FXWaitCue(0);
      bling.FXSimpleCue({scaleX:0,scaleY:0,rotate:720,opacity:0},0,'linear',function(){
        /*
        bling.FXBling({
          text: LevelUpText,
          wait:600,
          dur:1200,
          extendClass: "LevelUpBling"
        });
        */
        bling.FXBling({
          text: "Level " + xp_level,
          wait:600,
          dur:1800,
          extendClass: "LevelUpBlingBig"
        });

      });
      bling.FXSimpleCue({y:nodePos.y, scaleX:1.2,scaleY:1.2, rotate:0,opacity:1},500,'easeOut');
      bling.FXSimpleCue({y:nodePos.y, scaleX:2,scaleY:2, rotate:0,opacity:1},250,'bounceOut');
      bling.FXWaitCue(1000);
      bling.FXSimpleCue({y:nodePos.y-200, scaleX:0,scaleY:4.5,opacity:0},200,'linear',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXMissionComplete = function(text, cb){
      // should be invoked on gameroot
      var node = this;
      var nodePos = node.getCenterPosition();
      var renderParent = node;
      var bling = new Sprite({
        x: nodePos.x,
        y: nodePos.y,
        // FIXME: bring some meaning to the z values
        z:100000,
        opacity:0,
        hidden:true,
        frame: 'normal',
        frameSrc:'MainSprites.png',
        frameMap: {
          'normal': { x: 717, y: 764, width: 122, height: 160, pivotx: 55,pivoty: 90 }
        }
      });
      renderParent.addChild(bling);
      bling.FXWaitCue(0);
      bling.FXSimpleCue({scaleX:0,scaleY:0,rotate:0,opacity:0},0,'linear',function(){
      });
      bling.FXSimpleCue({y:nodePos.y, scaleX:1.2,scaleY:1.2, rotate:0,opacity:1},250,'easeOut');
      bling.FXSimpleCue({y:nodePos.y, scaleX:1,scaleY:1, rotate:0,opacity:1},250,'bounceOut');
      bling.FXWaitCue(1000);
      bling.FXSimpleCue({y:nodePos.y-200, scaleX:0,scaleY:4.5,opacity:0},200,'linear',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXMissionGoalComplete = function(text, cb){
      // should be invoked on gameroot
      var node = this;
      var nodePos = node.getTopRightPosition();
      var renderParent = node;
      var bling = new Sprite({
        x: nodePos.x -40,
        y: nodePos.y +50,
        // FIXME: bring some meaning to the z values
        z:100000,
        opacity:0,
        hidden:true,
        frame: 'normal',
        frameSrc:'MainSprites.png',
        frameMap: {
          'normal': { x: 717, y: 764, width: 122, height: 160, pivotx: 55,pivoty: 90 }
        }
      });
      renderParent.addChild(bling);
      bling.FXWaitCue(100);
      bling.FXSimpleCue({scaleX:0.5,scaleY:0.5, rotate:1,opacity:1},250,'bounceOut');
      bling.FXWaitCue(1000);
      bling.FXSimpleCue({scaleX:0,scaleY:4.5,opacity:0},200,'linear',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };


    Node.prototype.FXNoCash = function(frame,cb){
      var node = this;
      // Find out where to render and at which coordinates
      var nodePos = node.userClickAbsPos || node.getPosition();
      var renderParent = (node.userClickAbsPos) ? node : node.parentNode;
      var bling = new Sprite({
        x: nodePos.x,
        y: nodePos.y-400,
        // FIXME: bring some meaning to the z values
        z:100000,
        opacity:0,
        hidden:true,
        frame: frame || 'no_cash',
        frameSrc:'MainSprites.png',
        frameMap: {
          'no_cash':{x:401,y:737,width:65,height:65,pivotx:32,pivoty:32},
          'no_AP':{x:336,y:737,width:65,height:65,pivotx:32,pivoty:32}
        }
      });
      renderParent.addChild(bling);
      bling.FXSimpleCue({scaleX:5,scaleY:5,rotate:-360,opacity:0},0,'linear');
      bling.FXWaitCue(200);
      bling.FXSimpleCue({y:nodePos.y,scaleX:1,scaleY:1,rotate:0,opacity:1},150,'easeOut');
      bling.FXWaitCue(1000);
      bling.FXSimpleCue({scaleX:1.5,scaleY:1.5,opacity:0,rotate:360},200,'linear',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXNoAP = function(frame,cb){
      var node = this;
      // Find out where to render and at which coordinates
      var nodePos = node.userClickAbsPos || node.getPosition();
      var renderParent = (node.userClickAbsPos) ? node : node.parentNode;
      var bling = new Sprite({
        x: nodePos.x,
        y: nodePos.y,
        opacity:0,
        scaleX:0,
        scaleY:0,
        // FIXME: bring some meaning to the z values
        z:100000,
        hidden:true,
        frame: frame || 'no_AP',
        frameSrc:'MainSprites.png',
        frameMap: {
          'no_AP':{x:336,y:737,width:65,height:65,pivotx:32,pivoty:32},
          'bug':{x:362,y:860,width:65,height:65,pivotx:32,pivoty:32}
        }
      });
      renderParent.addChild(bling);
      bling.FXSimpleCue({ scaleX:0.5, scaleY:0.5, opacity:0 },100,'linear');
      bling.FXSimpleCue({ y:nodePos.y-32, scaleX:1,scaleY:1, rotate:0, opacity:1 }, 200,'easeOut');
      bling.FXWaitCue(1000);
      bling.FXSimpleCue({y:nodePos.y-64,scaleX:1.5,scaleY:1.5,opacity:0},200,'linear',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXError = function(frame,cb){
      this.FXNoAP('bug');
    };

    Node.prototype.FXBlingQueue = function(config,cb){
      // Topleft Blings for DBQueue
      config = config || {};
      var node = this.gameNode.GameRoot.renderNode;
      var nodePos = this.gameNode.GameRoot.renderStatusbar.getTopLeftPosition();
      config.wait = config.wait || 0;
      if (!node.renderBlings) {
        node.renderBlings = {}
      }
      var bling = new Text({
        x: nodePos.x,
        y: nodePos.y + 40 + _.keys(node.renderBlings).length * 32,
        z:1000,
        scaleX:0,
        scaleY:0,
        hidden:true,
        text: config.text,
        textAlign: 'left',
        extendClass: config.extendClass || "ProfileBling",
      });
      node.renderBlings[bling.id] = bling;
      node.addChild(bling);
      bling.show();
      bling.FXWaitCue(config.wait);
      bling.FXSimpleCue({scaleX:1,scaleY:1},200,'backOut',function(){
      });
      //bling.FXWaitCue(1000-config.wait);
      bling.FXWaitCue(2000);
      bling.FXSimpleCue({scaleX:1.2,scaleY:1.2,opacity:0},250,'easeOut',function(){
        delete node.renderBlings[bling.id];
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };


    Node.prototype.FXBling = function(config,cb){
      config = config || {};
      var node = this;
      var nodePos = node.getPosition();
      config.wait = config.wait || 0;
      config.dur = config.dur || 1000;
      var bling = new Text({
        x: (config.x === undefined) ? nodePos.x : config.x,
        y: (config.y === undefined) ? nodePos.y-50 : config.y,
        z:100000,
        hidden:true,
        text: config.text,
        extendClass: config.extendClass || "ProfileBling"
      });
      if (config.renderOn) {
        config.renderOn.addChild(bling);
      }
      else {
        node.parentNode.addChild(bling);
      }
      bling.offsetY=50;
      bling.FXWaitCue(config.wait);
      bling.FXSimpleCue({scaleX:0.5,scaleY:0.5},0,'linear',function(){
        bling.show();
      });
      bling.FXSimpleCue({scaleX:1,scaleY:1,opacity:0},config.dur,'easeOut',function(){
        bling.remove();
        if (cb) {
          cb();
        }
      });
    };

    Node.prototype.FXElasticTo = function(pos,callb){
      var node = this;
      Ticker.addListener(node);
      return Tween.get(node,{
        override:true
      })
      .to({x:pos.x,y:pos.y},500,Ease.elasticOut)
      .call(function(){
        if (callb) {
          callb();
        }
        Ticker.removeListener(node);
      });
    };


    /////////////////////////////
    // The Circle
    /////////////////////////////

    var Circle = function(config){
      config = config || {};
      this._id = _instances.length;
      this.radius = config.radius || 32;
      this.fill = config.fill || "#C00";
      this.stroke = config.stroke || "#F00";
      this.strokeWidth = config.strokeWidth || 0;
      this.jdomelem = $("<canvas class='Circle'></canvas>").attr('id','Circle'+this._id);
      this.domelem = this.jdomelem[0];
      this.init(config);
    };

    extend(Circle, Node);

    Circle.prototype.draw = function(){
      this.setSize({
        width:this.radius*2+this.strokeWidth*2,
        height:this.radius*2+this.strokeWidth*2
      });
      this.setOffset({
        x:this.width/2,
        y:this.height/2
      });
      this.setTransform(this.getTransform());
      this.setOpacity(this.opacity);

      var canvas = this.domelem;
      canvas.width = this.width;
      canvas.height = this.height;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.lineWidth=this.strokeWidth;
      ctx.arc(this.offsetX, this.offsetY, this.radius, 0, 2 * Math.PI, false);
      ctx.strokeStyle=this.stroke;
      ctx.fillStyle=this.fill;
      if (this.strokeWidth) {
        ctx.stroke();
      }
      ctx.fill();
    };


    /////////////////////////////
    // The Text
    /////////////////////////////

    var Text = function(config){
      config = config || {};
      this._id = _instances.length;
      this.jdomelem = $("<div class='Text'></div>").attr('id','Text'+this._id);
      this.domelem = this.jdomelem[0];
      this.init(config);
    };

    extend(Text, Node);

    Text.prototype.text = '';
    Text.prototype.textAlign = 'center';

    Text.prototype.updateRenderProp = function() {
      // Update misc render properties, API for FONT-Settings etc...
      this.css({
        'top':0,
        'left':0,
        'text-align':this.textAlign,
        'z-index':this.z,
        'position':this.position
        });
    };

    Text.prototype.draw = function(){
      // Update domelem to current settings
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    Text.prototype.onAddInit = function(){
      this.updateText(this.text);
      this.draw();
    };

    Text.prototype.updateText = function(text){
      if (!text) {
        text=this.text;
      }

      this.text = text = _.crlf2html(text);
      this.updateRenderProp();
      this.jdomelem.html(text);
      this.updateSize();
      var newOffset = {x:0,y:0};
      var width = this.jdomelem.width() || 200;
      if (this.textAlign === 'center') {
        newOffset.x = Math.round(width/2);
      } else if (this.textAlign === 'right') {
        newOffset.x = width;
      }
      this.setOffset(newOffset);
     };

    Text.prototype.updateSize = function(){
      this.width = this.jdomelem.width() || 200;
    };

    Text.prototype.ssetSize = function(){
      this.updateRenderProp();
      this.updateSize();
    };


    /////////////////////////////
    // The Sprite
    /////////////////////////////

    var Sprite = function(config){
      // Basic Sprite, div container with background image using spritemap
      // Special config settings:
      // config.frameSrc - Image source for the spritemap
      // config.frameMap - framemap coordinates and offsets
      // config.frame    - the currently active frame
      config = config || {};
      this._id = _instances.length;
      this.frameSrc = config.frameSrc;
      this.frameMap = config.frameMap;
      this.frame = config.frame || 'normal';
      this.jdomelem = $("<div class='Sprite'></div>").attr('id','Sprite'+this._id);
      this.domelem = this.jdomelem[0];
      this.init(config);
      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
      this.draw();
    };

    Sprite.prototype.frameSrc = '';
    Sprite.prototype.frameMap = {
      'normal':{x:0,y:0,width:0,height:0,pivotx:0,pivoty:0}
    };

    extend(Sprite, Node);

    Sprite.prototype.setFrameSrc = function(src) {
      // Set the Framemap source
      if (!this.frameSrc) {
        return;
      }
      this.spriteSrc = src;
      this.css({
        'background-image': 'url('+setup.imagePathPrefix+this.frameSrc+')'
      });
    };

    Sprite.prototype.setFrame = function(frame) {
      // Switch to a named frame on the spritemap
      if (!this.frameMap || !this.frameMap.hasOwnProperty(frame)) {
        return;
      }
      var map = this.frameMap[frame];
      this.frame = frame;
      this.width = map.width;
      this.height = map.height;
      if (map.pivotx && map.pivoty) {
        this.setOffset({
          x:map.pivotx,
          y:map.pivoty
        });
      }
      this.domelem.style.backgroundPosition = -map.x+"px "+-map.y+"px";
      this.draw();
    };


    /////////////////////////////
    // The Perp
    /////////////////////////////

    var Perp = function(config){
      // Interactive Sprite with decorations, usually lives on a ViewMap.
      // Special config settings:
      // config.cables
      config = config || {};
      if (config.x === undefined || config.y === undefined) {
        this.placeRandom = { x: 1024, y: 800 };
      }
      this._id = _instances.length;
      this.frameSrc = config.frameSrc || config.frame_src || 'MainSprites.png';
      this.frameMap = config.frameMap || config.frame_map || {
          'normal':{x:0,y:0,width:80,height:80,pivotx:0,pivoty:0}
      };
      this.frame = config.frame || 'normal';
      this.clickable = config.clickable || true;
      this.detectCollisions = true;
      this.draggable = config.draggable || true;
      this.cables = config.cables || new Set();
      this.perpSprite = config.perpSprite || undefined;
      this.jdomelem = $("<div class='Perp'></div>");
      this.domelem = this.jdomelem[0];
      this.init(config);
      this.initUI();

      if (!config.frameSrc || !config.frameMap) {
          console.log('ERROR: could not render perp ' + config.id, config);
      }

      if (this.perpSprite) {
        this.perpSprite = new PerpSprite(this.perpSprite,this._id);
        this.addChild(this.perpSprite);
      }

      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
    };

    extend(Perp, Sprite);

    Perp.prototype.getCableTo = function(perpTo){
      var perp = this;
      var cable;
      perp.cables.each(function(c){
        if (c.perpTo === perpTo) {
          cable = c;
        }
      });
      return cable;
    };

    Perp.prototype.initUI = function(){
      // Initialize Perp UI mouse and touch events
      // TODO: wrap events in eventhandlers and move this to Node Class
      var perp = this;

      // FIXME: MANUAL ADD

      perp.on('vclick',function(e){
        e.stopPropagation();
      });
      perp.on('vdblclick',function(e){
        e.stopPropagation();
      });

      perp.on('dragstart',function(e){
        e.stopPropagation();
        perp.setFrame('drag');
        perp.setZ(100);
        if (perp.perpSprite) {
          perp.perpSprite.offsetX += 2;
          perp.perpSprite.offsetY += 5;
          perp.perpSprite.draw();
        }
        perp.decorators.hide();
        if (!perp.sticky && !perp.dragalong) {
          perp.cables.each(function(cable){
            if (cable.noWobble) {
              cable.FXToggleConnect(0);
            } else {
              cable.FXWobbleTension(0.5);
            }
          });
        }
        else if (!perp.sticky && perp.dragalong) {
          perp.cables.each(function(cable){
            cable.FXStraighten(0);
          });
        }
        else if (perp.sticky) {
          perp.cables.each(function(cable){
            var othernode = (cable.perpFrom === perp) ? cable.perpTo : cable.perpFrom;
            if (othernode.sticky) {
              if (cable.noWobble) {
                cable.FXToggleConnect(0);
              } else {
                cable.FXWobbleTension(0.5);
              }
            }
            else {
              othernode.dragalong = true;
              othernode.useDragHandler.addListener(othernode);
            }
          });

        }
        /*
          perp.cables.each(function(cable){
            if (perp.dragalong) {
              cable.FXStraighten(0);
            }
            else if (cable.perpTo == perp) cable.FXWobbleTension(0.5);
          });
        */

      });

      perp.on('dragend',function(e){
        e.stopPropagation();

        perp.setZ(0);

        perp.setFrame('normal');
        perp.draw();
        if (perp.perpSprite) {
          perp.perpSprite.offsetX -= 2;
          perp.perpSprite.offsetY -= 5;
          perp.perpSprite.draw();
        }
        perp.decorators.show();
        perp.decorators.draw();
        perp.cables.each(function(cable){
          if (perp.dragalong) {
            cable.FXStraighten(1);
          } else {
              if (cable.noWobble) {
                cable.FXToggleConnect(1);
            } else {
              cable.FXWobbleTension(1);
            }
          }
        });
        perp.dragalong = false;
      });
      perp.on('mousedown',function(e){
        e.stopPropagation();
      });
      perp.on('vmouseover',function(e){
        e.stopPropagation();
        // FIXME: Write own Event Wrapper for hover events
        if (e.target!==perp.domelem) {
          return;
        }
        if (!perp.dragging) {
          perp.setFrame('hover');
          perp.FXBounce();
        } else {
          perp.setFrame('drag');
        }
      });
      perp.on('vmouseout',function(e){
        e.stopPropagation();
        if (perp.dragging) {
          perp.setFrame('drag');
        } else {
          perp.setFrame('normal');
        }
      });
    };

    Perp.prototype.dragBound = function(pos){
      if (!this.parentNode) {
        return;
      }
      if (pos.x<35) {
        pos.x = 35;
      } else if (pos.x>this.parentNode.width-35) {
        pos.x = this.parentNode.width-35;
      }
      if (pos.y<100) {
        pos.y = 100;
      } else if (pos.y>this.parentNode.height - 100) {
        pos.y = this.parentNode.height - 100;
      }
    };

    Perp.prototype.moveTo = function(pos){
      // Used during animations, to also draw and render other Nodes affected by movement.
      //if (this.dragging) this.setPosition({x:pos.x-2,y:pos.y-4});
      //else this.setPosition(pos);
      this.setPosition(pos);
      this.cables.draw();
      this.decorators.draw();
    };

    // FIXME random placement, remove
    Perp.prototype.setRandomPosition = function(originPos){
      var node = this;
      var tries = 0;
      var originPos = originPos || { x: 1024, y: 800 };
      var randomPos = function(pos){
        return {
          x: pos.x + 60 * ((Math.random() < 0.5) ? 1 : -1),
          y: pos.y + 40 * ((Math.random() < 0.5) ? 1 : -1)
        };
      };
      var testPos = this.useDragHandler.getCollisionPos(this,originPos);
      while (tries < 500 && testPos.coll === true) {
        testPos = randomPos(testPos);
        if (node.placeParentRadius) {
          testPos = node.testParentRadius(testPos,node.placeParentRadius);
        }
        testPos.coll = this.useDragHandler.testCollisions(node,testPos);
        tries +=1;
      }
      this.setPosition(testPos);
    };


    Perp.prototype.onAddInit = function(){
      // Init stuff when added to a Parent Node
      var node = this;
      if (this.draggable) {
        this.setDraggable(true);
      }
      if (this.clickable) {
        this.setClickable(true);
      }
      if (this.placeRandom) {
        node.setRandomPosition(this.placeRandom);
      }
      this.updateRenderProp();
      this.draw();
    };

    Perp.prototype.cableTo = function(otherperp,config){
      // Connect this Perp to another one, Perps need to live on the same Node, usually a ViewMap.
      if (!this.parentNode || !otherperp.parentNode || (this.parentNode !== otherperp.parentNode)) {
        return 'Could not connect';
      }
      config = config || {};
      var perpcable = new PerpCable(config,this,otherperp);
      this.parentNode.addChild(perpcable);
      return perpcable;
    };

    Perp.prototype.cableAnimatedTo = function(otherperp,config,cb){
      config = config || {};
      config.hidden = true;
      var cable = this.cableTo(otherperp,config);
      cable.FXConnect(cb);
      return cable;
    };

    Perp.prototype.cableAnimatedRemove = function(otherperp,config){
      var cable = this.getCableTo(otherperp);
      if (!cable) { return; }
      cable.FXDisconnect(function(){
          cable.remove();
      });
    };


    Perp.prototype.draw = function(){
      // Update domelem to current settings
      if (this.dragging) {
        this.moveTo(this.getPosition());
      } else {
        this.setPosition(this.getPosition());
      }
      this.setTransform(this.getTransform());
      this.setSize(this.getSize());
      this.setOpacity(this.opacity);
      if (this.perpSprite) {
        this.perpSprite.updatePosition();
      }
    };

    Perp.prototype.getCablesToOrigin = function(){
      // Doesn't work on a graph, obviously
      var cables = [];
      var perp = this;
      if (!perp.cables.set.length) {
        return cables;
      }
      var parentPerp=this;
      perp.cables.each(function(cable){
         if (cable.perpTo === perp) {
           parentPerp = cable.perpFrom;
           cables.push(cable);
           _.each(parentPerp.getCablesToOrigin(),function(pcable){
            cables.push(pcable);
           });
         }
      });
      return cables;
    };

    Perp.prototype.FXDataOut = function(cb){
      var perp = this;
      var cables = this.getCablesToOrigin();
      // Set duration to FXDataIn Duration
      var duration=500;
      var delay = 0;
      _.each(cables,function(cable,k){
        duration=cable.length*2;
        if (k === cables.length-1) {
          var endPerp = cable.perpFrom;
          window.setTimeout(function() {
            cable.FXDataIn(function() {
              endPerp.FXFeedMe();
              if (cb) {
                cb();
              }
            });
          }, delay);
        }
        else {
          window.setTimeout(function(){cable.FXDataIn(function(){ if (cb) { cb(); } });},delay);
        }
        delay=delay+duration;
      });
      return delay;
    };

    // TODO: Make Loop with FX Start/Stop options
    Perp.prototype.FXDataIn = function(cb){
      var cables = this.getCablesToOrigin().reverse();
      // Set duration to FXDataOut Duration
      var duration=500;
      var delay = 0;
      _.each(cables,function(cable, k){
        duration=cable.length*2;
        if (k === cables.length-1) {
          window.setTimeout(function() {
            cable.FXDataOut(cb);
          }, delay);
        } else {
          window.setTimeout(function() {
            cable.FXDataOut();
          }, delay);
        }
        delay = delay + duration;
      });
      return delay;
    };


    /////////////////////////////
    // The PerpSprite
    /////////////////////////////

    var PerpSprite = function(config){
      config = config || {};
      this._id = _instances.length;
      this.frameSrc = config.frameSrc || config.frame_src;
      this.frameMap = config.frameMap || config.frame_map;
      this.frame = config.frame || 'normal';
      this.jdomelem = $("<div class='PerpSprite'></div>").attr('id','PerpSprite'+this._id);
      this.domelem = this.jdomelem[0];
      this.init(config);
    };

    extend(PerpSprite, Sprite);

    PerpSprite.prototype.onAddInit = function(){
      var node =this;
      node.parentNode.perpSprite = this;

      // Set position to parent pivot:
      _.each(this.frameMap,function(frame,k){
        if (!frame.pivotx) {
          frame.pivotx = node.parentNode.frameMap.normal.pivotx;
        }
        if (!frame.hasOwnProperty('pivoty')) {
          frame.pivoty = node.parentNode.frameMap.normal.pivoty;
        }
      });

      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
      node.setPosition({x:node.parentNode.offsetX,y:node.parentNode.offsetY});

      this.draw();
      this.updateRenderProp();
    };

    PerpSprite.prototype.updatePosition = function() {
      var node =this;
      node.setPosition({x:node.parentNode.offsetX,y:node.parentNode.offsetY});
    };


    /////////////////////////////
    // The Decorator (Dummy Example)
    // A Decorator is bound to its decorated parent Node by the draw function but lives on the same container
    /////////////////////////////

    var Decorator = function(config){
      config = config || {};
      this._id = _instances.length;
      this.jdomelem = $("<div class='Decorator'></div>").attr('id','Decorator'+this._id);
      this.domelem = this.jdomelem[0];

      // Decorators need offsetToParent and be added to the parent's set
      this.offsetToParent = config.offsetToParent || {x:0,y:0};

      this.init(config);
      return this;
    };

    extend(Decorator, Node);

    Decorator.prototype.remove = function(){
      this.decoratedNode.decorators.remove(this);
      this.remove();
    };

    Decorator.prototype.draw = function(){
      if (this.hidden) {
        return;
      }
      if (!this.decoratedNode) {
        return;
      }
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition({
        x: this.decoratedNode.getPosition().x + this.offsetToParent.x,
        y: this.decoratedNode.getPosition().y + this.offsetToParent.y
      });
      this.setOpacity(this.opacity);
    };


    /////////////////////////////
    // The DecoratorReady
    /////////////////////////////

    var DecoratorReady = function(config){
      config = config || {};
      this._id = _instances.length;
      this.frameSrc = config.frameSrc || 'MainSprites.png';
      this.frameProfile = {
        normal: { "x": 50, "y": 668, "width": 46, "height": 58, "pivotx": 25, "pivoty": 56 },
        hover: { "x": 96, "y": 664, "width": 48, "height": 62, "pivotx": 27, "pivoty": 60 },
        active: { "x": 420, "y": 660, "width": 57, "height": 70, "pivotx": 31, "pivoty": 64 }
      };
      this.frameMoney = {
        normal: { "x": 203, "y": 668, "width": 52, "height": 59, "pivotx": 29, "pivoty": 57 },
        hover: { "x": 145, "y": 663, "width": 58, "height": 64, "pivotx": 33, "pivoty": 62 },
        active: { "x": 144, "y": 616, "width": 58, "height": 44, "pivotx": 33, "pivoty": 63 }
      };
      this.frameGear = {
        normal: { "x": 779, "y": 668, "width": 46, "height": 58, "pivotx": 25, "pivoty": 56 },
        hover: { "x": 825, "y": 664, "width": 48, "height": 62, "pivotx": 27, "pivoty": 60 },
        active: { "x": 873, "y": 678, "width": 57, "height": 70, "pivotx": 28, "pivoty": 64 }
      };

      this.frameMap = this.frameProfile;
      var textCollect = this.textCollect;
      if (config.mode && config.mode === "money") {
        this.frameMap = this.frameMoney;
        textCollect = this.textCollectCash;
      } else if (config.mode && config.mode === "gear") {
        this.frameMap = this.frameGear;
        textCollect = this.textCollectGear;
      }

      this.frame = config.frame || 'normal';
      this.jdomelem = $("<div class='DecoratorReady'></div>").attr('id','Decorator'+this._id);
      this.jdomelem.append(textCollect.clone());
      this.domelem = this.jdomelem[0];
      this.clickable=true;
      this.offsetToParent = config.offsetToParent || {x:0,y:-30};

      this.init(config);
      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
      return this;
    };

    extend(DecoratorReady, Sprite);

    DecoratorReady.prototype.textCollect = $('<div class="DecoratorReadyText">' + _._('Collect!') + '</div>' );
    DecoratorReady.prototype.textCollectGear = $('<div class="DecoratorReadyText">' + _._('Update!') + '</div>' );
    DecoratorReady.prototype.textCollectCash = $('<div class="DecoratorReadyText Cash">' + _._('Cash up!') + '</div>' );

    DecoratorReady.prototype.decoType = 'DecoratorReady';

    DecoratorReady.prototype.onAddInit = function(){
      var node =this;
      if (this.clickable) {
        this.setClickable(true);
      }

      this.offsetToParent = {x: 0, y: - this.decoratedNode.height/2 + 15};
      this.initUI();
      this.updateRenderProp();
      this.draw();
    };

    DecoratorReady.prototype.initUI = function(){
      var deco = this;
      deco.on('vclick',function(e){
        e.stopPropagation();
        deco.jdomelem.find('.DecoratorReadyText').remove();
      });
      deco.on('vdblclick',function(e){
        e.stopPropagation();
      });
      deco.on('vmouseover',function(e){
        e.stopPropagation();
        deco.FXMeMeMe();
      });
      deco.on('vmouseout',function(e){
        e.stopPropagation();
        deco.FXNotMeMeMe();
      });
    };

    DecoratorReady.prototype.draw = Decorator.prototype.draw;


    /////////////////////////////
    // The DecoratorLabel
    /////////////////////////////

    var DecoratorLabel = function(config){
      config = config || {};
      this._id = _instances.length;
      this.text = config.text || "Label";
      this.jdomelem = $("<div class='DecoratorLabel'></div>").attr('id','DecoratorLabel'+this._id);
      this.domelem = this.jdomelem[0];
      this.clickable=false;
      this.offsetToParent = config.offsetToParent || {x:0,y:0};
      this.textFontSize = "13px";

      this.init(config);
      return this;
    };

    extend(DecoratorLabel, Text);

    DecoratorLabel.prototype.decoType = 'DecoratorLabel';

    DecoratorLabel.prototype.onAddInit = function(){
      this.offsetToParent = {x: 0 + this.offsetToParent.x, y: this.decoratedNode.height - this.decoratedNode.offsetY-1 + this.offsetToParent.y};
      this.updateText();
      this.draw();
    };

    DecoratorLabel.prototype.draw = Decorator.prototype.draw;


    /////////////////////////////
    // The DecoratorNew
    /////////////////////////////

    var DecoratorNew = function(config){
      config = config || {};
      this._id = _instances.length;
      this.text = config.text || "New!";
      this.jdomelem = $("<div class='DecoratorNew'></div>").attr('id','DecoratorNew'+this._id);
      if (config.extendClass) {
        this.jdomelem.addClass(config.extendClass);
      }
      this.domelem = this.jdomelem[0];
      this.clickable=true;
      this.offsetToParent = config.offsetToParent || {x:0,y:0};
      this.textFontSize = "13px";

      this.init(config);
      return this;
    };

    extend(DecoratorNew, Text);

    DecoratorNew.prototype.decoType = 'DecoratorNew';

    DecoratorNew.prototype.onAddInit = function(){
      //this.offsetToParent = {x: 0 + this.offsetToParent.x, y: this.decoratedNode.height - this.decoratedNode.offsetY-3 + this.offsetToParent.y};
      if (this.arrow) {
        this.offsetToParent = {x: 0, y: - this.decoratedNode.height/2-32};
      } else {
        this.offsetToParent = {x: 0, y: - this.decoratedNode.height/2-8};
      }
      if (this.clickable) {
        this.setClickable(true);
      }
      this.initUI();
      this.updateText();
      if (this.arrow) {
        this.jdomelem.append('<br /><div class="DecoratorNewArrow"></div>');
      }

      this.draw();
    };

    DecoratorNew.prototype.initUI = function(){
      var deco = this;
      deco.on('vclick',function(e){
        e.stopPropagation();
        if (deco.decoratedNode) {
          deco.decoratedNode.trigger('vclick');
        }
      });
    };

    DecoratorNew.prototype.draw = Decorator.prototype.draw;



    /////////////////////////////
    // The DecoratorGear
    /////////////////////////////

    var DecoratorGear = function(config){
      config = config || {};
      this._id = _instances.length;

      this.frameSrc = config.frameSrc || 'MainSprites.png';
      this.frameMap = config.frameMap || {
        normal: { "x": 347, "y": 582, "width": 28, "height": 28, "pivotx": 14, "pivoty": 14 },
        inactive: { "x": 375, "y": 582, "width": 28, "height": 28, "pivotx": 14, "pivoty": 14 }
      };
      this.frame = config.frame || 'normal';

      this.width = this.frameMap.normal.width;
      this.height = this.frameMap.normal.height;

      this.jdomelem = $("<div class='DecoratorGear'></div>").attr('id','DecoratorGear'+this._id);
      this.domelem = this.jdomelem[0];
      this.clickable = true;
      this.offsetToParent = config.offsetToParent || {x:30,y:-30};

      this.init(config);
      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
      return this;
    };

    extend(DecoratorGear, Sprite);

    DecoratorGear.prototype.decoType = 'DecoratorGear';

    DecoratorGear.prototype.draw = Decorator.prototype.draw;

    DecoratorGear.prototype.onAddInit = function(){
      var node =this;
      if (this.decoratedNode.gameNode.data.is_supertoken!==true) {
        this.offsetToParent = {
          x:(this.decoratedNode.width/2)-11,
          y:-(this.decoratedNode.height/2-11)
        };
      } else {
        this.offsetToParent = {
          x:(this.decoratedNode.width/2)-16,
          y:-(this.decoratedNode.height/2-16)
        };
      }
      if (this.clickable) {
        this.setClickable(true);
      }
      this.initUI();
      this.updateRenderProp();
      this.draw();
    };

    DecoratorGear.prototype.initUI = function(){
      var deco = this;
      deco.on('vclick',function(e){
        e.stopPropagation();
        if (deco.decoratedNode) {
          deco.decoratedNode.trigger('vclick');
          // QuickCharge on Gear?
          //deco.decoratedNode.gameNode.trigger('Charge');
        }
      });
    };


    /////////////////////////////
    // The DecoratorTimer
    /////////////////////////////

    var DecoratorTimer = function(config){
      config = config || {};
      this._id = _instances.length;

      this.frameSrc = config.frameSrc || 'MainSprites.png';
      this.frameMap = config.frameMap || {
        //normal: { "x": 12, "y": 1008, "width": 26, "height": 26, "pivotx": 11, "pivoty": 11 }
        normal: { "x": 0, "y": 580, "width": 35, "height": 35, "pivotx": 18, "pivoty": 18 }
      };
      this.frame = config.frame || 'normal';

      this.serverTime = config.serverTime || 0;
      this.serverStartTime = config.serverStartTime || 0;
      this.duration = config.duration || 1000;
      this.startTime = new Date().getTime()-(this.serverTime-this.serverStartTime);
      this.endTime = this.startTime+this.duration;

      this.width = this.frameMap.normal.width;
      this.height = this.frameMap.normal.height;

      this.jdomelem = $("<div class='DecoratorTimer'></div>").attr('id','DecoratorTimer'+this._id);
      this.domelem = this.jdomelem[0];

      this.jdomelem2 = $("<canvas class='DecoratorTimerCanvas'></canvas>").attr('id','DecoratorTimerCanvas'+this._id);
      this.domelem2 = this.jdomelem2[0];

      this.jdomelem3 = $("<div class='DecoratorTimerText'>6:12:20</div>").attr('id','DecoratorTimerText'+this._id);
      this.domelem3 = this.jdomelem3[0];

      this.jdomelem2.attr({'width':config.width,'height':config.height});
      this.jdomelem.append(this.jdomelem2);
      this.jdomelem.append(this.jdomelem3);
      this.clickable=true;
      this.offsetToParent = config.offsetToParent || {x:30,y:-30};

      this.init(config);
      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
      return this;
    };

    extend(DecoratorTimer, Sprite);

    DecoratorTimer.prototype.decoType = 'DecoratorTimer';

    DecoratorTimer.prototype.onAddInit = function(){
      var node =this;
      this.offsetToParent = {
        x:(this.decoratedNode.width/2)-12,
        y:-(this.decoratedNode.height/2-12)
      };
      if (this.clickable) {
        this.setClickable(true);
      }

      // FIXME: Write own slower Timer Ticker
      SlowTicker.addListener(this);

      this.initUI();
      this.updateRenderProp();
      this.draw();
    };

    DecoratorTimer.prototype.initUI = function(){
      var deco = this;
      deco.on('vmouseover',function(){
        deco.jdomelem3.show();
        deco.jdomelem3.hidden = false;
      });
      deco.on('vmouseout',function(){
        deco.jdomelem3.hide();
        deco.jdomelem3.hidden = true;
      });

    };

    DecoratorTimer.prototype.getPercentage = function(){
      var now = new Date().getTime();
      var timespan = this.endTime - this.startTime;
      this.remainTime = this.endTime-now;
      return (now-this.startTime)/(timespan/100);
    };

    DecoratorTimer.prototype.textReadyIn = _._('Ready in') + ' ';

    DecoratorTimer.prototype.draw = function (){
      if (!this.decoratedNode) {
        return;
      }
      if (this.hidden) {
        return;
      }
      var perc = this.getPercentage();
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition({
        x: this.decoratedNode.getPosition().x + this.offsetToParent.x,
        y: this.decoratedNode.getPosition().y + this.offsetToParent.y
      });
      this.setOpacity(this.opacity);

      if (this.done) {
        return;
      }
      if (perc>100) {
        SlowTicker.removeListener(this);
        this.FXSnooze();
        this.done = true;
        this.decoratedNode.trigger('TimerEnd');
      }

      var jtext = this.jdomelem3;
      // Add some ms to make Countdown shortly show 00:00

      if (!this.jdomelem3.hidden) {
        jtext.text(this.textReadyIn + _.toTime(this.remainTime+800));
      }

      var canvas = this.domelem2;
      canvas.width = this.getSize().width;
      canvas.height = this.getSize().height;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.lineWidth=6;
      ctx.arc(this.offsetX, this.offsetY, 14, 270*(Math.PI/180), 270*(Math.PI/180) + perc * 3.6 * (Math.PI / 180), false);
      ctx.strokeStyle='rgba(127, 49, 135, 1)';
      ctx.stroke();
    };


    /////////////////////////////
    // The DecoratorAmount
    /////////////////////////////

    var DecoratorAmount = function(config){
      config = config || {};
      this._id = _instances.length;
      this.text = config.text || "Label";
      this.jdomelem = $("<div class='DecoratorAmount'></div>");
      this.jdomelem2 = $("<div class='DecoratorAmountValue'></div>");
      this.jdomelem3 = $("<div class='DecoratorAmountNum'></div>");
      this.jdomelem.append(this.jdomelem2);
      this.jdomelem.append(this.jdomelem3);
      this.frameSrc = 'MainSprites.png';
      this.frameMap = {
        normal: {x: 267, y: 582, width: 80, height: 16, pivotx: 38, pivoty: 4}
      };
      this.domelem = this.jdomelem[0];
      this.offsetToParent = {x:0,y:35};
      this.amount = config.amount || 0;
      this.init(config);
      this.setFrameSrc(this.frameSrc);
      this.setFrame('normal');
      this.setAmount();
      return this;
    };

    extend(DecoratorAmount, Sprite);


    DecoratorAmount.prototype.decoType = 'DecoratorAmount';

    DecoratorAmount.prototype.setAmount = function(amount){
      amount = amount || this.amount;
      /*
      this.jdomelem2.animate({width:Math.round((amount/100)*60)},600);
      this.jdomelem3.text(_.toKSNum(this.decoratedNode.gameNode.data.absoluteAmount));
      */

      /* FIXME: TURN THIS ON/OFF FOR DEMO BEHAVIOUR */
      this.jdomelem2.animate({width:Math.round((amount/100)*60)},600);
      if (amount < 25) {
        this.jdomelem3.show();
        this.jdomelem3.text(_.toKSNum(this.decoratedNode.gameNode.data.absoluteAmount));
        //this.jdomelem2.hide();
      } else {
        //this.jdomelem2.show();
        //this.jdomelem2.animate({width:Math.round((amount/100)*60)},600);
        this.jdomelem3.hide();
      }
      /* END FIXME */
    };

    DecoratorAmount.prototype.onAddInit = function(){
      var node =this;
      this.offsetToParent = {x: 0, y: this.decoratedNode.height-this.decoratedNode.offsetY-8};
      this.updateRenderProp();
      this.draw();
    };


    DecoratorAmount.prototype.draw = Decorator.prototype.draw;


    /////////////////////////////
    // The Cable
    /////////////////////////////

    // TODO: Embed Image data or find other solutions to reduce requests

    var SparkImg = new Image();
    SparkImg.src = 'img/sprite_spark.png';
    var SparkImg0 = new Image();
    SparkImg0.src = 'img/sprite_spark_small.png';
    var PlugImg = new Image();
    PlugImg.src = 'img/sprite_plug.png';

    var KrapsImg = new Image();
    KrapsImg.src = 'img/sprite_kraps.png';
    var KrapsImg0 = new Image();
    KrapsImg0.src = 'img/sprite_kraps_small.png';
    var GulpImg = new Image();
    GulpImg.src = 'img/sprite_gulp.png';

    var Cable = function(config){
      // Simple cable with canvas render method, to connect perps use Subclass PerpCable
      config = config || {};
      this._id = _instances.length;
      this.tension = config.tension || 1;
      this.cableMaxLength = config.cableMaxLength || 400;
      this.z = -1;
      this.offsetX = config.offsetX || 16;
      this.offsetY = config.offsetY || 16;
      this.pointFrom = config.pointFrom || { "x": 350, "y": 50 };
      this.pointTo = config.pointTo || { "x": 550, "y": 250 };
      this.jdomelem = $("<canvas class='Cable'>Cable"+this._id+"</canvas>").attr('id','Cable'+this._id);
      this.domelem = this.jdomelem[0];
      this.init(config);
      //this.draw();
    };

    extend(Cable, Node);

    Cable.prototype.straightness = 1;
    Cable.prototype.progress = 1;
    Cable.prototype.dataposIn = 0;
    Cable.prototype.dataposOut = 0;
    // Modes: in, out, "inout"
    Cable.prototype.mode = "in";
    Cable.prototype.colorIn = "#16A3D7";
    Cable.prototype.colorOut = "#E85E2B";

    Cable.prototype.getPoints = function() {
      return {
        p1:this.pointFrom,
        p5:this.pointTo
      };
    };

    Cable.prototype.getLength = function() {
      // This is the old Becier fallback, not in use currently
      var p = this.getPoints();
      var cx = (p.p1.x < p.p5.x ? p.p1.x : p.p5.x);
      var cy = (p.p1.y < p.p5.y ? p.p1.y : p.p5.y);
      var x = p.p1.x-cx+this.offsetX;
      var y = p.p1.y-cy+this.offsetY;
      var x2 = p.p5.x-cx+this.offsetX;
      var y2 = p.p5.y-cy+this.offsetY;
      var dx = (x2-x), dy = (y2-y);
      var len = Math.sqrt(dx*dx + dy*dy);
      return len;
    };

    Cable.prototype.draw = function() {
      if (this.hidden || this.progress <= 0) {
        this.css({
          'display': 'none'
        });
        return;
      } else {
        this.css({
          'display': 'block'
        });
      }

      var offset = 0;
      if (this.mode === "inout") {
        offset = 4;
      }

      var path = this;
      var p = this.getPoints();
      path.domelem.width = path.width = Math.abs(p.p1.x-p.p5.x)+(path.offsetX*2);
      path.domelem.height = path.height = Math.abs(p.p1.y-p.p5.y)+(path.offsetY*2);
      var cx = (p.p1.x < p.p5.x ? p.p1.x : p.p5.x);
      var cy = (p.p1.y < p.p5.y ? p.p1.y : p.p5.y);

      //path.setSize({width:this.width,height:this.height});
      path.setTransform(path.getTransform());
      //var modeoff = (this.mode === 'in') ? 0 : 6;
      path.setPosition({x:cx,y:cy});
      var tension = path.tension;
      var cableMaxLength = path.cableMaxLength;
      var x = p.p1.x-cx+path.offsetX;
      var y = p.p1.y-cy+path.offsetY;
      var x2 = p.p5.x-cx+path.offsetX;
      var y2 = p.p5.y-cy+path.offsetY;
      //var xa = p.p2.x-cx;
      //var ya = p.p2.y-cy;
      //var xb = p.p3.x-cx;
      //var yb = p.p3.y-cy;
      //var xc = p.p4.x-cx;
      //var yc = p.p4.y-cy;

      var dx = (x2-x), dy = (y2-y);
      var len = Math.sqrt(dx*dx + dy*dy);
      path.length = len;
      //tension = (Math.abs(x-p.p3.x)+Math.abs(y-p.p3.y))/len;
      var sinefreq = 360;
      var dxa = Math.abs(dx);
      var dya = Math.abs(dy);
      var slope = (dx*dy > 0 ? -1 : 1);
      var radalpha = ( dxa<dya ? Math.asin(dx/len) : Math.asin(dy/len) );
      var radbeta = Math.PI/2 - Math.abs(radalpha);
      var sineamp = (len/4) / Math.tan(radbeta) * slope;

      // adjust for flatter curve
      //sineamp = sineamp * 0.5;

      // Resolution of path:
      var seqs = renderConf.cableResolution;
      //var seqs = renderConf.cableResolution+(1-this.straightness)*10;
      // Dash Array
      var da = [seqs,0];
      //var da = [seqs,0+(1-this.straightness)*10];

      var ctx = path.domelem.getContext('2d');
      var rot = Math.atan2(dy, dx);
      ctx.lineWidth = 6;


      ctx.translate(x, y);
      ctx.rotate(rot);

      var dc = da.length;
      var di = 0, draw = true;
      var vari = 0;
      var snu;
      var stretch = cableMaxLength-len;
      var flatness = (stretch < 0) ? 0 : (stretch/cableMaxLength)*this.straightness;
      var progress = len*this.progress;

      // Orange Cable (Data out of DB)
      if (this.mode === "out" || this.mode === "inout") {
          ctx.beginPath();
          ctx.moveTo(len-offset, offset);
          //ctx.lineTo(dx,0);
          //ctx.lineTo(dx,dy);
          //ctx.lineTo(0,dy);
          //ctx.lineTo(0,0);
          //ctx.rotate(rot);
          x = 0;
          snu = sinefreq/len;
          while (x < progress) {
            x += da[di++ % dc];
            if (x > len) {
              x = len;
            }
            vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
            vari = vari + (Math.sin(x * snu * ((1-tension) * 15) * Math.PI/180)*15)*flatness;
            draw ? ctx.lineTo(len-x, -vari+offset): ctx.moveTo(len-x, -vari+offset);
            //draw ? ctx.rect(x, vari,1,vari): ctx.moveTo(x, vari);
            //draw ? ctx.arc(x, varisum, 10-Math.abs(vari2), 0 , 2 * Math.PI, false): ctx.moveTo(x, vari);
            draw = !draw;

            //ctx.lineTo(x, vari);
          }

          // "#16A3D7" "#E85E2B";
          //ctx.lineCap = 'round';
          ctx.lineCap = 'butt';
          ctx.strokeStyle = this.colorOut;
          ctx.stroke();

          if (this.progress > 0 && this.progress < 1) {
            x = offset;
            progress = len*this.progress;
            x= len-progress;
            x=x-16;
            vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
            vari = vari + (Math.sin(x * snu * ((1-tension) * 18) * Math.PI/180)*15)*flatness;
            ctx.drawImage(GulpImg,x,vari-8+offset);
          }
      }

      // Blue Cable (Data into DB)
      if (this.mode === "in" || this.mode === "inout") {
          /* Fallback to Bezier Drawing
          ctx.beginPath();
          ctx.moveTo(x,y);
          ctx.quadraticCurveTo(xa, ya, xb, yb);
          ctx.quadraticCurveTo(xc, yc, x2, y2);

          ctx.strokeStyle="red";
          ctx.stroke();
          return;
          */

          ctx.beginPath();
          ctx.moveTo(0-offset, 0-offset);
          //ctx.lineTo(dx,0);
          //ctx.lineTo(dx,dy);
          //ctx.lineTo(0,dy);
          //ctx.lineTo(0,0);
          dc = da.length;
          di = 0;
          draw = true;
          x = 0;
          vari = 0;
          snu = sinefreq/len;
          stretch = cableMaxLength-len;
          flatness = (stretch < 0) ? 0 : (stretch/cableMaxLength)*this.straightness;
          progress = len*this.progress;
          while (x < progress) {
            x += da[di++ % dc];
            if (x > len) {
              x = len;
            }
            vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
            vari = vari + (Math.sin(x * snu * ((1-tension) * 15) * Math.PI/180)*15)*flatness;
            draw ? ctx.lineTo(x, vari-offset): ctx.moveTo(x, vari-offset);
            //draw ? ctx.rect(x, vari,1,vari): ctx.moveTo(x, vari);
            //draw ? ctx.arc(x, varisum, 10-Math.abs(vari2), 0 , 2 * Math.PI, false): ctx.moveTo(x, vari);
            draw = !draw;

            //ctx.lineTo(x, vari);
          }

          // "#16A3D7" "#E85E2B";
          //ctx.lineCap = 'round';
          ctx.lineCap = 'butt';
          ctx.strokeStyle = this.colorIn;
          ctx.stroke();
          if (this.progress > 0 && this.progress < 1) {
            x = 0-offset;
            progress = len*this.progress;
            x= progress;
            x=x+8;
            vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
            vari = vari + (Math.sin(x * snu * ((1-tension) * 18) * Math.PI/180)*15)*flatness;
            ctx.drawImage(PlugImg,x-8,vari-8-offset);
          }

      }

      // Data Sprites

      var datapos;

      if (this.dataposIn > 0 && this.dataposIn < 1) {
        x = 0-offset;
        datapos = len*this.dataposIn;
        x= datapos;
        x=x-10;
        vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
        vari = vari + (Math.sin(x * snu * ((1-tension) * 18) * Math.PI/180)*15)*flatness;
        //vari = vari + (Math.sin(x * 90/len * 15 * Math.PI/180)*15)*flatness;
        ctx.drawImage(SparkImg0,x-12,vari-12-offset);
        x=x+10;
        vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
        vari = vari + (Math.sin(x * snu * ((1-tension) * 18) * Math.PI/180)*15)*flatness;
        //vari = vari + (Math.sin(x * 90/len * 15 * Math.PI/180)*15)*flatness;
        //ctx.drawImage(SparkImg,x-16,vari-16);
        ctx.drawImage(SparkImg,x-16,vari-16-offset);
        x=x+10;
        vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
        vari = vari + (Math.sin(x * snu * ((1-tension) * 15) * Math.PI/180)*15)*flatness;
        //vari = vari + (Math.sin(x * 90/len * 15 * Math.PI/180)*15)*flatness;
        ctx.drawImage(SparkImg0,x-12,vari-12-offset);
      }
      if (this.dataposOut > 0 && this.dataposOut < 1) {
        x = offset;
        datapos = len*this.dataposOut;
        x= datapos;
        x=x-10;
        vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
        vari = vari + (Math.sin(x * snu * ((1-tension) * 18) * Math.PI/180)*15)*flatness;
        ctx.drawImage(KrapsImg0,x-12,vari-12+offset);
        //vari = vari + (Math.sin(x * 90/len * 15 * Math.PI/180)*15)*flatness;
        x=x+10;
        vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
        vari = vari + (Math.sin(x * snu * ((1-tension) * 18) * Math.PI/180)*15)*flatness;
        //vari = vari + (Math.sin(x * 90/len * 15 * Math.PI/180)*15)*flatness;
        //ctx.drawImage(SparkImg,x-16,vari-16);
        ctx.drawImage(KrapsImg,x-16,vari-16+offset);
        x=x+10;
        vari = Math.sin(x * snu * Math.PI/180)*sineamp*flatness;
        vari = vari + (Math.sin(x * snu * ((1-tension) * 15) * Math.PI/180)*15)*flatness;
        //vari = vari + (Math.sin(x * 90/len * 15 * Math.PI/180)*15)*flatness;
        ctx.drawImage(KrapsImg0,x-12,vari-12+offset);
      }

      //ctx.lineTo(x, 0);
      //ctx.lineCap = 'round';
      //ctx.fillStyle="#16A3D7";
      //ctx.fill();
    };

    Cable.prototype.FXWobbleTension = function(tension){
      var cable =this;
      var duration = (tension<1) ? 300 : 500;
      //this.dataposIn=0;
      //this.dataposOut=0;
      // Cue Tweens like this!!! Finally got it to work;
      return cable.FXSimpleCue({tension:tension},duration,'easeOut');
    };

    Cable.prototype.FXToggleConnect = function(progress){
      var cable =this;
      var duration = (progress < 1) ? 200 : 800;
      return cable.FXSimpleCue({progress:progress},duration,'sineInOut');
    };

    Cable.prototype.FXStraighten = function(straightness) {
      var cable=this;
      var easing = (straightness === 1) ? 'easeOut' : 'linear';
      var duration = (straightness === 1) ? 200 : 100;
      return this.FXSimpleCue({straightness:straightness},duration,easing);
    };

    Cable.prototype.FXConnect = function(cb) {
      var cable=this;
      cable.progress=0;
      cable.show();
      //cable.dataposIn=0;
      //return this.FXSimple({dataposIn:1,progress:1},1000,'sineInOut');
      return this.FXSimpleCue({progress:1},1000,'sineInOut',cb);
    };

    Cable.prototype.FXDisconnect = function(cb) {
      var cable=this;
      cable.progress=1;
      return this.FXSimpleCue({progress:0},500,'sineInOut',cb);
    };

    Cable.prototype.FXDataIn = function(cb) {
      var cable=this;
      var duration = cable.length*2;
      cable.FXSimpleCue({dataposIn:1},0);
      return cable.FXSimpleCue({dataposIn:0},duration,'linear',cb);
      //cable.dataposIn=1;
      //cable.tension=1;
      //return this.FXSimple({datapos:1},1000,'sineInOut',function(){
      /*
      var tween = this.FXSimple({dataposIn:0},500,'linear',function(){
        cable.dataposIn=1;
        if (cb) {
          cb();
        }
      });
      */
      /*
      Ticker.addListener(cable);
      // Cue Tweens like this!!! Finally got it to work;
      if (!Tween.hasActiveTweens(this)) {
        this.FXAnimation = Tween.get(cable).to({dataposIn:1},0,Ease.linear).to({dataposIn:0},500)
        .call(function(){
          Ticker.removeListener(cable);
        });
      } else if (Tween.hasActiveTweens(this)) {
        Ticker.addListener(cable);
        this.FXAnimation
        .call(function(){
          Ticker.addListener(cable);
        })
        .to({dataposIn:1},0,Ease.linear).to({dataposIn:0},500)
        .call(function(){
          Ticker.removeListener(cable);
        });
      }
      */
    };

    Cable.prototype.FXDataOut = function(cb) {
      var cable=this;
      var duration = cable.length*2;
      cable.FXSimpleCue({dataposOut:0},0);
      return cable.FXSimpleCue({dataposOut:1},duration,'linear',cb);
    };


    /////////////////////////////
    // The PerpCable
    /////////////////////////////

    var PerpCable = function(config,perpFrom,perpTo){
      // Connection cable with perps as start and endpoint...
      config = config || {};
      this._id = _instances.length;
      this.tension = config.tension || 1;
      //this.cableMaxLength = config.cableMaxLength || 480;
      // Clip to 480px, so Cables usually are never longer than 512 (texture size)
      this.cableMaxLength = config.cableMaxLength || 480;
      this.z = -1;
      this.offsetX = config.offsetX || 16;
      this.offsetY = config.offsetY || 16;
      this.perpFrom = perpFrom;
      this.perpTo = perpTo;
      //if (!perpFrom.sticky) perpFrom.cables.push(this);
      perpFrom.cables.add(this);
      perpTo.cables.add(this);
      this.pointFrom = this.perpFrom.getPosition();
      this.pointTo = this.perpTo.getPosition();
      this.jdomelem = $("<canvas class='Cable'></canvas>").attr('id','Cable'+this._id);
      this.domelem = this.jdomelem[0];
      this.init(config);
      //this.draw();
    };

    extend(PerpCable, Cable);

    PerpCable.prototype.getPoints = function() {
      return {
        p1:this.perpFrom.getPosition(),
        p5:this.perpTo.getPosition()
      };
    };

    /////////////////////////////
    // The ViewTab
    /////////////////////////////

    var ViewTab = function(config){
      // Generic HTML Template based Container containing template based items
      config = config || {};
      this._id = _instances.length;
      // Set View defaults
      config.hidden = false;
      this.draggable = false;
      this.clickable = false;
      this.width = config.width || 960;
      this.height = config.height || 960;
      this.jdomelem = $("<div class='ViewTab'></div>");
      this.domelem = this.jdomelem[0];
      this.jdomelem1 = $("<div class='ViewTabContainer'></div>");
      this.jdomelem3 = this.popupContainerDomelem = $("<div class='PopupContainer'></div>");
      //this.jdomelem1.append(this.jdomelem2);
      this.jdomelem.append(this.jdomelem1);
      this.jdomelem.append(this.jdomelem3);
      this.domelem1 = this.jdomelem1[0];

      // FIXME: Better collect which events we're listening to
      this.jdomelem3.on('mousedown mouseup touchstart touchend dblclick dbltap tap', function(e){
        e.preventDefault();
        e.stopPropagation();
      });

      this.init(config);

      var node = this;

      node.jdomelem.on('click touchend','.ViewTabMenuButton:not(.disabled, .active)',function(e){
        e.stopPropagation();
        e.preventDefault();
        var button = $(this);
        var bgestalt = button.attr('data-button-gestalt');
        var bdata = button.attr('data-button-data');
        this.lastButton = button;
        node.jdomelem.find('.ViewTabMenuButton').removeClass('active');
        button.addClass('active');
        node.trigger('button_click.'+button.attr('data-button-id'),[bgestalt,bdata]);
      });
      
      node.jdomelem.on('click touchend','.Button:not(.disabled, .active)',function(e){
        e.stopPropagation();
        e.preventDefault();
        var button = $(this);
        var bgestalt = button.attr('data-button-gestalt');
        var bdata = button.attr('data-button-data');
        node.lastButton = button;
        button.addClass('active');
        node.trigger('button_click.'+button.attr('data-button-id'),[bgestalt,bdata]);
      });

      // LISTEN TO STATES
      // FIXME: redundant to viewmap code
      node.on("states_active",function(e,value){
        if (value) {
          node.FXShow();
          node.parentNode.jdomelem.addClass('Active' + node.jdomelem.attr('id'));
          node.gameNode.GameRoot.renderMenu.jdomelem.find('.MainMenuButton').removeClass('active');
          node.gameNode.GameRoot.renderMenu.jdomelem.find('.MainMenuButton[data-button-id='+node.id+']').addClass('active');
          node.trigger('viewtab_selected');
        } else {
          node.parentNode.jdomelem.removeClass('Active' + node.jdomelem.attr('id'));
          node.FXHide();
        }
      });
    };

    extend(ViewTab, Node);

    ViewTab.prototype.render = function() {
      if (this.RenderTemplate !== undefined) {
        var html = app.renderView(this.RenderTemplate,this);
        this.jdomelem1.html(html);
      }
    };

    ViewTab.prototype.addChild = function(child,ui_elem){
      // Add a child to a Node
      // This actually draws an element on the screen when the topmost Node is inside the html body
      // flag ui_elem adds child to wrapper domelem
      if (child.hidden) {
        child.hide();
      }
      if (ui_elem) {
        this.jdomelem.append(child.domelem);
      } else {
        this.jdomelem1.append(child.domelem);
      }
      child.parentNode = this;
      this.children.add(child);
      //child.dragHandler = child.dragHandler || this.dragHandler;
      //child.useDragHandler = this.dragHandler;
      child.onAddInit();
      return child;
    };

    ViewTab.prototype.lock = function(){
      this.jdomelem3.addClass('lockOn');
    };

    ViewTab.prototype.unlock = function(){
      this.jdomelem3.removeClass('lockOn');
    };

    ViewTab.prototype.onAddInit = function(){
      /*
      if (this.draggable) {
        this.initScroller();
      }
      this.updateRenderProp();
      this.dragHandler = new DragHandler();
      this.useDragHandler=this.dragHandler;
      */
      this.render();
      this.draw();
      if (this.hidden) {
        this.hide();
      }
    };

    ViewTab.prototype.css = function(css) {
      // Wrapper for CSS manipulation of domelem, currently jQuery
      this.jdomelem1.css(css);
    };

    ViewTab.prototype.FXShow = function(){
        var node=this;
        //node.show();
        node.jdomelem.addClass('active');
    };

    ViewTab.prototype.FXHide = function(){
        var node=this;
        //node.hide();
        node.jdomelem.removeClass('active');
    };

    ViewTab.prototype.updateScroller = function(){
      // FIXME: do something on resize?
      var node = this;
      var stage = this.parentNode;
      var scaleW = stage.width/node.width;
      var scaleH = stage.height/node.height;
    };



    /////////////////////////////
    // The ViewMap
    /////////////////////////////

    var ViewMap = function(config){
      // Zoom- and scrollable Container containing Nodes, Sprites etc... uses Scroller.js
      config = config || {};
      this._id = _instances.length;
      // Set View defaults
      config.hidden = false;
      this.draggable = true;
      this.clickable = true;
      this.offsetX = 0; // Scroller needs offset 0
      this.offsetY = 0; // Scroller needs offset 0
      this.width = config.width || 2920;
      this.height = config.height || 2200;
      this.zoomScale = config.zoomScale || 1;
      this.jdomelem = $("<div class='ViewMap'></div>");
      this.domelem = this.jdomelem[0];
      this.jdomelem1 = $("<div class='ViewMapContainer'></div>");
      this.domelem1 = this.jdomelem1[0];
      this.jdomelem2 = $("<img class='ViewMapContainerImg' src='"+setup.imagePathPrefix+config.background+"'>");

      this.jdomelemZoom = $('<div class="ZoomControls"><div class="ZoomIn"></div><div class="ZoomOut"></div><div class="Fullscreen"></div></div>');

      this.domelem2 = this.jdomelem2[0];
      this.jdomelem3 = this.popupContainerDomelem = $("<div class='PopupContainer'></div>");
      //this.jdomelem4 = this.popupContainer = $("<div class='PopupContainer'></div>");
      this.jdomelem1.append(this.jdomelem2);
      this.jdomelem.append(this.jdomelem1);
      this.jdomelem.append(this.jdomelem3);
      this.jdomelem.append(this.jdomelemZoom);
      //this.jdomelem.append(this.jdomelem4);

      // FIXME: Better collect which events we're listening to
      this.jdomelem3.on('mousedown mouseup touchstart touchend dblclick dbltap tap', function(e){
        e.preventDefault();
        e.stopPropagation();
      });

      this.init(config);

      var node = this;
      // LISTEN TO STATES
      node.on("states_active",function(e,value){
        e.stopPropagation();
        if (value) {
          node.FXShow();
          node.parentNode.jdomelem.addClass('Active' + node.jdomelem.attr('id'));
          node.gameNode.GameRoot.renderMenu.jdomelem.find('.MainMenuButton').removeClass('active');
          node.gameNode.GameRoot.renderMenu.jdomelem.find('.MainMenuButton[data-button-id='+node.id+']').addClass('active');
        } else {
          node.parentNode.jdomelem.removeClass('Active' + node.jdomelem.attr('id'));
          node.FXHide();
        }

      });
    };

    extend(ViewMap, Node);

    ViewMap.prototype.addChild = function(child,ui_elem){
      // Add a child to a Node
      // This actually draws an element on the screen when the topmost Node is inside the html body
      // flag ui_elem adds child to wrapper domelem
      if (child.hidden) {
        child.hide();
      }
      if (ui_elem) {
        this.jdomelem.append(child.domelem);
      } else {
        this.jdomelem1.append(child.domelem);
      }
      child.parentNode = this;
      this.children.add(child);
      child.dragHandler = child.dragHandler || this.dragHandler;
      child.useDragHandler = this.dragHandler;
      child.onAddInit();
      return child;
    };

    ViewMap.prototype.lock = function(){
      this.jdomelem3.addClass('lockOn');
    };

    ViewMap.prototype.unlock = function(){
      this.jdomelem3.removeClass('lockOn');
    };

    ViewMap.prototype.onAddInit = function(){
      this.setZoomScale(this.zoomScale);
      if (this.draggable) {
        this.initScroller();
      }
      this.updateRenderProp();
      this.dragHandler = new DragHandler();
      this.useDragHandler=this.dragHandler;
      this.draw();
      if (this.hidden) {
        this.hide();
      }
    };

    ViewMap.prototype.css = function(css) {
      // Wrapper for CSS manipulation of domelem, currently jQuery
      this.jdomelem1.css(css);
    };

    ViewMap.prototype.setPosition = function(pos){
      // Override setPosition for Scroller Performance and Usage
      // Round for render performance and better sprite anti aliasing
      if (renderConf.viewMapStopZone) {
        var stopZone = renderConf.viewMapStopZone;
        var clipx = this.parentNode.width - this.getScaledSize().width - stopZone;
        var clipy = this.parentNode.height - this.getScaledSize().height - stopZone;
        var clipdiff;
        if (pos.x > stopZone) {
          pos.x = stopZone + (pos.x-stopZone)*(stopZone/pos.x);
        } else if (pos.x < clipx) {
          clipdiff = pos.x-clipx;
          pos.x = clipx + clipdiff*(stopZone/(stopZone-clipdiff));
        }
        if (pos.y > stopZone) {
          pos.y = stopZone + (pos.y-stopZone)*(stopZone/pos.y);
        } else if (pos.y < clipy) {
          clipdiff = pos.y-clipy;
          pos.y = clipy + clipdiff*(stopZone/(stopZone-clipdiff));
        }
      }
      pos.x = Math.round(pos.x);
      pos.y = Math.round(pos.y);
      this.x = pos.x;
      this.y = pos.y;
      this.domelem1.style.webkitTransformOriginZ = 0;
      this.domelem1.style.webkitTransformOriginX = pos.x + "px";
      this.domelem1.style.webkitTransformOriginY = pos.y + "px";
      this.domelem1.style.MozTransformOrigin = pos.x + "px " + pos.y + "px";
      this.domelem1.style.msTransformOrigin = pos.x + "px " + pos.y + "px";
      // TODO Styles for other browsers and fallback
      this.setTransform({transX:pos.x+this.offsetX,transY:pos.y+this.offsetY});
    };

    ViewMap.prototype.updateScroller = function(){
      var node = this;
      var stage = this.parentNode;
      var scaleW = stage.width/node.width;
      var scaleH = stage.height/node.height;
      var minZoom = (scaleW > scaleH) ? scaleW : scaleH;
      if (minZoom>1) {
        minZoom = 1;
      }
      node.scroller.options.minZoom = (minZoom < 0.5) ? 0.5 : minZoom;
      node.scroller.zoomTo(this.zoomScale);
      node.scroller.setDimensions(stage.width, stage.height, node.getSize().width, node.getSize().height);
    };

    ViewMap.prototype.initScroller = function(){
      //this.cursor = new Circle({radius:12,fill:"rgba(22,163,215,0.5)",strokeWidth:3,stroke:"rgba(22,163,215,1)"});
      //this.cursor.setOpacity(0);
      //this.addChild(this.cursor);
      // TODO: Maybe make a true Scroller Module like dragHandler
      var node = this;
      var initx = this.x;
      var inity = this.y;
      node.scroller = new Scroller(function(left,top,zoom){
        // Scroller Render Method
        /* FIXME: set actual transform offset to screen center
        node.offsetX=left;
        node.offsetY=top;
        var newpos = node.parentNode.getCenterPosition()
        node.setPosition({x:newpos.x,y:newpos.y});
        */
        if (!node.scroller.__isDecelerating && !node.scroller.__isDragging && !node.scroller.__isAnimating) {
          node.trigger('scrollend',[node]);
        }
        node.setZoomScale(zoom);
        node.setPosition({x:-left,y:-top});
        node.setTransform({scaleX:zoom,scaleY:zoom});
      }, {
        zooming: true,
        locking:false,
        bouncing:false,
        //animating:true,
        animating:false,
        animationDuration:300,
        minZoom:0.5,
        maxZoom:1
      });
      //node.scroller.setDimensions(node.parentNode.getSize().width, node.parentNode.getSize().height, node.getSize().width, node.getSize().height);
      node.scroller.setPosition(0,0);
      node.updateScroller();
      node.scroller.scrollTo(-initx,-inity);

      node.jdomelem.on('dblclick','.ZoomControls', function(e){
        e.stopPropagation();
      });
      node.jdomelem.on('click touchend','.ZoomControls .ZoomOut', function(e){
        e.stopPropagation();
        node.zoomOut();
      });
      node.jdomelem.on('click touchend','.ZoomControls .ZoomIn', function(e){
        e.stopPropagation();
        node.zoomIn();
      });

      node.jdomelem.on('click touchend','.ZoomControls .Fullscreen', function(e){
        e.stopPropagation();
        app.game.toggleFullScreen();
      });


      node.on('dblclick',function(e){
        e.stopPropagation();
        if (node.zoomScale !== 1) {
          node.scroller.options.animating=true;
          node.scroller.zoomTo(1, true, node.userAbsPos.x,node.userAbsPos.y);
          node.scroller.options.animating=false;
          // Cursor FX
          //node.cursor.radius=12;
          //node.cursor.strokeWidth=3;
          //node.cursor.setOpacity(1);
          //node.cursor.FXSimple({scaleX:3,scaleY:3,opacity:0},250);
        } else {
          //node.scroller.zoomTo(0.5, true, node.userAbsPos.x,node.userAbsPos.y);
          node.scroller.options.animating=true;
          node.scroller.zoomTo(node.scroller.options.minZoom, true, node.userAbsPos.x,node.userAbsPos.y);
          node.scroller.options.animating=false;

          // Cursor FX
          //node.cursor.radius=24;
          //node.cursor.strokeWidth=6;
          //node.cursor.setOpacity(1);
          //node.cursor.FXSimple({scaleX:0,scaleY:0,opacity:0},250);
        }
      });

      node.on('mousedown',function(e){
        //e.stopPropagation();
        e.preventDefault();
        // Set misc positioning variables
        var userPos= {};
        var userScaledPos= {};
        var userAbsPos= {};
        var stageCenter = node.parentNode.getCenterPosition();
        userPos.x = (e.pageX-node.jdomelem.offset().left);
        userPos.y = (e.pageY-node.jdomelem.offset().top);
        userScaledPos.x = (e.pageX-node.jdomelem.offset().left)*node.dragHandler.scale;
        userScaledPos.y = (e.pageY-node.jdomelem.offset().top)*node.dragHandler.scale;
        userAbsPos.x = e.pageX-node.parentNode.jdomelem.offset().left;
        userAbsPos.y = e.pageY-node.parentNode.jdomelem.offset().top;
        node.userPos=userPos;
        node.userAbsPos=userAbsPos;
        node.userScaledPos=userScaledPos;

        // Start scroller
        node.dragging=true;
        node.scroller.doTouchStart([{
          pageX: e.pageX,
          pageY: e.pageY
        }], e.timeStamp);
      });

      node.useDragHandler.on('mousemove',function(e){
        if (node.dragging) {
          node.scroller.doTouchMove([{
            pageX: e.pageX,
            pageY: e.pageY
          }], e.timeStamp);
        }
      });

      node.useDragHandler.on('mouseup',function(e){
        node.dragging=false;
        node.scroller.doTouchEnd(e.timeStamp);
      });

      node.domelem.addEventListener("touchstart", function(e) {
        // Don't react if initial down happens on a form element
        if (e.touches[0] && e.touches[0].target && e.touches[0].target.tagName.match(/input|textarea|select/i)) {
          return;
        }
        var pageX = e.touches[0].pageX;
        var pageY = e.touches[0].pageY;
        var userScaledPos = {};
        userScaledPos.x = (pageX-node.jdomelem.offset().left)*node.dragHandler.scale;
        userScaledPos.y = (pageY-node.jdomelem.offset().top)*node.dragHandler.scale;

        node.scroller.doTouchStart(e.touches, e.timeStamp);
        e.preventDefault();
      }, false);

      node.useDragHandler.domelem.addEventListener("touchmove", function(e) {
        node.scroller.doTouchMove(e.touches, e.timeStamp, e.scale);
      }, false);

      node.useDragHandler.domelem.addEventListener("touchend", function(e) {
        node.scroller.doTouchEnd(e.timeStamp);
      }, false);

      node.useDragHandler.domelem.addEventListener("touchcancel", function(e) {
        node.scroller.doTouchEnd(e.timeStamp);
      }, false);
    };

    ViewMap.prototype.scrollTo = function(pos,dur){
      var vpCenter = this.parentNode.getCenterPosition();
      dur = (dur !== undefined) ? dur : 300;
      this.scroller.options.animating = (dur > 0) ? true : false;
      this.scroller.options.animationDuration = dur;
      this.scroller.scrollTo(pos.x-vpCenter.x,pos.y-vpCenter.y,true);
      this.scroller.options.animating=false;
      this.scroller.options.animationDuration = 300;
    };

    ViewMap.prototype.setZoomScale = function(scale){
      this.zoomScale = scale;
      this.dragHandler.scale = 1/scale;
      if (scale < 0.75) {
        this.jdomelem.addClass('zoomHide2');
      } else {
        this.jdomelem.removeClass('zoomHide2');
      }
      if (scale < 1) {
        this.jdomelem.addClass('zoomHide1');
      } else {
        this.jdomelem.removeClass('zoomHide1');
      }
    };

    ViewMap.prototype.zoomIn = function(){
      var node = this;
      var zoomTo = (node.zoomScale+0.25 > 1) ? 1 : node.zoomScale+0.25;
      node.scroller.options.animating=true;
      node.scroller.zoomTo(node.zoomScale+0.25, true);
      node.scroller.options.animating=false;
    };

    ViewMap.prototype.zoomOut = function(){
      var node = this;
      var zoomTo = (node.zoomScale-0.25 < 0.5) ? 0.5 : node.zoomScale-0.25;
      node.scroller.options.animating=true;
      node.scroller.zoomTo(zoomTo, true);
      node.scroller.options.animating=false;
    };

    ViewMap.prototype.FXShow = function(){
        var node=this;
        //node.show();
        node.jdomelem.addClass('active');
    };

    ViewMap.prototype.FXHide = function(){
        var node=this;
        //node.hide();
        node.jdomelem.removeClass('active');
    };


    /////////////////////////////
    //       The Stage
    /////////////////////////////

    var Stage = function(config){
      // The Stage, contains all Render Items, this is also the Viewport
      this._id = _instances.length;
      config = config || {};
      config.x = 0;
      config.y = 0;
      this.x = 0;
      this.y = 0;
      this.offsetX = config.offsetX || 0;
      this.offsetY = config.offsetY || 0;
      this.width = config.width || 960;
      this.height = config.height || 600;
      this.jdomelem = $("<div class='Stage'></div>").attr('id','Stage'+this._id);
      this.jdomelem2 = this.popupContainerDomelem = $("<div class='PopupContainer Top NoClose'></div>");
      this.jdomelem.append(this.jdomelem2);
      this.domelem = this.jdomelem[0];
      this.position = 'relative';
      this.dragHandler = new DragHandler();
      this.useDragHandler = this.dragHandler;
      this.init(config);
      this.initUI();
      this.onAddInit();
      return this;
    };

    extend(Stage, Node);

    Stage.prototype.initUI = function(){
      var stage= this;
      stage.on('mousemove',function(e){
        var userPos= {};
        userPos.x = e.pageX-stage.jdomelem.offset().left;
        userPos.y = e.pageY-stage.jdomelem.offset().top;
        stage.userAbsPos=userPos;
      });
      stage.on('mousedown touchstart',function(e){
        // FIX for FF accidential selection getting stuck
        document.getSelection().removeAllRanges();
        var userPos= {};
        userPos.x = e.pageX-stage.jdomelem.offset().left;
        userPos.y = e.pageY-stage.jdomelem.offset().top;
        stage.userClickAbsPos=userPos;
      });

    };

    Stage.prototype.lock = function(){
      this.jdomelem2.addClass('lockOn');
    };

    Stage.prototype.unlock = function(){
      this.jdomelem2.removeClass('lockOn');
    };

    Stage.prototype.setSize = function(size){
      this.setAttrs(size);
      this.css({
        'width':this.width+"px",
        'height':this.height+"px"
      });
      var stage = this;
      stage.children.each(function(node){
        if (node.scroller) {
          node.updateScroller();
        }
      });
    };


    /////////////////////////////
    // The Main Menu
    /////////////////////////////

    var MainMenu = function(config){
      config = config || {};
      this._id = _instances.length;
      this.jdomelem = $("<div class='MainMenu'></div>");
      this.domelem = this.jdomelem[0];
      this.position='relative';
      this.width = config.width || 960;
      this.height = config.height || 42;
      this.z = 1000;
      this.data = config.data || { buttons:[] };
      this.data.logo = RenderSprite(this.data.logo);

      this.init(config);
      this.setSize(this.getSize());
      this.updateRenderProp();
      this.render();

      // Setup Button Events
      var GameRoot = this.gameNode.GameRoot;
      var menu = this;
      this.jdomelem.on('click touchend','#UserData:not(.disabled)',function(e){
        e.stopPropagation();
        e.preventDefault();
        GameRoot.trigger('user_data');
      });
      this.jdomelem.on('click touchend','#Logout',function(e){
        e.stopPropagation();
        e.preventDefault();
        GameRoot.lock();
        routie('sign_out');
      });
      this.jdomelem.on('click touchend','.MainMenuButton:not(.disabled)',function(e){
        e.stopPropagation();
        e.preventDefault();
        GameRoot.trigger('switch_view',[$(this).attr('data-button-id')]);
      });

      return this;
    };

    extend(MainMenu,Stage);

    MainMenu.prototype.template = 'mainmenu.html';

    MainMenu.prototype.render = function() {
      var html = app.renderView(this.template, this.data);
      this.jdomelem.html(html);
    };

    MainMenu.prototype.lock = function() {
      var node = this;
      node.jdomelem.addClass('locked');
      node.jdomelem.find('.UserButton:not(#Logout), .MainMenuButton').addClass('disabled');
    };

    MainMenu.prototype.unlock = function() {
      var node = this;
      node.jdomelem.removeClass('locked');
      node.jdomelem.find('.UserButton, .MainMenuButton').removeClass('disabled');
    };

    MainMenu.prototype.addButton = function(text,id,states) {
      this.data.buttons.push({
        label:text,
        id:id,
        states:states
      });
      this.render();
    };

    /////////////////////////////
    //       The ButtonInline
    /////////////////////////////

    // FIXME: Find a better way to implement Buttons, Menus
    // and all that stuff that doesn't actually need generic RenderNode stuff
    var ButtonInline = function(config){
      config = config || {};
      this._id = _instances.length;
      this.display='inline-block';
      this.position='relative';
      this.textAlign = config.textAlign || "center";
      this.textFontSize = config.textFontSize || "20px";
      this.jdomelem = $("<div class='Button'></div>");
      this.domelem = this.jdomelem[0];
      this.init(config);
    };

    extend(ButtonInline, Text);

    // Dispable Positioning for Buttons
    ButtonInline.prototype.setPosition = function(){
      return false;
    };
    ButtonInline.prototype.setTransform = function(){
      return false;
    };


    /////////////////////////////
    //       The Statusbar
    /////////////////////////////

    var Statusbar = function(config){
      config = config || {};
      var node = this;
      this._id = _instances.length;
      this.jdomelem = $("<div class='Statusbar'></div>");
      this.domelem = this.jdomelem[0];


      this.init(config);

      this.profiles_val = this.profiles.val;
      this.profiles_max = this.profiles.max;
      this.profiles_barsize = this.profiles.barsize;
      this.profiles_crosssum = this.profiles.crosssum;
      this.profiles_tokenslength = this.profiles.tokenslength;
      this.profiles_tokenslengthmax = this.profiles.tokenslengthmax;
      this.cash_val = this.cash.val;
      this.AP_val = this.AP.val;
      this.AP_max = this.AP.max;
      this.AP_barsize = this.AP.barsize;
      this.karma_val = this.karma.val;
      this.karma_max = this.karma.max;
      this.karma_intensity = this.karma_intensity;
      this.karma_barsize = this.karma.barsize;
      this.XP_val = this.XP.val;
      this.XP_max = this.XP.max;
      this.XP_level = this.XP.level;
      this.XP_barsize = this.XP.barsize;

      this.initUI();

      // FIXME: data should be referenced to serverdata
    };
    extend(Statusbar, Node);

    Statusbar.prototype.onAddInit = function(){
      this.updateRenderProp();
      this.render();
    };

    Statusbar.prototype.draw = function(){
      // Update domelem to current settings
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    Statusbar.prototype.template = 'statusbar.html';
    Statusbar.prototype.width = 720;
    Statusbar.prototype.height = 25;
    Statusbar.prototype.y = 12;
    Statusbar.prototype.z = 10000;
    Statusbar.prototype.offsetX = Statusbar.prototype.width/2;
    Statusbar.prototype.offsetY = 0;

    Statusbar.prototype.render = function(){
      this.x = this.parentNode.getSize().width/2;
      this.jdomelem.empty();
      var html = app.renderView(this.template, this);
      this.jdomelem.append(html);
      this.draw();
    };

    Statusbar.prototype.tick = function(){
      this.render();
    }

    Statusbar.prototype.FXUpdateAP = function(silent){
      var dur = (silent) ? 0 : 250;
      this.AP_active = 1;
      this.AP_val = this.AP.val;
      this.FXSimpleCue({AP_active:0,AP_max:this.AP.max,AP_barsize:this.AP.barsize},dur,'linear');
    };
    Statusbar.prototype.FXUpdateXP = function(silent){
      var dur = (silent) ? 0 : 250;
      this.XP_level = this.XP.level;
      this.XP_active = 1;
      this.XP_val = this.XP.val;
      this.FXSimpleCue({XP_active:0,XP_barsize:this.XP.barsize},dur,'linear');
    };
    Statusbar.prototype.FXUpdateCash = function(silent){
      var dur = (silent) ? 0 : 250;
      this.cash_active = 1;
      this.FXSimpleCue({cash_active:0,cash_val:this.cash.val},dur,'linear');
    };
    Statusbar.prototype.FXUpdateKarma = function(silent){
      var dur = (silent) ? 0 : 250;
      this.karma_active = 1;
      this.FXSimpleCue({karma_active:0,karma_val:this.karma.val,karma_barsize:this.karma.barsize},dur,'linear');
    };
    Statusbar.prototype.FXUpdateProfiles = function(silent){
      var dur = (silent) ? 0 : 500;
      this.profiles_active = 1;
      this.FXSimpleCue({
        profiles_active:0,
        profiles_val:this.profiles.val,
        profiles_barsize:this.profiles.barsize,
        profiles_crosssum : this.profiles.crosssum,
        profiles_tokenslength : this.profiles.tokenslength
      },dur,'linear');
    };

    Statusbar.prototype.startLoop = function(func, time){
      var node = this;
      // only one loop per node
      time = time || 1000;
      if (this.loop) {
        window.clearTimeout(this.loop);
      }
      if (func) {
        func();
      }
      this.loop = window.setTimeout(function(){
        node.startLoop(func, time);
      }, time);
    };

    Statusbar.prototype.stopLoop = function(){
      if (this.loop) {
        window.clearTimeout(this.loop);
      }
    };

    Statusbar.prototype.textMoreIn = _._('More Energy in') + " ";
    Statusbar.prototype.initUI = function(){
      var node = this;
      node.jdomelem.on('click touchend','.StatusItem',function(e){
        e.stopPropagation();
        var statusid = $(this).attr('data-status-id');
        node.trigger('click_status.'+statusid);
      });

      node.jdomelem.on('mouseenter','.StatusItem.AP', function(e){
        e.stopPropagation();
        var groot = node.gameNode.GameRoot;
        if (groot.ap_value >= groot.xp_level.ap_max) {
          return;
        }
        var jtext = $(this).find(".StatusRemain");
        jtext.show();
        var APT = groot.APTicker;
        node.startLoop(function(){
          jtext.html(node.textMoreIn + _.span(_.toTime(APT.getRemainingTime())));
        }, 1000);
      });
      node.jdomelem.on('mouseleave','.StatusItem.AP', function(e){
        e.stopPropagation();
        node.stopLoop();
        var jtext = $(this).find(".StatusRemain");
        jtext.hide();
      });
    };


    /////////////////////////////
    //       The Status
    /////////////////////////////

    var StatusItem = function(config){
      config = config || {};
      var node = this;
      this._id = _instances.length;
      this.jdomelem = $("<div class='StatusItem'></div>");
      this.frameSrc = config.frameSrc || 'MainSprites.png';
      this.frameMap = config.frameMap || {
        normal: {x: 36, y: 580, width: 128, height: 25, pivotx: 0, pivoty: 0}
      };
      this.frame = 'normal';
      this.domelem = this.jdomelem[0];
      this.init(config);
      this.setFrameSrc(this.frameSrc);
      this.setFrame(this.frame);
      this.draw();
    };
    extend(StatusItem, Sprite);


    /////////////////////////////
    //       The DatabaseQueue
    /////////////////////////////

    var DBQueue = function(config){
      config = config || {};
      var node = this;
      this._id = _instances.length;
      this.jdomelem = $("<div class='DatabaseQueue'></div>");
      this.domelem = this.jdomelem[0];

      this.init(config);
      this.off();

      this.jdomelem.on('click touchend','.Button:not(.disabled)[data-button-id="DatabaseUpgrades"]',function(e){
        e.stopPropagation();
        e.preventDefault();
        node.trigger('select_upgrades');
      });
      this.jdomelem.on('click touchend','.DatabaseQueueItem:not(.disabled)',function(e){
        e.stopPropagation();
        e.preventDefault();
        // TODO get real ID, currently needs integer...
        var psid = $(this).attr('data-psid');
        node.jdomelem.find('.DatabaseQueueItem').removeClass('selected');
        $(this).addClass('selected');

        if (e.shiftKey) {
          node.trigger('profileset_shift_click',[psid]);
        }
        else {
          node.trigger('profileset_click',[psid]);
        }
      });

      node.on('mousedown touchstart',function(e){
        var userPos= {};
        userPos.x = e.pageX-node.jdomelem.offset().left;
        userPos.y = e.pageY-node.jdomelem.offset().top;
        node.userClickAbsPos=userPos;
      });

    };
    extend(DBQueue, Node);

    DBQueue.prototype.onAddInit = function(){
      this.updateRenderProp();
      this.render();
    };

    DBQueue.prototype.textProfilesNew = _._('%s New');
    DBQueue.prototype.textUpdated = _._('%s Updated');
    DBQueue.prototype.FXMerge = function(psid,inc,dup,wait){
      var ps = this.jdomelem.find('.DatabaseQueueItem[data-psid='+psid+']');
      var after = ps.nextAll('.DatabaseQueueItem');
      ps.addClass('disabled');
      this.FXBlingQueue({
        text: _.sprintf(this.textProfilesNew, _.toKSNum(inc)),
        wait: 200,
        extendClass: "ProfileBlingNew"
      });
      this.FXBlingQueue({
        text: _.sprintf(this.textUpdated,_.toKSNum(dup)),
        wait: 500,
        extendClass: "ProfileBlingUpdated"
      });
      window.setTimeout(function(){ ps.addClass('merging'); }, 200);
      // FIXME: BROKEN ANI

      window.setTimeout(function(){
        ps.animate({top: '102'}, 250, function(){
          var del = 0;
          after.each(function(){
            $(this).animate({left:"-=100"},250+del);
            del += 50;
          });
          ps.remove();
        });
      }, 2000+wait);
      /*
      ps.delay(500 + wait).animate({top: '102'}, 250, function(){
        after.each(function(){
          $(this).animate({left:"-=100"},500);
        });
        ps.remove();
      });
      */
      /*
      ps.delay(2500+wait).animate({top: '100'}, 250, function() {
        ps.remove()
      });
      */


      //window.setTimeout(function(){ps.remove();},1000)
    };

    DBQueue.prototype.draw = function(){
      // Update domelem to current settings
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    DBQueue.prototype.template = 'db_queue.html';
    DBQueue.prototype.width = 720;
    DBQueue.prototype.height = 100;
    DBQueue.prototype.z = 10;
    DBQueue.prototype.offsetX = DBQueue.prototype.width/2;
    DBQueue.prototype.offsetY = -58;

    DBQueue.prototype.render = function(){
      this.x = this.parentNode.parentNode.getSize().width/2;
      this.y = this.parentNode.parentNode.getSize().height - this.height;
      this.jdomelem.empty();
      var html = app.renderView(this.template, this);
      this.jdomelem.append(html);
      this.draw();
    };

    DBQueue.prototype.tick = function(){
      this.render();
    }



    /////////////////////////////
    //       The Popup
    /////////////////////////////

    var Popup = function Popup(config){
      config = config || {};

      this.open = true;
      var node = this;
      this._id = _instances.length;
      this.jdomelem = $("<div class='Popup'></div>");
      this.domelem = this.jdomelem[0];
      this.init(config);
      this.initBaseUI();
    };
    extend(Popup, Node);

    Popup.prototype.template = 'popup.html';
    Popup.prototype.width = 600;
    //Popup.prototype.height = 520;
    Popup.prototype.offsetX = Popup.prototype.width/2;
    Popup.prototype.offsetY = Popup.prototype.height/2-10;

    Popup.prototype.initBaseUI = function() {
      var node = this;
      var tdata = this.templateData;
      // Render sprites only if not instantiated yet
      if (tdata.data && tdata.data.popup_sprite && !tdata.data.popup_sprite.html) {
        tdata.data.popup_sprite.html = RenderSprite(tdata.data.popup_sprite);
      }
      tdata.button = tdata.button;


      if (this.popupContainer && this.extendClass) {
        this.popupContainer.renderNode.popupContainerDomelem.addClass(this.extendClass);
      }

      node.render();

      node.jdomelem.on('click touchend',function(e){
        e.stopPropagation();
        e.preventDefault();
      });

      if (this.popupContainer) {
        this.popupContainer.lock();
        this.popupContainer.renderNode.popupContainerDomelem.on('click touchend',function(e){
          if (!$(this).hasClass('NoClose')) {
            node.trigger('popup_close');
            node.trigger('popup_cancel');
          }
        });
      }

      node.on('no_cash',function(e){
        if (node.lastButton) {
          node.jdomelem.find('.Button').removeClass('disabled no_cash');;
          node.lastButton.addClass('disabled no_cash');
        }
        else {
          node.jdomelem.find('.Button.MainButton').addClass('disabled no_cash').removeClass('active');
        }
        node.FXNoCash();
      });

      node.on('no_AP',function(e){
        if (node.lastButton) {
          node.jdomelem.find('.Button').removeClass('disabled no_AP');;
          node.lastButton.addClass('disabled no_AP');
        }
        else {
          node.jdomelem.find('.Button.MainButton').addClass('disabled no_AP').removeClass('active');
        }
        node.FXNoAP();
      });

      node.on('error',function(e){
        if (node.lastButton) {
          node.jdomelem.find('.Button').removeClass('active disabled ERROR');;
          node.lastButton.addClass('disabled ERROR');
        }
        else {
          node.jdomelem.find('.Button.MainButton').addClass('disabled ERROR').removeClass('active');
        }
        node.FXError();
      });

      node.jdomelem.on('click touchend','.PopupLogo',function(e){
        // FIXME: put debug flag here!
        if (setup.debug) {
          node.jdomelem.find('.Debug').toggle();
          console.log(node.gameNode);
        }
      });

      node.jdomelem.on('click touchend','.Button:not(.disabled, .active)',function(e){
        e.stopPropagation();
        e.preventDefault();
        var button = $(this);
        var bgestalt = button.attr('data-button-gestalt');
        //var bslot = button.attr('data-slot-id');
        var bdata = button.attr('data-button-data');
        node.lastButton = button;
        button.addClass('active');
        node.trigger('button_click.'+button.attr('data-button-id'),[bgestalt,bdata]);
      });

      node.jdomelem.on('click touchend','.Button.no_cash',function(e){
        e.stopPropagation();
        e.preventDefault();
        node.FXNoCash();
      });

      node.jdomelem.on('click touchend','.Button.no_AP',function(e){
        e.stopPropagation();
        e.preventDefault();
        node.FXNoAP();
      });


      node.jdomelem.on('click touchend','.PopupClose',function(e){
        e.stopPropagation();
        e.preventDefault();
        node.trigger('popup_close');
        node.trigger('popup_cancel');
      });

      node.jdomelem.on('click touchend','.Subpop[data-subpop-id="buyslots"] .BuySlotsInc',function(e){
        e.stopPropagation();
        e.preventDefault();
        var spop = $(this).parents('.Subpop[data-subpop-id="buyslots"]');
        var button = spop.find('.Button[data-button-id="PowerupBuySlotsButton"]');
        var num = parseInt(button.attr('data-button-data'));
        var left = parseInt(spop.find('.BuySlotsNumLeft').text());
        var jprice = spop.find('.SlotCost');
        var price = parseInt(jprice.attr('data-slot-cost'));
        var max_slots = left;
        num = (num+1 > max_slots) ? num : num + 1;
        price = price*num;
        jprice.text(_.toKSNum(price));
        spop.find('.BuySlotsNum').text(num);
        spop.find('.BuySlotsNum').text(num);
        button.attr('data-button-data',num);
      });

      node.jdomelem.on('click touchend','.Subpop[data-subpop-id="buyslots"] .BuySlotsDec',function(e){
        e.stopPropagation();
        e.preventDefault();
        var spop = $(this).parents('.Subpop[data-subpop-id="buyslots"]');
        var button = spop.find('.Button[data-button-id="PowerupBuySlotsButton"]');
        var num = parseInt(button.attr('data-button-data'));
        var jprice = spop.find('.SlotCost');
        var price = parseInt(jprice.attr('data-slot-cost'));
        num = (num-1 < 1) ? 1 : num - 1;
        price = price*num;
        jprice.text(_.toKSNum(price));
        spop.find('.BuySlotsNum').text(num);
        button.attr('data-button-data',num);
      });

      node.jdomelem.on('click touchend','.PopupMenu .PopupMenuButton',function(e){
        e.stopPropagation();
        e.preventDefault();
        var mbutton = $(this);
        node.jdomelem.find('.PopupMenuButton').removeClass('active');
        mbutton.addClass('active');
        if (mbutton.hasClass('TabArrowNew')) {
          mbutton.removeClass('TabArrowNew');
        }
        node.jdomelem.find('.PopupTab').hide();
        node.jdomelem.find('.PopupTab[data-tab="' + mbutton.attr('data-tab') + '"]').show();
        node.jdomelem.find('.PopupText.TabText').hide();
        node.jdomelem.find('.PopupText.TabText[data-tab="' + mbutton.attr('data-tab') + '"]').show();
        node.templateData.lastTab = mbutton.attr('data-tab');
      });

      node.jdomelem.on('click touchend','.Powerup:not(.updating, .locked)',function(e){
        e.stopPropagation();
        e.preventDefault();
        var powerup = $(this);
        var subpopid = powerup.attr('data-subpop-id');
        var slotid = powerup.attr('data-button-data');
        var container = powerup.parents('.PopupTab').find('.SubpopContainer');
        powerup.parents('.PopupTab').addClass('hasPopup');;
        container.addClass('open');
        container.find('.Selector.open').addClass('hasPopup');
        container.find('.Subpop[data-subpop-id='+subpopid+']').addClass('open');
        container.find('.Subpop[data-subpop-id='+subpopid+']').find('.Powerup, .Button').attr('data-button-data',slotid);
      });

      node.jdomelem.on('click touchend','.PopupPerp:not(.locked)',function(e){
        e.stopPropagation();
        e.preventDefault();
        var perp = $(this);
        var subpopid = perp.attr('data-subpop-id');
        var container = perp.parents('.PopupTab').find('.SubpopContainer');
        perp.parents('.PopupTab').addClass('hasPopup');;
        container.addClass('open');
        container.find('.Selector.open').addClass('hasPopup');
        container.find('.Subpop[data-subpop-id='+subpopid+']').addClass('open');
      });

      node.jdomelem.on('click touchend','.PopupToken:not(.locked)',function(e){
        e.stopPropagation();
        e.preventDefault();
        var token = $(this);
        var subpopid = token.attr('data-subpop-id');
        var container = token.parents('.PopupTab').find('.SubpopContainer');
        token.parents('.PopupTab').addClass('hasPopup');
        container.addClass('open');
        container.find('.Subpop[data-subpop-id='+subpopid+']').addClass('open');
      });

      node.jdomelem.on('click touchend','.SubpopClose, .Button[data-button-id=OKButton]',function(e){
        e.stopPropagation();
        e.preventDefault();
        var jelem = $(this);
        jelem.removeClass('active');
        var container = jelem.parents('.PopupTab').find('.SubpopContainer');
        container.find('.Selector.open').removeClass('hasPopup');
        jelem.parents('.PopupTab').removeClass('hasPopup');;
        var subpop = jelem.parents('.Subpop');
        subpop.removeClass('open');
        if (!container.find('.Subpop.open').length) {
          container.removeClass('open');
        }
      });

      node.on('close_powerup',function(e,cb){
        // unused?
        var jelem = node.lastButton;
        jelem.removeClass('active');
        var container = jelem.parents('.PopupTab').find('.SubpopContainer, .Selector');
        jelem.parents('.PopupTab').removeClass('hasPopup');;
        container.removeClass('hasPopup');;
        var subpop = jelem.parents('.Subpop');
        subpop.removeClass('open');
        container.removeClass('open');
        if (cb) { window.setTimeout(cb,400); }
      });

      node.jdomelem.on('click touchend','.Pagination .PopupPageArrowR, .Pagination .PopupPageArrowL',function(e){
        var dir_next = $(this).hasClass('PopupPageArrowR');
        var Pagination = $(this).parent();
        var Pages = Pagination.find('.PopupPage');
        var PageWrap = Pagination.find('.PopupPageWrap');
        var len = Pages.length - 1;
        var next = Pagination.find('.PopupPageArrowR');
        var prev = Pagination.find('.PopupPageArrowL');
        var active = Pages.filter(':not(.hidden)');
        var index = parseInt(active.attr('data-page-id'));
        Pages.addClass('hidden');
        if (dir_next) {
          index = index + 1;
        } else {
          index = index - 1;
        }
        PageWrap.animate({left: -(index*540)},0);
        active = Pages.filter('[data-page-id=' + index +']');
        active.removeClass('hidden');
        if (index === len) {
          next.addClass('hidden');
          prev.removeClass('hidden');
        }
        else if (index <= 0) {
          prev.addClass('hidden');
          next.removeClass('hidden');
        }
        else {
          prev.removeClass('hidden');
          next.removeClass('hidden');
        }
      });

      node.on('mousemove',function(e){
        var userPos= {};
        userPos.x = e.pageX-node.jdomelem.offset().left;
        userPos.y = e.pageY-node.jdomelem.offset().top;
        node.userAbsPos=userPos;
      });

      node.on('mousedown touchstart',function(e){
        var userPos= {};
        userPos.x = e.pageX-node.jdomelem.offset().left;
        userPos.y = e.pageY-node.jdomelem.offset().top;
        node.userClickAbsPos=userPos;
      });

      // FIXME DEBUG example implementation on how to change active popup on state change events
      // on('states') -> all state changes
      // on('states_idle') -> specific [idle] state change.
      node.on('states',function(e,state,value){
        //console.log(state,value);
      });
      node.on('states_idle',function(e,value){
        //console.log('states.idle',value);
      });

    };

    Popup.prototype.render = function(){
      var node = this;
      this.jdomelem.empty();
      var html = app.renderView(this.template, this.templateData);
      this.jdomelem.append(html);
      var mbutton = this.jdomelem.find('.PopupMenuButton[data-tab="'+node.templateData.lastTab+'"]');
      if (node.templateData.lastTab) {
        node.jdomelem.find('.PopupMenuButton').removeClass('active');
        mbutton.addClass('active');
        node.jdomelem.find('.PopupTab').hide();
        node.jdomelem.find('.PopupTab[data-tab="'+mbutton.attr('data-tab')+'"]').show();
        node.jdomelem.find('.PopupText.TabText').hide();
        node.jdomelem.find('.PopupText.TabText[data-tab="' + mbutton.attr('data-tab') + '"]').show();
      }

      if (node.templateData.highlightTabs) {
        _.each(node.templateData.highlightTabs, function(tabid){
          node.jdomelem.find('.PopupMenuButton[data-tab="'+ tabid +'"]').addClass('TabArrowNew');
        });
      }
    };

    Popup.prototype.renderDataTab = function(){
      var node = this;
      var htmlPS = app.renderView('profileset.html', this.templateData);
      var htmlButt = app.renderView('buttons_project.html', this.templateData);
      this.jdomelem.find('.PopupTab.data').empty().append(htmlPS).append(htmlButt);
    };

    Popup.prototype.renderPowerupSelectors = function(pkey){
      if (!pkey) { return; }
      var node = this;
      var pcat = this.templateData.data.powerups_compiled[pkey];
      var html = app.renderView('selector_powerups.html', {
        D: node.templateData.data,
        game_values: node.templateData.game_values,
        pcat : pcat,
        data: node.templateData.data,
        typelower : pcat.typelower,
        pkey : pkey
      });
      var jtab = node.jdomelem.find('.PopupTab.Powerups[data-tab="'+pkey+'"]');
      jtab.find('.Subpop.InSelector').remove();
      jtab.find('.Subpop.Selector').remove();
      jtab.find('.SubpopContainer').append(html);
    };


    Popup.prototype.onAddInit = function(){
      this.height = this.jdomelem.height();
      var pbody = this.jdomelem.find('.PopupBody');
      pbody.css({height:pbody.height()});
      this.offsetY = this.height/2-10;
      this.updateRenderProp();
      if (this.placeBottom) {
        this.y = app.game.renderNode.getSize().height - this.height/2-32;
      } else {
        this.y = app.game.renderNode.getSize().height/2;
      }
      this.x = app.game.renderNode.getSize().width/2;
      this.draw();
    };

    Popup.prototype.draw = function(){
      // Update domelem to current settings
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    Popup.prototype.close = function(cb){
      var popup = this;
      popup.open = false;
      // uncomment below to reset lastTab
      //popup.templateData.lastTab = undefined;
      // Transitionend test
      popup.jdomelem.on('otransitionend MSTransitionEnd transitionend webkitTransitionEnd',function(e){
        popup.remove();
      });
      window.setTimeout(function(){
        // fallback for non transition
        popup.remove();
      },500);
      window.setTimeout(function(){
        // Trigger Callback
        if (cb) { cb() };
      },250);


      if (this.popupContainer) {
        this.popupContainer.renderNode.popupContainerDomelem.removeClass(this.extendClass);
        //if (node.extendClass) { container.removeClass(node.extendClass); }
        //this.popupContainer.renderNode.unlock();
        this.popupContainer.unlock();
      }
      this.off('states');
      popup.jdomelem.addClass('close');
      // Timeout corresponds to CSS transitions
    };


    /////////////////////////////
    // The RenderSprite
    /////////////////////////////

    var RenderSprite = function(config,frame){
      // config.frameSrc - Image source for the spritemap
      // config.frameMap - framemap coordinates and offsets
      // config.frame    - the currently active frame
      if (!config || !config.frameSrc || !config.frameMap) {
        return '';
      }
      var s = {};
      s.frameSrc = config.frameSrc || config.frame_src;
      s.frameMap = config.frameMap || config.frame_map;
      s.frame = frame || config.frame || 'normal';
      s.jdomelem = $("<div class='RenderSprite'></div>");
      if (config.className) {
        s.jdomelem.addClass(config.className);
      }
      if (config.dataButtonId) {
        s.jdomelem.attr('data-button-id',config.dataButtonId);
      }
      s.domelem = s.jdomelem[0];
      s.jdomelem.css({
        'background-image': 'url('+setup.imagePathPrefix+s.frameSrc+')'
      });
      // Switch to a named frame on the spritemap
      var map = s.frameMap[s.frame];
      s.jdomelem.width(map.width);
      s.jdomelem.height(map.height);
      if (map.pivotx && map.pivoty) {
        s.jdomelem.css({
          left:-map.pivotx,
          top:-map.pivoty
        });
      }
      s.domelem.style.backgroundPosition = -map.x+"px "+-map.y+"px";

      //s.html = String($('<div>').append(s.jdomelem.clone()).html());
      //s.html = $('<div>').append(s.jdomelem).html();
      // FIXME: TESTING faster RenderSprite, does this work in any browser?
      s.html = s.jdomelem[0].outerHTML;
      return s.html;
    };


    /////////////////////////////
    // The RenderAmount
    /////////////////////////////

    var RenderAmount = function(amount,frame,upgradeAmount,upgradeAbsAmount) {
      config = {};

      var s = {};
      s.frameSrc = 'MainSprites.png';
      s.frameMap = {
        normal: {x: 267, y: 582, width: 80, height: 16, pivotx: 0, pivoty: -69},
        consumed: {x: 187, y: 582, width: 80, height: 16, pivotx: 0, pivoty: -69}
      };
      s.frame = frame || 'normal';
      s.jdomelem = $("<div class='DecoratorAmount'></div>");
      s.jdomelem2 = $("<div class='DecoratorAmountValue'></div>");
      //s.jdomelem3 = $("<div class='DecoratorAmountNum'></div>");
      s.jdomelem.append(s.jdomelem2);
      if (frame) {
        s.jdomelem.addClass(frame);
      }
      s.domelem = s.jdomelem[0];
      s.jdomelem.css({
        'background-image': 'url('+setup.imagePathPrefix+s.frameSrc+')'
      });
      var map = s.frameMap[s.frame];


      /*
      if (amount < 50) {
        s.jdomelem3.show();
        s.jdomelem3.text(_.toKSNum(amount));
      } else {
        s.jdomelem2.show();
        s.jdomelem3.hide();
      }
      */

      s.jdomelem.width(map.width);
      s.jdomelem.height(map.height);
      s.jdomelem.css({
        left:-map.pivotx,
        top:-map.pivoty
      });
      s.domelem.style.backgroundPosition = -map.x+"px "+-map.y+"px";
      amount = amount || 0;
      s.jdomelem2.width(Math.round((amount/100)*60));
      if (upgradeAmount !== undefined) {
        if (amount > 0) {
          s.jdomelem.addClass('hasUpgrade');
        }

        s.jdomelem4 = $("<div class='DecoratorAmountUpgrade'></div>");
        s.jdomelem4.width(Math.round((upgradeAmount/100)*60));
        s.jdomelem4.css({ left: 9 + Math.round((amount/100)*60) +"px" });
        s.jdomelem.append(s.jdomelem4);

        if (upgradeAmount < 25) {
          s.jdomelem3 = $("<div class='DecoratorAmountNum'></div>");
          s.jdomelem3.text(_.toKSNum(upgradeAbsAmount));
          s.jdomelem.append(s.jdomelem3);
        }

      }

      s.html = String($('<div>').append(s.jdomelem.clone()).html());
      return s.html;
    };


    /////////////////////////////////////////
    //  The Mission Perp
    ////////////////////////////////////////

    var MissionPerp = function(config){
      config = config || {};
      this._id = _instances.length;
      this.position = "relative";
      this.display = "block";
      this.clickable = true;
      this.frameSrc = config.frameSrc;
      this.frameMap = config.frameMap;
      this.frame = config.frame || 'normal';
      this.jdomelem = $("<div class='MissionPerp'></div>");
      this.domelem = this.jdomelem[0];
      this.init(config);
      this.draw();
    };
    extend(MissionPerp, Node);

    MissionPerp.prototype.onAddInit = function(){
      // Init stuff when added to a Parent Node
      var node = this;
      if (this.clickable) {
        this.setClickable(true);
      }
      this.updateRenderProp();
      this.render();
      this.initUI();
    };

    MissionPerp.prototype.setPosition = function(){
      // FIXME: maybe adapt to allow transforms
      return;
    };

    MissionPerp.prototype.setTransform = function() {
      // FIXME: maybe adapt to allow transforms
      return;
    };

    MissionPerp.prototype.template = 'mission.html';

    MissionPerp.prototype.render = function(){
      //this.x = this.parentNode.getSize().width/2;
      this.jdomelem.removeClass("active");
      this.jdomelem.removeClass("complete");
      if (this.gameNode.states.active) {
        this.jdomelem.addClass("active");
      }
      if (this.gameNode.states.complete) {
        this.jdomelem.addClass("complete");
      }
      if (!this.gameNode.states.complete && !this.gameNode.states.active) {
        this.hide();
      } else {
        this.show();
      }
      this.jdomelem.empty();
      var html = app.renderView(this.template, this);
      this.jdomelem.append(html);
      this.draw();
    };

    MissionPerp.prototype.draw = function(){
      // Update domelem to current settings
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    MissionPerp.prototype.tick = function(){
      this.render();
    }

    MissionPerp.prototype.initUI = function(){
      var node = this;
      node.on('vclick',function(e){
        e.stopPropagation();
      });
      node.on('states',function(e,state,value){
        e.stopPropagation();
        node.render();
      });
      node.on('states_active',function(e,state,value){
        e.stopPropagation();
      });

    };

    /////////////////////////////////////////
    //  The Topscore Perp
    ////////////////////////////////////////

    var TopscorePerp = function(config){
      config = config || {};
      this._id = _instances.length;
      this.position = "relative";
      this.hidden = true;
      this.clickable = true;
      this.frameSrc = config.frameSrc;
      this.frameMap = config.frameMap;
      this.frame = config.frame || 'normal';
      this.jdomelem = $("<div class='TopscorePerp'></div>");
      this.domelem = this.jdomelem[0];
      this.init(config);
      this.draw();
    };
    extend(TopscorePerp, Node);

    TopscorePerp.prototype.onAddInit = function(){
      // Init stuff when added to a Parent Node
      var node = this;
      if (this.clickable) {
        this.setClickable(true);
      }
      this.updateRenderProp();
      this.render();
      this.initUI();
    };

    TopscorePerp.prototype.setPosition = function(){
      // FIXME: maybe adapt to allow transforms
      return;
    };

    TopscorePerp.prototype.setTransform = function() {
      // FIXME: maybe adapt to allow transforms
      return;
    };

    TopscorePerp.prototype.template = 'topscore.html';

    TopscorePerp.prototype.render = function(){
      //this.x = this.parentNode.getSize().width/2;
      this.jdomelem.empty();
      var html = app.renderView(this.template, this);
      this.jdomelem.append(html);
      this.draw();
    };

    TopscorePerp.prototype.draw = function(){
      // Update domelem to current settings
      if (this.hidden) {
        this.hide();
      }
      this.setSize(this.getSize());
      this.setTransform(this.getTransform());
      this.setPosition(this.getPosition());
      this.setOpacity(this.opacity);
    };

    TopscorePerp.prototype.tick = function(){
      this.render();
    }

    TopscorePerp.prototype.initUI = function(){
      var node = this;
      node.on('vclick',function(e){
        e.stopPropagation();
        node.parentNode.jdomelem.find('.TopscorePerp').removeClass('active');
        //node.jdomelem.addClass('active');
      });
      node.on('states',function(e,state,value){
        e.stopPropagation();
        node.render();
      });
      node.on('states_active',function(e,state,value){
        e.stopPropagation();
      });
    };
    
    TopscorePerp.prototype.renderRank = function(){
      var rank = this.jdomelem.find('.TopscoreRank');
      rank.empty();
      var html = app.renderView('topscore_rank.html', { data:this.gameNode.data, parentdata:this.gameNode.parentNode.data, type:this.gameNode.scoretype });
      rank.append(html);
    };

    TopscorePerp.prototype.renderList = function(){
      var list = this.jdomelem.find('.TopscoreList');
      list.empty();
      var html = app.renderView('topscore_list.html', { data:this.gameNode.data, parentdata:this.gameNode.parentNode.data, type:this.gameNode.scoretype });
      list.append(html);
    };


    ////////////////////////////
    // Underscore Mix-ins
    ////////////////////////////

    _.mixin({
      RenderAmount: RenderAmount,
      RenderSprite: RenderSprite
    });


    ////////////////////////////
    // The API Publisher
    ////////////////////////////

    return {
      _instances: _instances,
      _ids: _ids,
      //_sets: _sets,
      get: get,
      getById: getById,
      clear: clear,
      DragHandler: DragHandler,
      Set: Set,
      Node: Node,
      Circle: Circle,
      Text: Text,
      Sprite: Sprite,
      Perp: Perp,
      PerpSprite: PerpSprite,
      PerpCable: PerpCable,
      Decorator: Decorator,
      DecoratorReady: DecoratorReady,
      DecoratorAmount: DecoratorAmount,
      DecoratorLabel: DecoratorLabel,
      DecoratorTimer: DecoratorTimer,
      DecoratorGear: DecoratorGear,
      DecoratorNew: DecoratorNew,
      Cable: Cable,
      MissionPerp: MissionPerp,
      TopscorePerp: TopscorePerp,
      ViewTab: ViewTab,
      ViewMap: ViewMap,
      MainMenu: MainMenu,
      ButtonInline: ButtonInline,
      Stage: Stage,
      Popup: Popup,
      SlowTicker: SlowTicker,
      Statusbar: Statusbar,
      DBQueue: DBQueue
    };
  }

  var render; // We store our singleton instance here.

  return {
    getRender: function() {
      render = render || Render();
      return render;
    }
  };

});
