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

let jsonTemplateError = (msg, template) => {throw new TemplateError(msg + JSON.stringify(template, null, '\t'));};

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
      jsonTemplateError('$eval can evaluate string expressions only\n');
    }
    return interpreter.parse(template['$eval'], context);
  },
  $fromNow: (template, context) => {
    if (!isString(template['$fromNow'])) {
      jsonTemplateError('$fromNow can evaluate string expressions only\n');
    }
    return fromNow(template['$fromNow']);
  },
  $if: (template, context) => {
    if (!isString(template['$if'])) {
      jsonTemplateError('$if can evaluate string expressions only\n');
    }
    if (interpreter.parse(template['$if'], context)) {
      return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
    } else {
      return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
    }
  },
  $switch: (template, context) => {
    if (!isString(template['$switch'])) {
      jsonTemplateError('$switch can evaluate string expressions only\n');
    }
    let c = interpreter.parse(template['$switch'], context);
    return template.hasOwnProperty(c) ? render(template[c], context) : deleteMarker;
  },
  $json: (template, context) => {
    if (isArray(template['$json']) || isObject(['$json'])) {
      return JSON.stringify(render(template['$json'], context));
    }
    return JSON.stringify(template['$json']);
  },
  $map: (template, context) => {
    let exp = /\(([a-zA-Z_][a-zA-Z_0-9]*)\)/;
    if (isArray(template['$map'])) {
      for (let prop of Object.keys(template)) {
        if (template.hasOwnProperty(prop) && prop.startsWith('each')) {
          if (typeof template[prop] === 'string') {
            return template['$map'].map((v) => template[prop]);
          }
          let match = exp.exec(prop);
          if (match && match[1]) {
            let itr = match[1];
            context[itr] = null;
            let result = template['$map'].map((v) => {
              context[itr] = v;
              return render(template[prop], context);
            });
            delete context[itr];
            return result;
          } else {
            jsonTemplateError('$map requires each(identifier) syntax\n');
          }
        }
      }
    } else {
      jsonTemplateError('$map requires array as value\n');
    }
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

module.exports = (template, context = {}) => {
  let result = render(template, context);
  if (result === deleteMarker) {
    return undefined;
  }
  return result;
};
