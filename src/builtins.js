import {
  isString, isNumber, isBool,
  isArray, isObject, isFunction,
} from './type-utils';
import BuiltinError from './error';

let builtinError = (builtin, expectation) => new BuiltinError(`${builtin} expects ${expectation}`);

let builtins = {};

let define = (name, context, {argumentTypes = [], variadic = null, invoke}) => context[name] = (...args) => {
  if (!variadic && args.length < argumentTypes.length) {
    throw builtinError(`builtin: ${name}`, `${args.toString()}, arguments too less`);
  }

  if (variadic) {
    argumentTypes = args.map(() => variadic);
  }

  let getArgumentTests = types => types.split('|').map(type => {
    switch (type) {
      case 'string':   return isString;
      case 'number':   return isNumber;
      case 'array':    return isArray;
      case 'object':   return isObject;
      case 'function': return isFunction;
      case 'boolean':  return isBool;
      default:         throw new Error(`${type} not supported for builtin arguments`);
    }
  });

  args.forEach((arg, i) => {
    if (!getArgumentTests(argumentTypes[i]).some(test => test(arg))) {
      throw builtinError(`builtin: ${name}`, `argument ${i + 1} to be ${argumentTypes[i]} found ${typeof arg}`);
    }
  });

  return invoke(...args);
};

// attaching math functions
let mathBuiltins = [
  ['min', builtins, {
    variadic: 'number',
  }],
  ['max', builtins, {
    variadic: 'number',
  }],
  ['sqrt', builtins, {
    argumentTypes: ['number'],
  }],
  ['ceil', builtins, {
    argumentTypes: ['number'],
  }],
  ['floor', builtins, {
    argumentTypes: ['number'],
  }],
  ['abs', builtins, {
    argumentTypes: ['number'],
  }],
];

mathBuiltins.forEach(props => {
  if (Math[props[0]] == undefined) {
    throw new Error(`${prop} in Math undefined`);
  }

  props[2] = Object.assign({}, {
    invoke: (...args) => Math[props[0]](...args),
  }, props[2]);

  define.apply(null, props);
});

define('lowercase', builtins, {
  argumentTypes: ['string'],
  invoke: str => str.toLowerCase(),
});

define('uppercase', builtins, {
  argumentTypes: ['string'],
  invoke: str => str.toUpperCase(),
});

define('str', builtins, {
  argumentTypes: ['string|number|boolean|array'],
  invoke: obj => obj.toString(),
});

define('len', builtins, {
  argumentTypes: ['string|array'],
  invoke: obj => obj.length,
});

export default builtins;
