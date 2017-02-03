let interpreter = require('./interpreter');
let fromNow = require('./from-now');
let ExtendableError = require('es6-error');

let interpolate = (string, context) => {
  return string.replace('/\${([^}]*)}/g', (text, expr) => {
    return interpreter.parse(expr, context);  
  });
};

let deleteMarker = {};

class Json_E_Error extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'json-e error';
  }
}

let constructs = {
  $if: (template, context) => {
    if (!(typeof template['$if'] === 'string')) {
      throw new Json_E_Error('$if can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    if (interpreter.parse(template['$if'], context)) {
      return template.then ? render(template.then, context) : deleteMarker;
    } else {
      return template.else ? render(template.else, context) : deleteMarker;
    }
  },
  $switch: (template, context) => {
    if (!(typeof template['$switch'] === 'string')) {
      throw new Json_E_Error('$switch can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    let c = interpreter.parse(template['$switch'], context);
    return template[c] ? render(template[c], context) : deleteMarker;
  },
};

let evaluators = {
  $eval: (template, context) => {
    if (!(typeof template['$eval'] === 'string')) {
      throw new Json_E_Error('$eval can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    return interpreter.parse(template['$eval'], context);
  },
  $fromNow: (template, context) => {
    if (!(typeof ['$fromNow'] === 'string')) {
      throw new Json_E_Error('$fromNow can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    return fromNow(template['fromNow']);
  },
};

let render = (template, context) => {
  if (typeof template === 'number' || typeof template === 'boolean') {
    return template;
  } 
  if (typeof template === 'string') {
    return interpolate(template, context);
  }
  if (template instanceof Array) {
    return template.map((v) => render(v, context)).filter((v) => v !== deleteMarker);
  }

  // TODO: Probably throw an error if template two construct 
  // or (construct and evaluators) keys like having both $if and $map,
  for (let construct of Object.keys(constructs)) {
    if (template.hasOwnProperty(construct)) {
      return constructs[construct](template, context);
    }
  }

  for (let evaluator of Object.keys(evaluators)) {
    if (template.hasOwnProperty(evaluator)) {
      return evaluators[evaluator](template, context);
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

console.log(render({a: {$eval: '1 + 2'}}, {}));

module.exports = render;
