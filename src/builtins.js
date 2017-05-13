import BuiltinError from './error';
import fromNow from './from-now';
import {
  isString, isNumber, isBool,
  isArray, isObject, isJSON,
} from './type-utils';

let types = {
  string: isString,
  number: isNumber,
  boolean: isBool,
  array: isArray,
  object: isObject,
  json: isJSON,
};

let builtinError = (builtin, expectation) => new BuiltinError(`${builtin} expects ${expectation}`);

let builtins = {};

let define = (name, context, {argumentTests = [], variadic = null, invoke}) => context[name] = (...args) => {
  if (!variadic && args.length < argumentTests.length) {
    throw builtinError(`builtin: ${name}`, `${args.toString()}, arguments too less`);
  }

  if (variadic) {
    argumentTests = args.map(() => variadic);
  }

  args.forEach((arg, i) => {
    if (!argumentTests[i].split('|').some(test => types[test](arg))) {
      throw builtinError(`builtin: ${name}`, `argument ${i + 1} to be ${argumentTests[i]} found ${typeof arg}`);
    }
  });

  return invoke(...args);
};

// Math functions
['max', 'min'].forEach(name => {
  if (Math[name] == undefined) {
    throw new Error(`${name} in Math undefined`);
  }
  define(name, builtins, {
    variadic: 'number',
    invoke: (...args) => Math[name](...args),
  });
});

['sqrt', 'ceil', 'floor', 'abs'].forEach(name => {
  if (Math[name] == undefined) {
    throw new Error(`${name} in Math undefined`);
  }
  define(name, builtins, {
    argumentTests: ['number'],
    invoke: num => Math[name](num),
  });
});

// String manipulation
define('lowercase', builtins, {
  argumentTests: ['string'],
  invoke: str => str.toLowerCase(),
});

define('uppercase', builtins, {
  argumentTests: ['string'],
  invoke: str => str.toUpperCase(),
});

define('str', builtins, {
  argumentTests: ['string|number|boolean|array'],
  invoke: obj => obj.toString(),
});

define('len', builtins, {
  argumentTests: ['string|array'],
  invoke: obj => obj.length,
});

// Miscellaneous
define('fromNow', builtins, {
  argumentTests: ['string'],
  invoke: str => fromNow(str),
});

export default builtins;
