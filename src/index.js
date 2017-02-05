let interpreter = require('./interpreter');
let fromNow = require('./from-now');
let ExtendableError = require('es6-error');

class TemplateError extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'TemplateError';
  }
}

let isString = (expr) => typeof expr === 'string';
let isNumber = (expr) => typeof expr === 'number';
let isBool = (expr) => typeof expr === 'boolean';
let isArray = (expr) => expr instanceof Array;
let isObject = (expr) => expr instanceof Object;

let jsonTemplateError = (msg, template) => new TemplateError(msg + JSON.stringify(template, null, '\t'));

let interpolate = (string, context) => {
  return string.replace(/\${([^}]*)}/g, (text, expr) => {
    let v = interpreter.parse(expr, context);
    if (v instanceof Array || v instanceof Object) {
      throw new TemplateError('Cannot interpolate objects/arrays: '
        + text + ' <-- ' + expr);
    }
    return v.toString();
  });
};

let deleteMarker = {};

let constructs = {
  $eval: (template, context) => {
    if (!isString(template['$eval'])) {
      throw jsonTemplateError('$eval can evaluate string expressions only\n', template);
    }
    return interpreter.parse(template['$eval'], context);
  },
  $fromNow: (template, context) => {
    if (!isString(template['$fromNow'])) {
      throw jsonTemplateError('$fromNow can evaluate string expressions only\n', template);
    }
    return fromNow(template['$fromNow']);
  },
  $if: (template, context) => {
    if (!isString(template['$if'])) {
      throw jsonTemplateError('$if can evaluate string expressions only\n', template);
    }
    if (interpreter.parse(template['$if'], context)) {
      return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
    } else {
      return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
    }
  },
  $switch: (template, context) => {
    if (!isString(template['$switch'])) {
      throw jsonTemplateError('$switch can evaluate string expressions only\n', template);
    }
    let c = interpreter.parse(template['$switch'], context);
    return template.hasOwnProperty(c) ? render(template[c], context) : deleteMarker;
  },
  $json: (template, context) => {
    return JSON.stringify(render(template['$json'], context));
  },
  $reverse: (template, context) => {
    let value = render(template['$reverse'], context);
    if (!isArray(value)) {
      throw jsonTemplateError('$reverse requires array as value\n', template);
    }
    return value.reverse();
  },
  $map: (template, context) => {
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

    return value.map(v => render(each, Object.assign({}, context, {[x]: v}))).filter(v => v !== deleteMarker);

  },
  $sort: (template, context) => {
    let value = render(template['$sort'], context);
    if (!isArray(value)) {
      throw jsonTemplateError('$sort requires array as value\n', template);
    }

    if (isArray(value[0]) || isObject(value[0])) {
      if (Object.keys(template).length !== 2) {
        throw jsonTemplateError('$sort requires cannot have more than two properties\n', template);
      }

      let byKey = Object.keys(template).filter(k => k !== '$sort')[0];
      let match = /^by\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/.exec(byKey);
      if (!match) {
        throw jsonTemplateError('$sort requires by(identifier) syntax\n', template);
      }

      let x = match[1];
      let by = template[byKey];
      let contextClone = Object.assign({}, context);

      return value.sort((left, right) => {
        contextClone[x] = left;
        left = render(by, contextClone);
        contextClone[x] = right;
        right = render(by, contextClone);
        if (left <= right) {
          return false;
        } else if (left > right) {
          return true;
        }
      });
    }

    return value.sort();
  },
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

  // check for multiple constructs
  let detectConstruct = false, prevConstruct;
  for (let construct of Object.keys(constructs)) {
    if (template.hasOwnProperty(construct)) {
      if (detectConstruct) {
        throw new TemplateError('only one construct allowed\n'
          + JSON.stringify(template, null, '\t'));
      } else {
        detectConstruct = true;
      }
    }
  }

  for (let construct of Object.keys(constructs)) {
    if (template.hasOwnProperty(construct)) {
      return constructs[construct](template, context);
    }
  }

  // clone object
  let result = {};
  for (let key of Object.keys(template)) {
    let value = render(template[key], context);
    if (value !== deleteMarker) {
      result[interpolate(key, context)] = value;
    }
  }
  return result;
};

//console.log(render({a: {$eval: '1 + 2', $if: 'true'}}, {}));
//console.log(render({a: {$map: [1,2], 'each(x)': {$eval: 'x + 1'}}}, {}));
//console.log(render({a: {$map: [1,2], 'each(x)': {a: {$eval: 'x + 1'}, b:'before=${x}'}}},{}));
//console.log(render({a: {$sort: [{a: 2}, {a: 1, b: []}, {a: 3}]}}, {}));

module.exports = (template, context = {}) => {
  let result = render(template, context);
  if (result === deleteMarker) {
    return undefined;
  }
  return result;
};
