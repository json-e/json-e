let interpreter = require('./interpreter');
let _ = require('lodash');
let fromNow = require('./from-now');

let safeEval = (src, context) => interpreter.parse(src, context);

module.exports = function(_template, _context) {

  let PARSEEXPR = /\${(\s*([\w\W]+)+\s*)}/;
  let DATEEXPR = /([0-9]+ *d(ays?)?)? *([0-9]+ *h(ours?)?)? *([0-9]+ *m(in(utes?)?)?)?/;

  let template = _.clone(_template);
  let context = _.clone(_context);

  /* private */
  function _attachArrayAccessor(context) {
    for (let key of Object.keys(context)) {
      if (context.hasOwnProperty(key)) {
        let value = context[key];
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
    for (let key of Object.keys(template)) {
      if (template.hasOwnProperty(key)) {
        let value = template[key];
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
    if (template[key].hasOwnProperty('$if')) {
      _handleIf(template, key);
    } else if (template[key].hasOwnProperty('$switch')) {
      _handleSwitch(template, key);
    } else if (template[key].hasOwnProperty('$eval')) {
      _handleEval(template, key);
    } else if (template[key].hasOwnProperty('$fromNow')) {
      _handleFromNow(template, key);
    } else {
      _render(template[key]);
    }
  }

  function _handleIf(template, key) {
    let condition = template[key]['$if'];
    let hold = undefined;
    if (typeof condition === 'string' || condition instanceof String) {
      hold = safeEval(condition, context);
    } else {

      let err = new Error('invalid construct');
      err.message = '$if construct must be a string which eval can process';
      throw err;
    }

    if (hold) {
      let hence = template[key]['$then'];
      if (typeof hence === 'string' || hence instanceof String) {
        template[key] = _replace(hence);
      } else if (hence.hasOwnProperty('$eval')) {
        let dummy = {dummy: template[key]['$then']};
        _render(dummy);
        template[key] = dummy['dummy']; 
      } else {
        _render(hence);
        template[key] = hence;
      }
    } else {
      let hence = template[key]['$else'];
      if (typeof hence === 'string' || hence instanceof String) {
        template[key] = _replace(hence);
      } else if (hence.hasOwnProperty('$eval')) {
        let dummy = {dummy: template[key]['$else']};
        _render(dummy);
        template[key] = dummy['dummy']; 
      } else {
        _render(hence);
        template[key] = hence;
      }
    }
  }

  function _handleSwitch(template, key) {
    let condition = template[key]['$switch'];
    let case_option;
    if (typeof condition === 'string' || condition instanceof String) {
      case_option = safeEval(condition, context);
    } else {
      let err = new Error('invalid construct');
      err.message = '$switch construct must be a string which eval can process';
      throw err;
    }
    let case_option_value = template[key][case_option];
    if (typeof case_option_value === 'string' || case_option_value instanceof String) {
      template[key] = _replace(case_option_value);
    } else if (case_option_value.hasOwnProperty('$eval')) {
      let dummy = {dummy: case_option_value};
      _render(dummy);
      template[key] = dummy['dummy']; 
    } else {
      _render(case_option_value);
      template[key] = case_option_value;
    }
  }

  function _handleEval(template, key) {
    let expression = template[key]['$eval'];
    if (typeof expression === 'string' || expression instanceof String) {
      template[key] = safeEval(expression, context);
    } else {
      let err = new Error('invalid construct value');
      err.message = '$eval construct must be a string which eval can process';
      throw err;
    }
  }

  function _handleFromNow(template, key) {
    let expression = template[key]['$fromNow'];
    if (typeof expression === 'string' || expression instanceof String) {
      template[key] = fromNow(expression);
    } else {
      let err = new Error('invalid construct value');
      err.message = '$fromNow value must be a string which eval can process';
      throw err;
    }
  }

  /* private */
  function _replace(parameterizedString) {
    let match = undefined;
    if (match = PARSEEXPR.exec(parameterizedString)) {
      let replacementValue = safeEval(match[1].trim(), context);
      return parameterizedString.replace(PARSEEXPR, replacementValue);
    }
    return parameterizedString;
  }

  _attachArrayAccessor(context);
  _render(template);
  return template;
};
