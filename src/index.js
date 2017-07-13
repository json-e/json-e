var interpreter = require('./interpreter');
var fromNow = require('./from-now');
var assert = require('assert');
var {
  isString, isNumber, isBool,
  isArray, isObject, isFunction,
  isTruthy,
} = require('./type-utils');
var builtins = require('./builtins');
var {TemplateError} = require('./error');

let flattenDeep = (a) => {
  return Array.isArray(a) ? [].concat(...a.map(flattenDeep)) : a;
};

let jsonTemplateError = (msg, template) => new TemplateError(msg + JSON.stringify(template, null, '\t'));

let interpolate = (string, context) => {
  let result = '';
  let remaining = string;
  let offset;
  while ((offset = remaining.search(/\$?\${/g)) !== -1) {
    result += remaining.slice(0, offset);

    if (remaining[offset+1] != '$') {
      let v = interpreter.parseUntilTerminator(remaining.slice(offset), 2, '}', context);
      if (isArray(v.result) || isObject(v.result)) {
        throw new TemplateError('cannot interpolate array/object: ' + string);
      }

      // toString renders null as an empty string, which is not what we want
      if (v.result === null) {
        result += 'null';
      } else {
        result += v.result.toString();
      }

      remaining = remaining.slice(offset + v.offset + 1);
    } else {
      result += '${';
      remaining = remaining.slice(offset + 3);
    }
  }
  result += remaining;
  return result;
};

// Object used to indicate deleteMarker
let deleteMarker = {};

let operators = {};

operators.$eval = (template, context) => {
  let value = render(template['$eval'], context);
  if (!isString(value)) {
    throw jsonTemplateError('$eval can evaluate string expressions only\n', template);
  }
  return interpreter.parse(value, context);
};

operators.$flatten = (template, context) => {
  let value = render(template['$flatten'], context);

  if (!isArray(value)) {
    throw jsonTemplateError('$flatten requires array as value\n', template);
  }

  return [].concat(...value);
};

operators.$flattenDeep = (template, context) => {
  let value = render(template['$flattenDeep'], context);

  if (!isArray(value)) {
    throw jsonTemplateError('$flattenDeep requires array as value\n', template);
  }

  return flattenDeep(value);
};

operators.$fromNow = (template, context) => {
  let value = render(template['$fromNow'], context);
  if (!isString(value)) {
    throw jsonTemplateError('$fromNow can evaluate string expressions only\n', template);
  }
  return fromNow(value);
};

operators.$if = (template, context) => {
  if (!isString(template['$if'])) {
    throw jsonTemplateError('$if can evaluate string expressions only\n', template);
  }
  if (isTruthy(interpreter.parse(template['$if'], context))) {
    return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
  }
  return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
};

operators.$json = (template, context) => {
  return JSON.stringify(render(template['$json'], context));
};

operators.$let = (template, context) => {
  let variables = render(template['$let'], context);

  var context_copy = Object.assign(context, variables);

  if (!isObject(variables)) {
    throw jsonTemplateError('$let operator requires an object as the context\n', template);
  }

  if (template.in == undefined) {
    throw jsonTemplateError('$let operator requires `in` clause\n', template);
  }

  return render(template.in, context_copy);
};

operators.$map = (template, context) => {
  let value = render(template['$map'], context);
  if (!isArray(value)) {
    throw jsonTemplateError('$map requires array as value\n', template);
  }

  if (Object.keys(template).length !== 2) {
    throw jsonTemplateError('$map requires cannot have more than two properties\n', template);
  }

  let eachKey = Object.keys(template).filter(k => k !== '$map')[0];
  let match = /^each\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/.exec(eachKey);
  if (!match) {
    throw jsonTemplateError('$map requires each(identifier) syntax\n', template);
  }

  let x = match[1];
  let each = template[eachKey];

  return value.map(v => render(each, Object.assign({}, context, {[x]: v})))
              .filter(v => v !== deleteMarker);
};

operators.$merge = (template, context) => {
  let value = render(template['$merge'], context);

  if (!isArray(value) || value.some(o => !isObject(o))) {
    throw jsonTemplateError('$merge requires array as value\n', template);
  }

  return Object.assign({}, ...value);
};

operators.$reverse = (template, context) => {
  let value = render(template['$reverse'], context);

  if (!isArray(value) && !isArray(template['$reverse'])) {
    throw jsonTemplateError('$reverse value must evaluate to an array\n', template);
  }

  if (!isArray(value)) {
    throw jsonTemplateError('$reverse requires array as value\n', template);
  }
  return value.reverse();
};

operators.$sort = (template, context) => {
  let value = render(template['$sort'], context);
  if (!isArray(value)) {
    throw jsonTemplateError('$sort requires array as value\n', template);
  }

  let byKey = Object.keys(template).filter(k => k !== '$sort')[0];
  let match = /^by\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/.exec(byKey);
  let by;
  if (match) {
    let contextClone = Object.assign({}, context);
    let x = match[1];
    let byExpr = template[byKey];
    by = value => {
      contextClone[x] = value;
      return interpreter.parse(byExpr, contextClone);
    };
  } else {
    let needBy = value.some(v => isArray(v) || isObject(v));
    if (needBy) {
      throw jsonTemplateError('$sort requires by(identifier) for sorting arrays of objects/arrays\n', template);
    }
    by = value => value;
  }

  // tag each value with its `by` value (schwartzian tranform)
  let tagged = value.map(e => [by(e), e]);

  // check types of the `by` values
  if (tagged.length > 0) {
    let eltType = typeof tagged[0][0];
    if (eltType !== 'number' && eltType !== 'string' ||
        tagged.some(e => eltType !== typeof e[0])) {
      throw jsonTemplateError('$sort requires all sorted values have the same type', template);
    }
  }

  // finish the schwartzian transform
  return tagged
    .sort((a, b) => {
      a = a[0];
      b = b[0];
      if (a < b) { return -1; }
      if (a > b) { return 1; }
      return 0;
    })
    .map(e => e[1]);
};

let render = (template, context) => {
  if (isNumber(template) || isBool(template) || template === null) {
    return template;
  }
  if (isString(template)) {
    return interpolate(template, context);
  }
  if (isArray(template)) {
    return template.map((v) => render(v, context)).filter((v) => v !== deleteMarker);
  }

  let matches = Object.keys(operators).filter(c => template.hasOwnProperty(c));
  if (matches.length > 1) {
    throw jsonTemplateError('only one operator allowed\n', template);
  }
  if (matches.length === 1) {
    return operators[matches[0]](template, context);
  }

  // clone object
  let result = {};
  for (let key of Object.keys(template)) {
    let value = render(template[key], context);
    if (value !== deleteMarker) {
      if (key.startsWith('$$') && operators.hasOwnProperty(key.substr(1))) {
        key = key.substr(1);
      }

      result[interpolate(key, context)] = value;
    }
  }
  return result;
};

module.exports = (template, context = {}) => {
  let test = Object.keys(context).every(v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.exec(v)[0]);
  context = Object.assign({}, builtins, context);
  assert(test, 'top level keys of context must follow /[a-zA-Z_][a-zA-Z0-9_]*/');
  let result = render(template, context);
  if (result === deleteMarker) {
    return null;
  }
  return result;
};
