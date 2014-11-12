// This file is loaded after the library dependencies are met and before the core modules are loaded. It defines general settings used in various parts and modules of the application.

define(function(require) {

  var _ = require('underscore');

  var setup = {
    // The domain this app is running at.
    domain: 'datadealer.com',
  };

  // To override setup values the file `setup_local.js` can be used. To prevent 404 errors and the use of try/catch it must exist in any case, even if no settings are overridden.
  setup = _.extend(setup, require('setup_local'));

  // The base URL.
  setup.baseUrl = '//' + setup.domain;

  // Store domain and base URL in variables, we need them a lot below.
  var domain = setup.domain;
  var baseUrl = setup.baseUrl;

  setup = _.extend({
    // Set this to true to import modules into the global scope.
    debug: false,
    // Set this to a positive integer to simulate network latency (in milliseconds).
    latency: 0,

    // JSON-RPC URLs.
    jsonRpcUrl: baseUrl + '/app/api/',
    jsonRpcAuthUrl: baseUrl + '/authapi/',

    // Django authentication URLs.
    signUpUrl: baseUrl + '/accounts/remote/sign_up/',
    signInUrl: baseUrl + '/accounts/remote/sign_in/',
    signOutUrl: baseUrl + '/accounts/remote/sign_out/',
    setLangUrl: baseUrl + '/accounts/lang/',
    accessDeniedUrl: baseUrl + '/accounts/remote/access_denied/',
    resetPasswordUrl: baseUrl + '/accounts/remote/reset/',
    resetPasswordFromKeyUrl: baseUrl + '/accounts/remote/reset/key/',
    setEmailUrl: baseUrl + '/accounts/remote/set_email',

    // h2. Websocket settings
    wsUrl: 'https://' + domain + '/__sockjs__',
    // Set this to true to get websocket debugging messages in the console.
    wsDebug: false,
    // Set this to true to enable websocket development mode.
    wsMode: false,
    // The list of enabled websocket protocols.
    //wsProtocolsWhitelist: ['websocket', 'xdr-streaming', 'xhr-streaming', 'iframe-eventsource', 'iframe-htmlfile', 'xdr-polling', 'xhr-polling', 'iframe-xhr-polling', 'jsonp-polling'],

    // ### Game and render engine settings
    // The character separating items in path definitions like `Imperium.1234567890.9876543210`.
    pathSeparator: '.',
    // The character separating items in type definitions like `ProjectPerp:project001`.
    typeSeparator: ':',
    // The URL path prefix for accessing the images directory.
    imagePathPrefix: '/img/',
    // The DOM container the game is rendered into.
    renderContainer:'#GameContainer',
    // Set to true to enable 3D parallax scrolling of the game board.
    viewMapPerspective: false,
    // The amount of pixels the game board can be dragged further than its actual size.
    viewMapStopZone: 0,

    // ### RpcQueue settings
    // The maximum numbers of elements in the queue before a forecd queue update/flush is triggered.
    updateQueueMaxSize: 3,
    // The queue update interval in milliseconds.
    updateQueueInterval: 5000
  }, setup);

  return setup;
});
