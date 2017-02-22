import {
  isString, isNumber, isBool,
  isArray, isObject, isFunction,
} from './type-utils';
import ExtendableError from 'es6-error';

class BuiltinError extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'BuiltinError';
  }
}

let builtinError = (builtin, expectation) => new BuiltinError(`${builtin} expects ${expectation}`);

let builtins = {};

// attaching math functions
let mathBuiltins = ['min', 'max', 'sqrt', 'ceil', 'floor', 'abs'];

mathBuiltins.forEach(prop => {
  if (Math[prop] == undefined) {
    throw new Error(`${prop} in Math undefined`);
  }
  builtins[prop] = Math[prop];
});

builtins['lowercase'] = str => {
  if (!isString(str)) {
    throw builtinError('builtin: lowercase', 'String as argument');
  }
  return str.toLowerCase();
};

builtins['uppercase'] = str => {
  if (!isString(str)) {
    throw builtinError('builtin: uppercase', 'String as argument');
  }
  return str.toUpperCase();
};

builtins['len'] = obj => {
  if (!(isString(obj) || isArray(obj))) {
    throw builtinError('builtin: len', 'String/Array as argument');
  }
  return obj.length;
};

module.exports = builtins;