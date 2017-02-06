/*
* Author: Jonas Finnemann Jensen
* Github: https://github.com/jonasfj
*/
let PrattParser = require('./prattparser');
let ExtendableError = require('es6-error');
let {isString, isNumber, isBool, 
  isArray, isObject, isFunction} = require('./type-utils');

class InterpreterError extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'InterpreterError';
  }
}

let expectationError = (operator, expectation) => new InterpreterError(`'${operator}' expects '${expectation}'`);

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
      ctx.require(':');
      let v = ctx.parse();
      obj[k.value] = v;
    } while (ctx.attempt(','));
    ctx.require('}');
  }
  return obj;
};

let parseInterval = (left, token, ctx) => {
  let a = null, isInterval = false;
  if (ctx.attempt(':')) {
    a = 0;
    isInterval = true;
  } else {
    a = ctx.parse();
    if (ctx.attempt(':')) {
      isInterval = true;
    }
  }

  return accessProperty(ctx, left, a, isInterval);
};

let accessProperty = (ctx, left, a, isInterval) => {
  let b = null;
  if (isArray(left)) {
    if (isInterval) {
      if (ctx.attempt(']')) {
        b = left.length;
      } else {
        b = ctx.parse();
        ctx.require(']');
      }
      if (!isNumber(a) || !isNumber(b)) {
        throw new InterpreterError('cannot perform interval access with non-integers');
      }
      return left.slice(a, b);
    }

    if (!isNumber(a)) {
      throw new InterpreterError('should access arrays using integers only');
    }

    // for -ve index access
    a = a < 0 ? (left.length + a) % left.length : a;
    ctx.require(']');
    return left[a];  
  }

  // if we reach here it means we are accessing property value from object
  if (!isObject(left)) {
    throw new InterpreterError('cannot access properties from non-objects');
  }

  if (!left.hasOwnProperty(a)) {
    throw new InterpreterError(`'${a}' not found in ${JSON.stringify(left, null, '\t')}`);
  }

  if (isString(a)) {
    ctx.require(']');
    return left[a];
  }
  throw new InterpreterError('cannot use objects as keys');
};

let compareNumbers = (left, operator, right) => {
  let valid = isNumber(left) && isNumber(right) || isString(left) && isString(right);
  if (valid) {
    switch (operator) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>':  return left > right;
      case '<':  return left < right;
      default:   throw new Error('no rule for comparison operator: ' + operator);
    }
  }
  throw expectationError(`infix: ${operator}`, `numbers/strings ${operator} numbers/strings`);
};

let parseString = (str) => {
  if (str[0] === '"') {
    return str.replace('"', '\"').slice(1, -1);
  }
  return str.replace('\"', '"').slice(1, -1);
};

let testOperand = (operator, operand) => {
  if (operator === '+') {
    if (!(isNumber(operand) || isString(operand))) {
      throw expectationError('infix: +', 'number/string + number/string'); 
    }
    return;
  } else if (['-', '*', '/'].some(v => v === operator)) {
    if (!isNumber(operand)) {
      throw expectationError(`infix: ${operator}`, `number ${operator} number`);
    }
    return;
  }

  throw new Error(`unknown infix operator: '${operator}'`);
};

let applyMathOperator = (left, token, ctx) => {
  testOperand(token.value, left);
  let right = ctx.parse(token.value);
  testOperand(token.value, right);

  switch (token.value) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    default: throw new Error(`unknown infix operator: '${operator}'`);
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

prefixRules['-'] = (token, ctx) => {
  let v = ctx.parse('unary');
  let result = -v;
  if (isNaN(result)) {
    throw expectationError('unary: -', 'number');
  }
  return result;
};

prefixRules['+'] = (token, ctx) => {
  let v = ctx.parse('unary');
  let result = +v;
  if (isNaN(result)) {
    throw expectationError('unary: +', 'number');
  }
  return result;
};

prefixRules['identifier'] = (token, ctx) => {
  if (ctx.context.hasOwnProperty(token.value)) {
    return ctx.context[token.value];
  }
  throw new InterpreterError('can access own properties of objects');
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
  = (left, token, ctx) => applyMathOperator(left, token, ctx);

infixRules['['] = (left, token, ctx) => parseInterval(left, token, ctx);

infixRules['.'] = (left, token, ctx) => {
  if (isObject(left)) {
    let key = ctx.require('identifier').value;
    if (left.hasOwnProperty(key)) {
      return left[key];
    }
    throw new InterpreterError('can access own properties of objects');
  }
  throw expectationError('infix: .', 'objects');
};

infixRules['('] =  (left, token, ctx) => {
  if (isFunction(left)) {
    return left.apply(null, parseList(ctx, ',', ')'));
  }
  throw expectationError('infix: f(args)', 'f to be function');
};

infixRules['=='] = (left, token, ctx) => left === ctx.parse('==');
infixRules['!='] = (left, token, ctx) => left !== ctx.parse('!=');
infixRules['<='] = (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('<='));
infixRules['>='] = (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('>='));
infixRules['<'] =  (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('<'));
infixRules['>'] =  (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('>'));

module.exports = new PrattParser({
  ignore: '\\s+', // ignore all whitespace including \n
  patterns: {
    number:     '[0-9]+(?:\\.[0-9]+)?',
    identifier: '[a-zA-Z_][a-zA-Z_0-9]*',
    string:     '\'[^\']*\'|"[^"]*"',
  },
  tokens: [
    ...'+-*/[].(){}:,'.split(''),
    'number', 'true', 'false', 'identifier', 'string',
    '>=', '<=', '<', '>', '==', '!=',
  ],
  precedence: [
  	['==', '!='],
  	['>=', '<=', '<', '>'],
    ['+', '-'],
    ['*', '/'],
    ['[', '.'],
    ['('],
    ['unary'],
  ],
  prefixRules: prefixRules,
  infixRules: infixRules,
});
