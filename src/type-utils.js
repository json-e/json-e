let utils = {
  isString:   expr => typeof expr === 'string',
  isNumber:   expr => typeof expr === 'number',
  isInteger:  expr => typeof expr === 'number' && Number.isInteger(expr),
  isBool:     expr => typeof expr === 'boolean',
  isNull:     expr => expr === null,
  isArray:    expr => expr instanceof Array,
  isObject:   expr => expr instanceof Object && !(expr instanceof Array) && !(expr instanceof Function),
  isFunction: expr => expr instanceof Function,
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
