let utils = {
  isString:   expr => typeof expr === 'string',
  isNumber:   expr => typeof expr === 'number',
  isBool:     expr => typeof expr === 'boolean',
  isArray:    expr => expr instanceof Array,
  isObject:   expr => expr instanceof Object,
  isFunction: expr => expr instanceof Function,
  isJSON:     expr => {
    if (utils.isString(expr) || utils.isNumber(expr) || utils.isBool(expr) || expr === null) {
      return true;
    }

    if (utils.isArray(expr)) {
      return expr.every(v => utils.isJSON(v));
    }

    let result = true;
    if (utils.isobject(expr)) {
      for (let key of Object.keys(expr)) {
        if (expr.hasOwnProperty(key)) {
          result = result && utils.isJSON(expr[key]);
          if (!result) {
            break;
          }
        }
      }
      return result;
    }
    return false;
  },
};

module.exports = utils;
