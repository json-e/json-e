/*
* Author: Jonas Finnemann Jensen
* Github: https://github.com/jonasfj
*/
var PrattParser = require('./prattparser');
var {isString, isNumber, isInteger, isBool,
  isArray, isObject, isFunction, isTruthy} = require('./type-utils');
var {InterpreterError} = require('./error');

let expectationError = (operator, expectation) => new InterpreterError(`${operator} expects ${expectation}`);

let isEqual = (a, b) =>  {
  if (isArray(a) && isArray(b) && a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) { return false; }
    }
    return true;
  }
  if (isFunction(a)) {
    return a === b;
  }
  if (isObject(a) && isObject(b)) {
    let keys = Object.keys(a).sort();
    if (!isEqual(keys, Object.keys(b).sort())) { return false; }
    for (let k of keys) {
      if (!isEqual(a[k], b[k])) { return false; }
    }
    return true;
  }
  return a === b;
};

let parseList = (ctx, separator, terminator) => {
  let list = [];
  if (!ctx.attempt(terminator)) {
    do {
      list.push(ctx.parse());
    } while (ctx.attempt(separator));
    ctx.require(terminator);
  }
  return list;
};

let parseObject = (ctx) => {
  let obj = {};
  if (!ctx.attempt('}')) {
    do {
      let k = ctx.require('identifier', 'string');
      if (k.kind === 'string') {
        k.value = parseString(k.value);
      }
      ctx.require(':');
      let v = ctx.parse();
      obj[k.value] = v;
    } while (ctx.attempt(','));
    ctx.require('}');
  }
  return obj;
};

let parseInterval = (left, token, ctx) => {
  let a = null, b = null, isInterval = false;
  if (ctx.attempt(':')) {
    a = 0;
    isInterval = true;
  } else {
    a = ctx.parse();
    if (ctx.attempt(':')) {
      isInterval = true;
    }
  }

  if (isInterval && !ctx.attempt(']')) {
    b = ctx.parse();
    ctx.require(']');
  }

  if (!isInterval) {
    ctx.require(']');
  }

  return accessProperty(left, a, b, isInterval);
};

let accessProperty = (left, a, b, isInterval) => {
  if (isArray(left) || isString(left)) {
    if (isInterval) {
      b = b === null ? left.length : b;
      if (!isInteger(a) || !isInteger(b)) {
        throw new InterpreterError('cannot perform interval access with non-integers');
      }
      return left.slice(a, b);
    }
    if (!isInteger(a)) {
      throw new InterpreterError('should access arrays using integers only');
    }

    // for -ve index access
    a = a < 0 ? (left.length + a) % left.length : a;
    if (a >= left.length) {
      throw new InterpreterError('index out of bounds');
    }
    return left[a];
  }

  // if we reach here it means we are accessing property value from object
  if (!isObject(left)) {
    throw new InterpreterError('cannot access properties from non-objects');
  }

  if (!isString(a)) {
    throw new InterpreterError('object keys must be strings');
  }

  if (left.hasOwnProperty(a)) {
    return left[a];
  } else {
    return null;
  }
};

let parseString = (str) => {
  return str.slice(1, -1);
};

let testComparisonOperands = (operator, left, right) => {

  if (operator === '==' || operator === '!=') {
    return null;
  }

  let test = ['>=', '<=', '<', '>'].some(v => v === operator)
              && (isNumber(left) && isNumber(right) || isString(left) && isString(right));

  if (!test) {
    throw expectationError(`infix: ${operator}`, `numbers/strings ${operator} numbers/strings`);
  }
  return;
};

let testMathOperands = (operator, left, right) => {
  if (operator === '+' && !(isNumber(left) && isNumber(right) || isString(left) && isString(right))) {
    throw expectationError('infix: +', 'number/string + number/string');
  }
  if (['-', '*', '/', '**'].some(v => v === operator) && !(isNumber(left) && isNumber(right))) {
    throw expectationError(`infix: ${operator}`, `number ${operator} number`);
  }
  return;
};

let testLogicalOperand = (operator, operand) => {
  if (!isBool(operand)) {
    throw expectationError(`infix: ${operator}`, `boolean ${operator} boolean`);
  }
};

let prefixRules = {};
let infixRules = {};

// defining prefix rules
prefixRules['number'] = (token, ctx) => {
  let v = Number(token.value);
  if (isNaN(v)) {
    throw new Error(`${token.value} should be a number`);
  }
  return v;
};

prefixRules['!'] = (token, ctx) => {
  let operand = ctx.parse('unary');
  return !isTruthy(operand);
};

prefixRules['-'] = (token, ctx) => {
  let v = ctx.parse('unary');

  if (!isNumber(v)) {
    throw expectationError('unary -', 'number');
  }

  return -v;
};

prefixRules['+'] = (token, ctx) => {
  let v = ctx.parse('unary');

  if (!isNumber(v)) {
    throw expectationError('unary +', 'number');
  }

  return +v;
};

prefixRules['identifier'] = (token, ctx) => {
  if (ctx.context.hasOwnProperty(token.value)) {
    return ctx.context[token.value];
  }
  throw new InterpreterError(`unknown context value ${token.value}`);
};

