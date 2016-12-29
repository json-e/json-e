var safeEval = require('notevil');
var _ = require('lodash');

class Parameterize {
  
  constructor(template, context) {
    this.template = _.clone(template);
    this.context = context;
  }

  /* private */
  _attachArrayAccessor(context) {
    for (var key of Object.keys(context)) {
      if (context.hasOwnProperty(key)) {
        var value = context[key];
        if (value instanceof Array) {
          context['$' + key] = this._generateArrayAccessorFunc(value);
        } 
        if (value instanceof Array || value instanceof Object) {
          this._attachArrayAccessor(value);
        }
      }
    }
  }

  /* private */
  _generateArrayAccessorFunc(context) {
    return function(index) {
      return context[index];
    };
  }

  /* public */
  render() {
    this._attachArrayAccessor(this.context);
    this._render(this.template);
  }

  /* private */
  _render(template) {
    for (var key of Object.keys(template)) {
      if (template.hasOwnProperty(key)) {
        var value = template[key];
        if (typeof value === 'string' || value instanceof String) {
          template[key] = this._replace(template[key]);
        } else {
          this._handleConstructs(template, key);
        }
      }
    }
  }

  /* private */
  _handleConstructs(template, key) {
    if (template[key]['$if']) {
      var condition = template[key]['$if'];
      var hold = undefined;
      if (typeof condition === 'string' || condition instanceof String) {
        //hold = safeEval(condition, this.context);
        hold = this._replace(condition);
      } else {

        var err = new Error('invalid construct');
        err.message = '$if construct must be a string which eval can process';
        throw err;
      }

      if (hold) {
        var hence = template[key]['$then'];
        if (typeof hence === 'string' || hence instanceof String) {
          template[key] = this._replace(hence);
        } else {
          this._render(hence);
          template[key] = hence;
        }
      } else {
        var hence = template[key]['$else'];
        if (typeof hence === 'string' || hence instanceof String) {
          template[key] = this._replace(hence);
        } else {
          this._render(hence);
          template[key] = hence;
        }
      }
    } else if (template[key]['$switch']) {
      var condition = this._replace(template[key]['$switch']);
      var case_option;
      if (typeof condition === 'string' || condition instanceof String) {
        case_option = this._replace(condition);
      } else {
        var err = new Error('invalid construct');
        err.message = '$switch construct must be a string which eval can process';
        throw err;
      }
      var case_option_value = template[key][case_option];
      if (typeof case_option_value === 'string' || case_option_value instanceof String) {
        template[key] = this._replace(case_option_value);
      } else {
        this._render(case_option_value);
        template[key] = case_option_value;
      }
    } else if (template[key]['$eval']) {
      var expression = template[key]['$eval'];
      if (typeof expression === 'string' || expression instanceof String) {
        template[key] = this._replace(expression);
      } else {
        var err = new Error('invalid constructoruct');
        err.message = '$eval construct must be a string which eval can process';
        throw err;
      }
    } else {
      this._render(template[key]);
    }
  }

  /* private */
  _replace(parameterizedString) {
    var match = undefined;
    if (match = this.PARSEEXPR.exec(parameterizedString)) {
      var replacementValue = safeEval(match[1].trim(), this.context);
      return parameterizedString.replace(this.PARSEEXPR, replacementValue);
    } else if (match = this.EXPR.exec(parameterizedString)) {
      var result = safeEval(match[1].trim(), this.context);
      return result;  
    }
    return parameterizedString;
  }

  /* private */
  _fetchContextPropertyValue(propertyString) {
    var propertyString = propertyString.trim();
    var keys = propertyString.split('.');
    var result = this.context;

    for (var key of keys) {
      result = result[key];
    }

    return result;
  }

  /* public */
  getTemplate() {
    return this.template;
  }

  /* public */
  getContext() {
    return this.context;
  }

  /* public */
  setNewTemplate(template) {
    this.template = _.clone(template);
  }

  /* public */
  setNewContext(context) {
    this.context = context;
  }
};

//Parameterize.prototype.PARSEEXPR = /{{(\s*([\d\w]+\b.?\b)+\s*)}}/;
Parameterize.prototype.PARSEEXPR = /{{(\s*([\w\W]+)+\s*)}}/;
Parameterize.prototype.EXPR = /\${(\s*([\w\W]+)+\s*)}/;

module.exports = Parameterize;
