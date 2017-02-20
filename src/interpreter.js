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
      if (k.kind === 'string') {
        k.value = parseString(k.value);
      }
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
    return left[a];
  }
  throw new InterpreterError('cannot use non strings/numbers as keys');
};

let parseString = (str) => {
  if (str[0] === '"') {
    return str.replace('"', '\"').slice(1, -1);
  }
  return str.replace('\"', '"').slice(1, -1);
};

let tetsComparisonOperands = (operator, left, right) => {

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

let testMathOperand = (operator, operand) => {
  if (operator === '+' && !(isNumber(operand) || isString(operand))) {
    throw expectationError('infix: +', 'number/string + number/string'); 
  } 
  if (['-', '*', '/'].some(v => v === operator) && !isNumber(operand)) {
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
  testLogicalOperand('!', operand);
  return !operand;
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
  = (left, token, ctx) => {
    testMathOperand(token.value, left);
    let right = ctx.parse(token.value);
    testMathOperand(token.value, right);
    if (typeof left !== typeof right) {
      throw new InterpreterError(`TypeError: ${typeof left} ${token.value} ${typeof right}`);
    }
    switch (token.value) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      default: throw new Error(`unknown infix operator: '${operator}'`);
    }
  };

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

infixRules['=='] = infixRules['!='] = infixRules['<='] = 
infixRules['>='] = infixRules['<'] =  infixRules['>'] 
  =  (left, token, ctx) => {
    let operator = token.value;
    let right = ctx.parse(operator);
    tetsComparisonOperands(operator, left, right);
    switch (operator) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>':  return left > right;
      case '<':  return left < right;
      case '==': return left === right;
      case '!=': return left !== right;
      default:   throw new Error('no rule for comparison operator: ' + operator);
    }
  };

infixRules['||'] = infixRules['&&'] = (left, token, ctx) => {
  let operator = token.value;
  let right = ctx.parse(operator);
  testLogicalOperand(operator, left);
  testLogicalOperand(operator, right);
  switch (operator) {
    case '||':  return left || right;
    case '&&':  return left && right;
    default:    throw new Error('no rule for boolean operator: ' + operator);
  }
};

infixRules['in'] = (left, token, ctx) => {
  let right = ctx.parse('in');
  if (isObject(right) && !isArray(right)) {
    right = Object.keys(right);
  }

  if (!(isArray(right) || isString(right))) {
    throw expectationError('Infix: in', 'array/string/object to perform lookup');
  }

  return right.indexOf(left) !== -1;
};

module.exports = new PrattParser({
  ignore: '\\s+', // ignore all whitespace including \n
  patterns: {
    number:     '[0-9]+(?:\\.[0-9]+)?',
    identifier: '[a-zA-Z_][a-zA-Z_0-9]*',
    string:     '\'[^\']*\'|"[^"]*"',
  },
  tokens: [
    ...'+-*/[].(){}:,'.split(''),
    '>=', '<=', '<', '>', '==', '!=', '!', '&&', '||',
    'true', 'false', 'in', 'number', 'identifier', 'string',
  ],
  precedence: [
    ['in'],
    ['||'],
    ['&&'],
  	['==', '!='],
  	['>=', '<=', '<', '>'],
    ['+', '-'],
    ['*', '/'],
    ['[', '.'],
    ['('],
    ['unary'],
  ],
  prefixRules,
  infixRules,
});
