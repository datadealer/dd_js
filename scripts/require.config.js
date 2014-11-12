// Define paths to and shims for components.
require.config({
  config: {
    'tpl': {
      variable: 'D'
    }
  },
  //enforceDefine: true,
  paths: {
    baseUrl: '.',
    'createjs-easel': '../components/EaselJS/lib/easeljs-0.6.1.min',
    'createjs-preload': '../components/PreloadJS/lib/preloadjs-0.3.1.min',
    'createjs-tween': '../components/TweenJS/lib/tweenjs-0.4.1.min',
    'createjs-sound': '../components/SoundJS/lib/soundjs-0.4.1.min',
    jquery: '../components/jquery/jquery',
    'jquery-jsonrpc': '../components/jquery-jsonrpcjs/index',
    'jquery-message-queuing': '../components/jquery-message-queuing/index',
    'jquery-migrate': '../components/jquery-migrate/jquery-migrate',
    'jquery-mobile': '../components/jquery-mobile/index',
    json2: '../components/json2/index',
    'native-console': '../components/native-console/native-console',
    numeral: '../components/numeral/numeral',
    'numeral-de': '../components/numeral/languages/de-de',
    preload: '../components/PreloadJS/lib/preloadjs-0.3.1.min',
    routie: '../components/routie/lib/routie',
    sockjs: '../components/sockjs/sockjs',
    sprintf: '../components/sprintf/index',
    text: '../components/requirejs-text/text',
    tpl: '../components/requirejs-tpl-dawsontoth/index',
    underscore: '../components/underscore/underscore',
    'zynga-animate': '../components/zynga-animate/index',
    'zynga-scroller': '../components/zynga-scroller/index'
  },
  shim: {
    'createjs-easel': {
      exports: 'createjs'
    },
    'createjs-preload': {
      exports: 'createjs'
    },
    'createjs-sound': {
      exports: 'createjs'
    },
    'createjs-tween': {
      deps: ['createjs-easel'],
      exports: 'createjs.Tween'
    },
    'jquery-jsonrpc': {
      deps: ['jquery'],
      exports: 'jQuery.jsonRPC'
    },
    'jquery-message-queuing': {
      deps: ['jquery'],
      exports: 'jQuery.jqmq'
    },
    'jquery-migrate': ['jquery'],
    'jquery-mobile': ['jquery'],
    'json2': {
      exports: 'JSON'
    },
    'native-console': {
      exports: 'console'
    },
    'numeral-de': {
      deps: ['numeral']
    },
    preload: {
      exports: 'createjs.LoadQueue'
    },
    'routie': {
      exports: 'routie'
    },
    'sockjs': {
      exports: 'SockJS'
    },
    'sprintf': {
      exports: 'sprintf'
    },
    'zynga-animate': {
      exports: 'core'
    },
    'zynga-scroller': {
      deps: ['zynga-animate'],
      exports: 'Scroller',
      init: function() {
        /*global Scroller*/
        return Scroller;
      }
    },
    underscore: {
      exports: '_'
    }
  }
});
