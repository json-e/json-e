import interpreter from './interpreter';
import fromNow from './from-now';
import assert from 'assert';
import {
  isString, isNumber, isBool,
  isArray, isObject, isFunction,
} from './type-utils';
import builtins from './builtins';
import {TemplateError} from './error';

let flattenDeep = (a) => {
  return Array.isArray(a) ? [].concat(...a.map(flattenDeep)) : a;
};

let jsonTemplateError = (msg, template) => new TemplateError(msg + JSON.stringify(template, null, '\t'));

let interpolate = (string, context) => {
  let result = '';
  let begin = 0;
  let remaining = string;
  let offset;
  while ((offset = remaining.search(/\${/g)) !== -1) {
    let v = interpreter.parseUntilTerminator(remaining.slice(offset), 2, '}', context);
    if (isArray(v.result) || isObject(v.result)) {
      throw new TemplateError('cannot interpolate array/object: ' + string);
    }

    result += remaining.slice(0, offset);

    // toString renders null as an empty string, which is not what we want
    if (v.result === null) {
      result += 'null';
    } else {
      result += v.result.toString();
    }

    remaining = remaining.slice(offset + v.offset + 1);
  }
  result += remaining;
  return result;
};

// Object used to indicate deleteMarker
let deleteMarker = {};

let operators = {};

operators.$eval = (template, context) => {
  if (!isString(template['$eval'])) {
    throw jsonTemplateError('$eval can evaluate string expressions only\n', template);
  }
  return interpreter.parse(template['$eval'], context);
};

operators.$flatten = (template, context) => {
  let value = render(template['$flatten'], context);

  // Value must be array of arrays
  if (!(isArray(value) && value.some(v => isArray(v)))) {
    throw jsonTemplateError('$flatten requires array of arrays as value\n', template);
  }

  return [].concat(...value);
};

operators.$flattenDeep = (template, context) => {
  let value = render(template['$flattenDeep'], context);

  // Value must be array of arrays
  if (!(isArray(value) && value.some(v => isArray(v)))) {
    throw jsonTemplateError('$flatten requires array of arrays as value\n', template);
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
  if (interpreter.parse(template['$if'], context)) {
    return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
  }
  return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
};

operators.$json = (template, context) => {
  return JSON.stringify(render(template['$json'], context));
};

operators.$let = (template, context) => {
  let variables = template['$let'];

  var context_copy = Object.assign(context, variables);

  if (variables === null || isArray(variables) || !isObject(variables)) {
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

  if (!isArray(value)) {
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
  if (!match) {
    let needBy = value.some(v => isArray(v) || isObject(v));
    if (needBy) {
      throw jsonTemplateError('$sort requires by(identifier) for sorting arrays of objects/arrays\n', template);
    }
    return value.sort();
  }

  let x = match[1];
  let by = template[byKey];
  let contextClone = Object.assign({}, context);

  return value.sort((left, right) => {
    contextClone[x] = left;
    left = interpreter.parse(by, contextClone);
    contextClone[x] = right;
    right = interpreter.parse(by, contextClone);
    if (left <= right) {
      return false;
    }
    return true;
  });
};

let render = (template, context) => {
  if (isNumber(template) || isBool(template)) {
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

export default (template, context = {}) => {
  let test = Object.keys(context).every(v => /[a-zA-Z_][a-zA-Z0-9_]*/.exec(v)[0]);
  context = Object.assign({}, builtins, context);
  assert(test, 'top level keys of context must follow /[a-zA-Z_][a-zA-Z0-9_]*/');
  let result = render(template, context);
  if (result === deleteMarker) {
    return null;
  }
  return result;
};
