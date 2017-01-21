var safeEval = require('notevil');
var _ = require('lodash');

module.exports = function(_template, _context) {

  //var PARSEEXPR = /{{(\s*([\w\W]+)+\s*)}}/;
  //var EXPR = /\${(\s*([\w\W]+)+\s*)}/;

  var PARSEEXPR = /\${(\s*([\w\W]+)+\s*)}/;

  var template = _.clone(_template);
  var context = _.clone(_context);

  /* private */
  function _attachArrayAccessor(context) {
    for (var key of Object.keys(context)) {
      if (context.hasOwnProperty(key)) {
        var value = context[key];
        if (value instanceof Array) {
          context['$' + key] = _generateArrayAccessorFunc(value);
        } 
        if (value instanceof Array || value instanceof Object) {
          _attachArrayAccessor(value);
        }
      }
    }
  }

  /* private */
  function _generateArrayAccessorFunc(context) {
    return function(index) {
      return context[index];
    };
  }

  /* private */
  function  _render(template) {
    for (var key of Object.keys(template)) {
      if (template.hasOwnProperty(key)) {
        var value = template[key];
        if (typeof value === 'string' || value instanceof String) {
          template[key] = _replace(template[key]);
        } else {
          _handleConstructs(template, key);
        }
      }
    }
  }

  /* private */
  function _handleConstructs(template, key) {
    if (template[key]['$if']) {
      _handleIf(template, key);
    } else if (template[key]['$switch']) {
      _handleSwitch(template, key);
    } else if (template[key]['$eval']) {
      _handleEval(template, key);
    } else {
      _render(template[key]);
    }
  }

  function _handleIf(template, key) {
    var condition = template[key]['$if'];
    var hold = undefined;
    if (typeof condition === 'string' || condition instanceof String) {
      hold = safeEval(condition, context);
    } else {

      var err = new Error('invalid construct');
      err.message = '$if construct must be a string which eval can process';
      throw err;
    }

    if (hold) {
      var hence = template[key]['$then'];
      if (typeof hence === 'string' || hence instanceof String) {
        template[key] = _replace(hence);
      } else if (hence.hasOwnProperty('$eval')) {
        var dummy = {dummy: template[key]['$then']};
        _render(dummy);
        template[key] = dummy['dummy']; 
      } else {
        _render(hence);
        template[key] = hence;
      }
    } else {
      var hence = template[key]['$else'];
      if (typeof hence === 'string' || hence instanceof String) {
        template[key] = _replace(hence);
      } else if (hence.hasOwnProperty('$eval')) {
        var dummy = {dummy: template[key]['$else']};
        _render(dummy);
        template[key] = dummy['dummy']; 
      } else {
        _render(hence);
        template[key] = hence;
      }
    }
  }

  function _handleSwitch(template, key) {
    var condition = template[key]['$switch'];
    var case_option;
    if (typeof condition === 'string' || condition instanceof String) {
      case_option = safeEval(condition, context);
    } else {
      var err = new Error('invalid construct');
      err.message = '$switch construct must be a string which eval can process';
      throw err;
    }
    var case_option_value = template[key][case_option];
    if (typeof case_option_value === 'string' || case_option_value instanceof String) {
      template[key] = _replace(case_option_value);
    } else if (case_option_value.hasOwnProperty('$eval')) {
      var dummy = {dummy: case_option_value};
      _render(dummy);
      template[key] = dummy['dummy']; 
    } else {
      _render(case_option_value);
      template[key] = case_option_value;
    }
  }

  function _handleEval(template, key) {
    var expression = template[key]['$eval'];
    if (typeof expression === 'string' || expression instanceof String) {
      template[key] = safeEval(expression, context);
    } else {
      var err = new Error('invalid constructoruct');
      err.message = '$eval construct must be a string which eval can process';
      throw err;
    }
  }

  /* private */
  function _replace(parameterizedString) {
    var match = undefined;
    if (match = PARSEEXPR.exec(parameterizedString)) {
      var replacementValue = safeEval(match[1].trim(), context);
      return parameterizedString.replace(PARSEEXPR, replacementValue);
    }
    return parameterizedString;
  }

  _attachArrayAccessor(context);
  _render(template);
  return template;
};
