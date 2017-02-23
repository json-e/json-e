import type_utils from './type-utils';
import BuiltinError from './error';

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
    if (!argumentTests[i].split('|').some(test => type_utils[test](arg))) {
      throw builtinError(`builtin: ${name}`, `argument ${i + 1} to be ${argumentTests[i]} found ${typeof arg}`);
    }
  });

  return invoke(...args);
};

// attaching math functions
['max', 'min'].forEach(name => {
  if (Math[name] == undefined) {
    throw new Error(`${name} in Math undefined`);
  }
  define(name, builtins, {
    variadic: 'isNumber',
    invoke: (...args) => Math[name](...args),
  });
});

['sqrt', 'ceil', 'floor', 'abs'].forEach(name => {
  if (Math[name] == undefined) {
    throw new Error(`${name} in Math undefined`);
  }
  define(name, builtins, {
    argumentTests: ['isNumber'],
    invoke: num => Math[name](num),
  });
});

define('lowercase', builtins, {
  argumentTests: ['isString'],
  invoke: str => str.toLowerCase(),
});

define('uppercase', builtins, {
  argumentTests: ['isString'],
  invoke: str => str.toUpperCase(),
});

define('str', builtins, {
  argumentTests: ['isString|isNumber|isBool|isArray'],
  invoke: obj => obj.toString(),
});

define('len', builtins, {
  argumentTests: ['isString|isArray'],
  invoke: obj => obj.length,
});

export default builtins;
