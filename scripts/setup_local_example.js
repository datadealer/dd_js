// datadealer development minimal local settings example
// to build, change port, paths etc.
// for a full example take a look at setup_local_beta.js

define(function() {
  return {
    debug: true,
    userdebug: true,
    ioPort: 8082,
    latency: 0,
    ioSecure: false,
    wsUrl: 'http://datadealer:8082/__sockjs__',
    domain: 'datadealer',
    baseUrl: 'http://datadealer'
  };
});
