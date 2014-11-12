/*global Game:true, Render:true*/

requires('Game', 'Render');

//////////////////////
// The Tests
//////////////////////

var DDGame;

var RenderJSON = function(jsonurl){
  var jqxhr = $.getJSON(jsonurl,function(data){
    DDGame = Game.init(data);
  });
  jqxhr.error(function(data){
  })
  .done(function(data){
  });
};

var RenderTest = function(){
  var node = new Render.Node();
  node.setPosition({x:960,y:600});
  node.getPosition();
  node.tick();
  node.draw();
  node.hide();
  node.show();
  Render.get(node._id);

  var stage = new Render.Stage();
  $('body').append(stage.domelem);

  var viewmap = new Render.ViewMap();
  stage.addChild(viewmap);
  
  viewmap.addChild(node);

  var sprite = new Render.Sprite();
  sprite.setPosition({x:111,y:111});
  viewmap.addChild(sprite);

  var sprite2 = new Render.Sprite({
    x:520,
    y:450,
    frameMap: {
      normal: { "x": 101, "y": 301, "width": 100, "height": 100, "pivotx": 50, "pivoty": 50 }
    }
  });
  viewmap.addChild(sprite2);

  var spark = new Render.Sprite({
    x:520,
    y:450,
    frameMap: {
      normal: { "x": 0, "y": 900, "width": 50, "height": 50, "pivotx": 25, "pivoty": 25 }
    }
  });
  viewmap.addChild(spark);

  var cable = new Render.Cable({
    pointFrom: sprite.getPosition(),
    pointTo: sprite2.getPosition()
  });
  viewmap.addChild(cable);
  
  var db = new Render.Perp({
    x:500,
    y:500,
    //sticky:true,
    frameMap: {
      normal: { "x": 351, "y": 309, "width": 145, "height": 184, "pivotx": 70, "pivoty": 87 },
      hover:  { "x": 496, "y": 301, "width": 156, "height": 195, "pivotx": 78, "pivoty": 95 },
      drag:   { "x": 652, "y": 309, "width": 146, "height": 193, "pivotx": 72, "pivoty": 94 },
      active: { "x": 206, "y": 309, "width": 145, "height": 184, "pivotx": 70, "pivoty": 87 }
    }
  });
  viewmap.addChild(db);

  var perp = new Render.Perp({
    x:50,
    y:333,
    frameSrc:"img/sprites_100x100.png",
    frameMap: {
      normal: { "x": 884, "y": 1, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 },
      hover:  { "x": 966, "y": 1, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 },
      drag:   { "x": 1050, "y": 1, "width": 82, "height": 85, "pivotx": 44, "pivoty": 46 },
      active: { "x": 802, "y": 1, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 }
    }
  });
  viewmap.addChild(perp);

  var perp2 = new Render.Perp({
    x:333,
    y:100,
    sticky:true
  });
  viewmap.addChild(perp2);
  perp2.addChild(new Render.PerpSprite());
  perp2.addDecorator(new Render.DecoratorLabel({text:'Perp2',textAlign:'center'}));

  db.cableTo(perp2);

  var perp3 = new Render.Perp({
    x:555,
    y:200,
    frameMap: {
      normal: { "x": 884, "y": 1, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 },
      hover:  { "x": 966, "y": 1, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 },
      drag:   { "x": 1050, "y": 1, "width": 82, "height": 85, "pivotx": 44, "pivoty": 46 },
      active: { "x": 802, "y": 1, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 }
    }
  });
  viewmap.addChild(perp3);
  perp3.addChild(new Render.PerpSprite({
    frameMap: {
      normal: { "x": 801, "y": 101, "width": 82, "height": 82, "pivotx": 41, "pivoty": 41 }
    }
  }));
  perp3.addDecorator(new Render.DecoratorLabel({text:'Perp3',textAlign:'center'}));

  perp2.cableTo(perp);
  perp2.cableTo(perp3,{cableMaxLength:400});



  $(stage.domelem).css({'background':"#030"});
  //$(viewmap.domelem).css({'background':"#0c0"});
  $(node.domelem).css({'background':"#0F0"});

  return { 
    node:node,
    sprite:sprite,
    perp:perp,
    viewmap:viewmap,
    stage:stage
  };
};
