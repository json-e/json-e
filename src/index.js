var interpreter = require('./interpreter');
var fromNow = require('./from-now');
var assert = require('assert');
var stringify = require('json-stable-stringify');
var {
  isString, isNumber, isBool,
  isArray, isObject, isFunction,
  isTruthy,
} = require('./type-utils');
var addBuiltins = require('./builtins');
var {JSONTemplateError, TemplateError} = require('./error');

function checkUndefinedProperties(template, allowed) {
  var unknownKeys = '';
  var combined = new RegExp(allowed.join('|') + '$');
  for (var key of Object.keys(template).sort()) {
    if (!combined.test(key)) {
      unknownKeys += ' ' + key;
    }
  }
  if (unknownKeys) {
    throw new TemplateError(allowed[0].replace('\\', '') + ' has undefined properties:' + unknownKeys);
  }
};

let flattenDeep = (a) => {
  return Array.isArray(a) ? [].concat(...a.map(flattenDeep)) : a;
};

let interpolate = (string, context) => {
  let result = '';
  let remaining = string;
  let offset;
  while ((offset = remaining.search(/\$?\${/g)) !== -1) {
    result += remaining.slice(0, offset);

    if (remaining[offset+1] != '$') {
      let v = interpreter.parseUntilTerminator(remaining.slice(offset), 2, '}', context);
      if (isArray(v.result) || isObject(v.result)) {
        let input = remaining.slice(offset + 2, offset + v.offset);
        throw new TemplateError(`interpolation of '${input}' produced an array or object`);
      }

      // if it is null, result should just be appended with empty string
      if (v.result === null) {
        result += '';
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
  checkUndefinedProperties(template, ['\\$eval']);

  if (!isString(template['$eval'])) {
    throw new TemplateError('$eval must be given a string expression');
  }

  return interpreter.parse(template['$eval'], context);
};

operators.$flatten = (template, context) => {
  checkUndefinedProperties(template, ['\\$flatten']);

  let value = render(template['$flatten'], context);

  if (!isArray(value)) {
    throw new TemplateError('$flatten value must evaluate to an array');
  }

  return value.reduce((a, b) => a.concat(b), []);
};

operators.$flattenDeep = (template, context) => {
  checkUndefinedProperties(template, ['\\$flattenDeep']);

  let value = render(template['$flattenDeep'], context);

  if (!isArray(value)) {
    throw new TemplateError('$flattenDeep value must evaluate to an array');
  }

  return flattenDeep(value);
};

operators.$fromNow = (template, context) => {
  checkUndefinedProperties(template, ['\\$fromNow', 'from']);

  let value = render(template['$fromNow'], context);
  let reference = context.now;
  if (template['from']) {
    reference = render(template['from'], context);
  }
  if (!isString(value)) {
    throw new TemplateError('$fromNow expects a string');
  }
  return fromNow(value, reference);
};

operators.$if = (template, context) => {
  checkUndefinedProperties(template, ['\\$if', 'then', 'else']);

  if (!isString(template['$if'])) {
    throw new TemplateError('$if can evaluate string expressions only');
  }
  if (isTruthy(interpreter.parse(template['$if'], context))) {
    return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
  }
  return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
};

operators.$json = (template, context) => {
  checkUndefinedProperties(template, ['\\$json']);

  return stringify(render(template['$json'], context));
};

operators.$let = (template, context) => {
  checkUndefinedProperties(template, ['\\$let', 'in']);

  if (!isObject(template['$let'])) {
    throw new TemplateError('$let value must be an object');
  }
  let variables = {};
  Object.keys(template['$let']).forEach(key => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      throw new TemplateError('top level keys of $let must follow /[a-zA-Z_][a-zA-Z0-9_]*/');
    }
    variables[key] = render(template['$let'][key], context);
  });

  var child_context = Object.assign(context, variables);

  if (template.in == undefined) {
    throw new TemplateError('$let operator requires an `in` clause');
  }

  return render(template.in, child_context);
};

operators.$map = (template, context) => {
  EACH_RE = 'each\\(([a-zA-Z_][a-zA-Z0-9_]*)\\)';
  checkUndefinedProperties(template, ['\\$map', EACH_RE]);
  let value = render(template['$map'], context);
  if (!isArray(value) && !isObject(value)) {
    throw new TemplateError('$map value must evaluate to an array or object');
  }

  if (Object.keys(template).length !== 2) {
    throw new TemplateError('$map must have exactly two properties');
  }

  let eachKey = Object.keys(template).filter(k => k !== '$map')[0];
  let match = /^each\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/.exec(eachKey);
  if (!match) {
    throw new TemplateError('$map requires each(identifier) syntax');
  }

  let x = match[1];
  let each = template[eachKey];

  let object = isObject(value);

  if (object) {
    value = Object.keys(value).map(key => ({key, val: value[key]}));
  }

  value = value.map(v => render(each, Object.assign({}, context, {[x]: v})))
    .filter(v => v !== deleteMarker);

  if (object) {
    return value.reduce((a, o) => Object.assign(a, o), {});
  } else {
    return value;
  }
};

operators.$merge = (template, context) => {
  checkUndefinedProperties(template, ['\\$merge']);

  let value = render(template['$merge'], context);

  if (!isArray(value) || value.some(o => !isObject(o))) {
    throw new TemplateError('$merge value must evaluate to an array of objects');
  }

  return Object.assign({}, ...value);
};

operators.$mergeDeep = (template, context) => {
  checkUndefinedProperties(template, ['\\$mergeDeep']);

  let value = render(template['$mergeDeep'], context);

  if (!isArray(value) || value.some(o => !isObject(o))) {
    throw new TemplateError('$mergeDeep value must evaluate to an array of objects');
  }

  if (value.length === 0) {
    return {};
  }
  // merge two values, preferring the right but concatenating lists and
  // recursively merging objects
  let merge = (l, r) => {
    if (isArray(l) && isArray(r)) {
      return l.concat(r);
    }
    if (isObject(l) && isObject(r)) {
      let res = Object.assign({}, l);
      for (let p in r) { // eslint-disable-line taskcluster/no-for-in
        if (p in l) {
          res[p] = merge(l[p], r[p]);
        } else {
          res[p] = r[p];
        }
      }
      return res;
    }
    return r;
  };
  // start with the first element of the list
  return value.reduce(merge, value.shift());
};

operators.$reverse = (template, context) => {
  checkUndefinedProperties(template, ['\\$reverse']);

  let value = render(template['$reverse'], context);

  if (!isArray(value)) {
    throw new TemplateError('$reverse value must evaluate to an array of objects');
  }
  return value.reverse();
};

operators.$sort = (template, context) => {
  BY_RE = 'by\\(([a-zA-Z_][a-zA-Z0-9_]*)\\)';
  checkUndefinedProperties(template, ['\\$sort', BY_RE]);
  let value = render(template['$sort'], context);
  if (!isArray(value)) {
    throw new TemplateError('$sorted values to be sorted must have the same type');
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
      throw new TemplateError('$sorted values to be sorted must have the same type');
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
      throw new TemplateError('$sorted values to be sorted must have the same type');
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
    return template.map((v, i) => {
      try {
        return render(v, context);
      } catch (err) {
        if (err instanceof JSONTemplateError) {
          err.add_location(`[${i}]`);
        }
        throw err;
      }
    }).filter((v) => v !== deleteMarker);
  }

  let matches = Object.keys(operators).filter(c => template.hasOwnProperty(c));
  if (matches.length > 1) {
    throw new TemplateError('only one operator allowed');
  }
  if (matches.length === 1) {
    return operators[matches[0]](template, context);
  }

  // clone object
  let result = {};
  for (let key of Object.keys(template)) {
    let value;
    try {
      value = render(template[key], context);
    } catch (err) {
      if (err instanceof JSONTemplateError) {
        if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
          err.add_location(`.${key}`);
        } else {
          err.add_location(`[${JSON.stringify(key)}]`);
        }
      }
      throw err;
    }
    if (value !== deleteMarker) {
      if (key.startsWith('$$')) {
        key = key.substr(1);
      } else if (/^\$[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
        throw new TemplateError('$<identifier> is reserved; ues $$<identifier>');
      } else {
        key = interpolate(key, context);
      }

      result[key] = value;
    }
  }
  return result;
};

module.exports = (template, context = {}) => {
  let test = Object.keys(context).every(v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v));
  if (!test) {
    throw new TemplateError('top level keys of context must follow /[a-zA-Z_][a-zA-Z0-9_]*/');
  }
  context = addBuiltins(Object.assign({}, {now: fromNow('0 seconds')}, context));
  let result = render(template, context);
  if (result === deleteMarker) {
    return null;
  }
  return result;
};
