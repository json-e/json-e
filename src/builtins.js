var {BuiltinError} = require('./error');
var fromNow = require('./from-now');
var {
  isString, isNumber, isBool,
  isArray, isObject, isJSON,
  isNull, isFunction,
} = require('./type-utils');

let types = {
  string: isString,
  number: isNumber,
  boolean: isBool,
  array: isArray,
  object: isObject,
  json: isJSON,
  null: isNull,
  function: isFunction,
};

let builtinError = (builtin) => new BuiltinError(`invalid arguments to ${builtin}`);

module.exports = (context) => {
  let builtins = {};

  let define = (name, context, {
    argumentTests = [],
    minArgs = false,
    variadic = null,
    invoke,
  }) => context[name] = (...args) => {
    if (!variadic && args.length < argumentTests.length) {
      throw builtinError(`builtin: ${name}`, `${args.toString()}, too few arguments`);
    }

    if (minArgs && args.length < minArgs) {
      throw builtinError(`builtin: ${name}: expected at least ${minArgs} arguments`);
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
      minArgs: 1,
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
    argumentTests: ['string|number|boolean|null'],
    invoke: obj => {
      if (obj === null) {
        return 'null';
      }
      return obj.toString();
    },
  });

  define('len', builtins, {
    argumentTests: ['string|array'],
    invoke: obj => Array.from(obj).length,
  });

  define('strip', builtins, {
    argumentTests: ['string'],
    invoke: str => str.trim(),
  });

  define('rstrip', builtins, {
    argumentTests: ['string'],
    invoke: str => str.replace(/\s+$/, ''),
  });

  define('lstrip', builtins, {
    argumentTests: ['string'],
    invoke: str => str.replace(/^\s+/, ''),
  });

  // Miscellaneous
  define('fromNow', builtins, {
    variadic: 'string',
    minArgs: 1,
    invoke: (str, reference) => fromNow(str, reference || context.now),
  });

  define('typeof', builtins, {
    argumentTests: ['string|number|boolean|array|object|null|function'],
    invoke: x => {
      for (type of ['string', 'number', 'boolean', 'array', 'object', 'function']) {
        if (types[type](x)) {
          return type;
        }
      }
      if (types['null'](x)) {
        return null;
      }
      throw builtinError('builtin: typeof', `argument ${x} to be a valid json-e type. found ${typeof arg}`);
    },
  });

  return Object.assign({}, builtins, context);
};
