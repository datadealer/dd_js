define(function(require) {
  var _ = require('underscore');
  var $ = require('jquery');
  var setup = require('setup');

  var locale = 'en_US'; // Default

  var i18n = {
    getLocale: function() {
      return locale;
    },
    setLocale: function(l) {
      locale = l || locale;
      setup.locale = locale;
      setup.localeShort = locale.substr(0,2);
      return this;
    }
  };

  _.each(['de_AT', 'en_US'], function(locale, index) {
    $.getJSON('i18n/' + locale + '.json').then(function(data) {
      i18n[locale] = data[locale];
    });
  });

  i18n.gettext = function(msgid) {
    var language = i18n[locale];
    if (language) {
      var message = language[msgid];
      if (message && message.length > 0) {
        return message[1];
      }
      console.warn('No %s translation available for msgid "%s"', locale, msgid);
    } else {
      console.warn('No language file available for locale %s (msgid "%s")', locale, msgid);
    }
    return msgid;
  };

  i18n.ngettext = function(msgid, msgidPlural, amount) {
    var language = i18n[locale];
    if (language) {
      var message = language[msgid];
      if (message && message.length > 0) {
        var text = amount === 1 ? message[1] : message[2];
        return _.sprintf(text, _.toKSNum(amount));
      }
      console.warn('No %s translation available for msgid "%s"', locale, msgid);
    } else {
      console.warn('No language file available for locale %s (msgid "%s")', locale, msgid);
    }
    return _.sprintf(amount === 1 ? msgid : msgidPlural, _.toKSNum(amount));
  };

  return i18n;
});
