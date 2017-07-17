let utils = {
  isString:   expr => typeof expr === 'string',
  isNumber:   expr => typeof expr === 'number',
  isInteger:  expr => typeof expr === 'number' && Number.isInteger(expr),
  isBool:     expr => typeof expr === 'boolean',
  isNull:     expr => expr === null,
  isArray:    expr => expr instanceof Array,
  isObject:   expr => expr instanceof Object && !(expr instanceof Array) && !(expr instanceof Function),
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
  isTruthy: expr => {
    return expr!== null && (
      utils.isArray(expr) && expr.length > 0 ||
      utils.isObject(expr) && Object.keys(expr).length > 0 ||
      utils.isString(expr) && expr.length > 0 ||
      utils.isNumber(expr) && expr !== 0 ||
      utils.isBool(expr) && expr ||
      utils.isFunction(expr)
    );
  },
};

module.exports = utils;
