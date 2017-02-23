module.exports = {
  isString:   expr => typeof expr === 'string',
  isNumber:   expr => typeof expr === 'number',
  isBool:     expr => typeof expr === 'boolean',
  isArray:    expr => expr instanceof Array,
  isObject:   expr => expr instanceof Object,
  isFunction: expr => expr instanceof Function,
  isJSON:     expr => expr instanceof JSON,
};