prefixRules['null'] = (token, ctx) => {
  return null;
};

prefixRules['['] = (token, ctx) => parseList(ctx, ',', ']');

prefixRules['('] = (token, ctx) => {
  let v = ctx.parse();
  ctx.require(')');
  return v;
};

prefixRules['{'] = (token, ctx) => parseObject(ctx);

prefixRules['string'] = (token, ctx) => parseString(token.value);

prefixRules['true'] = (token, ctx) => {
  if (token.value === 'true') {
    return true;
  }
  throw new Error('Only \'true/false\' is considered as bool');
};

prefixRules['false'] = (token, ctx) => {
  if (token.value === 'false') {
    return false;
  }
  throw new Error('Only \'true/false\' is considered as bool');
};

// infix rule definition starts here
infixRules['+'] = infixRules['-'] = infixRules['*'] = infixRules['/']
  = (left, token, ctx) => {
    let operator = token.kind;
    let right = ctx.parse(operator);
    testMathOperands(operator, left, right);
    switch (operator) {
      case '+':  return left + right;
      case '-':  return left - right;
      case '*':  return left * right;
      case '/':  return left / right;
      default: throw new Error(`unknown infix operator: '${operator}'`);
    }
  };

infixRules['**'] = (left, token, ctx) => {
  let operator = token.kind;
  let right = ctx.parse('**-right-associative');
  testMathOperands(operator, left, right);
  if (typeof left !== typeof right) {
    throw new InterpreterError(`TypeError: ${typeof left} ${operator} ${typeof right}`);
  }
  return Math.pow(left, right);
};

infixRules['['] = (left, token, ctx) => parseInterval(left, token, ctx);

infixRules['.'] = (left, token, ctx) => {
  if (isObject(left)) {
    let key = ctx.require('identifier').value;
    if (left.hasOwnProperty(key)) {
      return left[key];
    }
    throw new InterpreterError('object has no property ' + key);
  }
  throw expectationError('infix: .', 'objects');
};

infixRules['('] =  (left, token, ctx) => {
  if (isFunction(left)) {
    return left.apply(null, parseList(ctx, ',', ')'));
  }
  throw expectationError('infix: f(args)', 'f to be function');
};

infixRules['=='] = infixRules['!='] = infixRules['<='] =
infixRules['>='] = infixRules['<'] =  infixRules['>']
  =  (left, token, ctx) => {
    let operator = token.kind;
    let right = ctx.parse(operator);
    testComparisonOperands(operator, left, right);
    switch (operator) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>':  return left > right;
      case '<':  return left < right;
      case '==': return isEqual(left, right);
      case '!=': return !isEqual(left, right);
      default:   throw new Error('no rule for comparison operator: ' + operator);
    }
  };

infixRules['||'] = infixRules['&&'] = (left, token, ctx) => {
  let operator = token.kind;
  let right = ctx.parse(operator);
  switch (operator) {
    case '||':  return isTruthy(left) || isTruthy(right);
    case '&&':  return isTruthy(left) && isTruthy(right);
    default:    throw new Error('no rule for boolean operator: ' + operator);
  }
};

infixRules['in'] = (left, token, ctx) => {
  let right = ctx.parse(token.kind);
  if (isObject(right)) {
    if (!isString(left)) {
      throw expectationError('Infix: in-object', 'string on left side');
    }
    right = Object.keys(right);
  } else if (isString(right)) {
    if (!isString(left)) {
      throw expectationError('Infix: in-string', 'string on left side');
    }
    // short-circuit to indexOf since this is a substring operation
    return right.indexOf(left) !== -1;
  } else if (!isArray(right)) {
    throw expectationError('Infix: in', 'Array, string, or object on right side');
  }

  return right.some(r => isEqual(left, r));
};

module.exports = new PrattParser({
  ignore: '\\s+', // ignore all whitespace including \n
  patterns: {
    number:     '[0-9]+(?:\\.[0-9]+)?',
    identifier: '[a-zA-Z_][a-zA-Z_0-9]*',
    string:     '\'[^\']*\'|"[^"]*"',
    // avoid matching these as prefixes of identifiers e.g., `insinutations`
    true: 'true(?![a-zA-Z_0-9])',
    false: 'false(?![a-zA-Z_0-9])',
    in: 'in(?![a-zA-Z_0-9])',
    null: 'null(?![a-zA-Z_0-9])',
  },
  tokens: [
    '**', ...'+-*/[].(){}:,'.split(''),
    '>=', '<=', '<', '>', '==', '!=', '!', '&&', '||',
    'true', 'false', 'in', 'null', 'number',
    'identifier', 'string',
  ],
  precedence: [
    ['||'],
    ['&&'],
    ['in'],
    ['==', '!='],
    ['>=', '<=', '<', '>'],
    ['+', '-'],
    ['*', '/'],
    ['**-right-associative'],
    ['**'],
    ['[', '.'],
    ['('],
    ['unary'],
  ],
  prefixRules,
  infixRules,
});
