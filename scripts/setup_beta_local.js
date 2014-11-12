// beta.datadealer.com production local settings
// to build, copy these to setup_local.js

define(function() {
  return {
    debug: false,
    userdebug: true,
    domain: 'beta.datadealer.com',
    baseUrl: 'https://beta.datadealer.com',
    ioPort: '443',
    jsonRpcUrl: '/app/api/',
    jsonRpcAuthUrl: '/authapi/',
    imageUrl: '/img/',
    jsonRpcUrl: '/app/api/',
    jsonRpcAuthUrl: '/authapi/',
    signUpUrl: '/accounts/remote/sign_up/',
    signInUrl: '/accounts/remote/sign_in/',
    signOutUrl: '/accounts/remote/sign_out/',
    setLangUrl: '/accounts/lang/',
    resetPasswordUrl: '/accounts/remote/reset/',
    resetPasswordFromKeyUrl: '/accounts/remote/reset/key/',
    accessDeniedUrl: '/accounts/remote/access_denied/',
    setEmailUrl: '/accounts/remote/set_email',
    wsUrl: 'https://sock-b0.datadealer.com/__sockjs__',
    wsProtocolsWhitelist: ['websocket', 'iframe-eventsource', 'iframe-htmlfile', 'xdr-polling', 'xhr-polling', 'iframe-xhr-polling', 'jsonp-polling'],
    locale: 'de_AT',
    updateQueueMaxSize: 10,
    updateQueueInterval: 5000,
  };
});
