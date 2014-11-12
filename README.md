# dd_js #

Application serving the frontend API for [Data Dealer](http://datadealer.com)

## Requirements ##

- [NodeJS](http://nodejs.org)
- [npm](http://npmjs.org), the NodeJS Package Manager

## Setup ##

Install dependencies:

    $ npm install
    $ ./node_modules/.bin/bower install

Bower will not work with Node.js <=0.6.x; please install the latest Node version.

You also need the file `setup_local.js` (gitignored) which you can override the settings in `setup.js` for your local tuning with, e.g.:

    define(function() {
      return {
        debug: true,
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

_Caveat:_ If `setup_local.js` does not exist, there will be a 404 error (file not found) thrown in the development environment.

_Developers:_ dd_js can also be run uncompiled in debug mode. Point your web server to `dd_js` root instead of `dd_js/dist/`. This makes it easier to 'test' changes without the need to recompile each time you want to try something out. You should run grunt at least once to match dependencies though. Also `sockjs-0.3.4.min.js` needs to be available in the dd_js root folder. You can get it here:

    $ wget https://raw.githubusercontent.com/sockjs/sockjs-client/8deeba5a7f3fe30d95a4068a8435cd7dd30f1d33/dist/sockjs-0.3.4.min.js

## Building ##

Build with default target into `dist` directory:

    $ ./node_modules/.bin/grunt

## Linting ##

Syntax and other checks of JavaScript code:

    $ ./node_modules/.bin/grunt lint

## i18N ##

_Prerequisites_: gettext package (xgettext, msgmerge et al.) must be available in the environment.

    $ ./node_modules/.bin/grunt messages

Edit `.po` files, then grunt again.

    $ ./node_modules/.bin/grunt

## Integration with dd_auth ##

Authentication features (sign in/out, password reset, account provider connections etc.) are implemented in dd_auth and embedded in dd_js via `$.get` and `$.post` methods, ie. exchanging data in the background via simple XHR calls.

Thus, dd_auth takes full responsibility about form validation errors, dd_js only displays the resulting HTML, though nicely displaying it as coherent content parts in its document object model.

Several client-side routes (aka hash URLs) are currently configured e.g.:

- #sign_up
- #sign_in
- #reset_password (w/o key verification)
- #sign_out

E.g. the `#sign_in` route (defined in bootstrap.js) causes dd_auth’s customized view `/account/remote/sign_in` to be called and inserts the rendered result in the DOM.

The corresponding template in `dd_auth` is already configured for client-side hash URLs (e.g. pointing to `#reset_password` instead of `/account/remote/reset`) while form submit is interfered by a document handler also defined in bootstrap.js and forwarded as XHR POST request to dd\_auth accordingly.

CSS styles for HTML retrieved from dd_auth reside in `css/dd_auth.css` and can be easily added and adapted there. For in-depth modifications of the general display please refer to the files in the `dd_auth/templates` directory.

## Sprites and dd_rules ##

Sprite-files e.g. `sprite-001.png`, `sprite-002.png`, for characters and other game elements are located in `dd_js/img/`. Those sprites are a product of a currently unpublished `dd_cms` export routine. The sprite-sheet coordinates for those elements can be found in the `dd_rules` repo.

## Points of interest ##

#### `dd_js/scripts/app.js` 

- Low level API
- Registering templates
- Registering backend calls
- Template rendering

#### `dd_js/scripts/bootstrap.js`

- Integrates dd_auth workflow
- Asset loading
- dd_app token validation

#### `dd_js/scripts/Game.js`

- Game controller
- Game logic and workflows
- Tree-like node structure of controller nodes
- Invokes rendering
- Event handling on the controller side

#### `dd_js/scripts/Render.js`

- Hybrid HTML/Canvas render engine
- DOM/HTML manipulation via jQuery/VanillaJS
- Transitions/FX with EaselJS/TweenJS
- Event handling on the UI side, feeding back events to Game-Controller
- In-game-popups and templates

## Copyright

Copyright (c) 2011-2014, Cuteacute Media OG
If not stated otherwise, `dd_js` is released under the Artistic License 2.0. See `LICENSE.txt`.

`dd_js/img/` and `dd_js/i18n/` are released under [Creative Commons Attribution-ShareAlike 3.0, Österreich (CC-BY-SA 3.0)](http://creativecommons.org/licenses/by-sa/3.0/at/)
Ivan Averintsev, Wolfie Christl, Pascale Osterwalder, Ralf Traunsteiner

`dd_js/fonts/` includes third party fonts:
- `Bowlby One SC` Copyright (c) 2011 by vernon adams (vern@newtypography.co.uk)
- `Skranji` Copyright (c) 2012, Font Diner (www.fontdiner.com), with Reserved Font Name "Skranji".
- `Source` Copyright 2010, 2012 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name 'Source'. All Rights Reserved. Source is a trademark of Adobe Systems Incorporated in the United States and/or other countries.
- `Voltaire` Copyright (c) 2011 by Sorkin Type Co (www.sorkintype.com) 

These Fonts are licensed under the SIL Open Font License. See `fonts/LICENSE/` for details.
