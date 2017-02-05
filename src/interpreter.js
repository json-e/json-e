/*
* Author: Jonas Finnemann Jensen
* Github: https://github.com/jonasfj
*/
let PrattParser = require('./prattparser');
let ExtendableError = require('es6-error');

class InterpreterError extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'Interpreter Error';
  }
}

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
  if (!this.attempt('}')) {
    do {
      let k = this.require('id', 'string');
      this.require(':');
      let v = this.parse();
      obj[k] = v;
    } while (this.attempt(','));
    this.require('}');
  }
  return obj;
};

let parseInterval = (left, token, ctx) => {
  let a = null, b = null, isInterval = false;
  if (ctx.attempt(':')) {
    a = 0;
    isInterval = true;
    if (!(left instanceof Array)) {
      throw new InterpreterError('cannot perform interval access on non-array');
    }
    if (ctx.attempt(']')) {
      b = left.length;
    } else {
      b = ctx.parse();
    }
  } else {
    a = ctx.parse();
    if (ctx.attempt(':')) {
      isInterval = true;
      if (!(left instanceof Array)) {
        throw new InterpreterError('cannot perform interval access on non-array');
      }
      if (ctx.attempt(']')) {
        b = left.length;
      } else {
        b = ctx.parse();
      }
    }
  }

  ctx.attempt(']');
  return accessProperty(left, a, b, isInterval);
};

let accessProperty = (obj, a, b, isInterval) => {
  if (obj instanceof Array) {
    if (isInterval) {
      if (typeof a !== 'number' || typeof b !== 'number') {
        throw new InterpreterError('cannot perform interval access with non-integers');
      }
      return obj.slice(a, b);
    }

    if (typeof a !== 'number') {
      throw new InterpreterError('should access arrays using integers only');
    }

    // for -ve index access
    a = a < 0 ? (obj.length + a) % obj.length : a;
    return obj[a];   
  }

  // if we reach here it means we are accessing property value from object
  if (!obj.hasOwnProperty(a)) {
    throw new InterpreterError(`'${a}' not found in ${JSON.stringify(obj, null, '\t')}`);
  }

  if (a instanceof Object) {
    throw new InterpreterError('cannot use objects as keys');
  }
  return obj[a];
};

let compareNumbers = (left, operator, right) => {
  switch (operator) {
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '>':  return left > right;
    case '<':  return left < right;
    default:   throw new Error('no rule for comparison operator: ' + operator);
  }
};

let parseString = (str) => {
  if (str[0] === '"') {
    return str.replace('"', '\"').slice(1, -1);
  }
  return str.replace('\"', '"').slice(1, -1);
};

module.exports = new PrattParser({
  ignore: '\\s+', // ignore all whitespace including \n
  patterns: {
    number: '[0-9]+(?:\\.[0-9]+)?',
    id:     '[a-zA-Z_][a-zA-Z_0-9]*',
    string: '\'[^\']*\'|"[^"]*"',
  },
  tokens: [
    ...'+-*/[].(){}:,'.split(''),
    'number', 'true', 'false', 'id', 'string',
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
  prefixRules: {
    number: (token, ctx) => Number(token.value),
    '-':    (token, ctx) => - ctx.parse('unary'),
    '+':    (token, ctx) => ctx.parse('unary'),
    id:     (token, ctx) => ctx.context[token.value],
    '[':    (token, ctx) => ctx.parseList(',', ']'),
    '(':    (token, ctx) => {let v = ctx.parse(); ctx.require(')'); return v;},
    '{':    (token, ctx) => parseObject(ctx),
    string: (token, ctx) => parseString(token.value),
    true:   (token, context) => true,
    false:  (token, context) => false,
  },
  infixRules: {
    '+':        (left, token, ctx) => left + ctx.parse('+'),
    '-':        (left, token, ctx) => left - ctx.parse('-'),
    '*':        (left, token, ctx) => left * ctx.parse('*'),
    '/':        (left, token, ctx) => left / ctx.parse('/'),
    '[':        (left, token, ctx) => parseInterval(left, token, ctx),
    '.':        (left, token, ctx) => left[ctx.require('id').value],
    '(':        (left, token, ctx) => left.apply(null, parseList(ctx, ',', ')')),
    '==':       (left, token, ctx) => left === ctx.parse('=='),
    '!=':       (left, token, ctx) => left !== ctx.parse('!='),
    '<=':       (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('<=')),
    '>=':       (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('>=')),
    '<':        (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('<')),
    '>':        (left, token, ctx) => compareNumbers(left, token.value, ctx.parse('>')),
  },
});
