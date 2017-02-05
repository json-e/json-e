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
  let begin, end;
  if (ctx.attempt(':')) {
    begin = 0;
    if (!(left instanceof Array)) {
      throw new InterpreterError('cannot perform interval access on non-array');
    }
    if (ctx.attempt(']')) {
      end = left.length;
    } else {
      end = ctx.parse();
    }
  } else {
    begin = ctx.parse();
    if (ctx.attempt(':')) {
      if (!(left instanceof Array)) {
        throw new InterpreterError('cannot perform interval access on non-array');
      }
      if (ctx.attempt(']')) {
        end = left.length;
      } else {
        end = ctx.parse();
      }
    }
  }

  if (begin !== undefined && end !== undefined) {
    if (typeof begin !== 'number' || typeof end !== 'number') {
      throw new InterpreterError('cannot perform interval access with non-integers');
    }
    ctx.attempt(']');
    return left.slice(begin, end);
  }
  // support for -ve index access
  if (typeof begin === 'number' && begin < 0) {
    begin = (left.length + begin) % left.length;
  }
  ctx.attempt(']');
  return left[begin];
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
  /*prefixRules: {
    'number': (token, ctx) => ['number', token.value],
    '-':      (token, ctx) => ['-', ctx.parse('unary')],
    '+':      (token, ctx) => ['+', ctx.parse('unary')],
    'id':     (token, ctx) => ['id:', token.value],
    '[':      (token, ctx) => ['list:', ctx.parseList(',', ']')],
    '(':      (token, ctx) => {let v = ctx.parse(); ctx.require(')'); return v;},
    '{':      (token, ctx) => ['obj:', parseObject(ctx)],
  },
  infixRules: {
    '+': (left, token, ctx) => [left, '+', ctx.parse('+')],
    '-': (left, token, ctx) => [left, '-', ctx.parse('-')],
    '*': (left, token, ctx) => [left, '*', ctx.parse('*')],
    '/': (left, token, ctx) => [left, '/', ctx.parse('/')],
    '[': (left, token, ctx) => {let v = ['access:', left, ctx.parse()]; ctx.require(']'); return v;},
    '.': (left, token, ctx) => ['access:', left, ctx.require('id').value],
    '(': (left, token, ctx) => ['apply:', left, parseList(ctx, ',', ')')],
  },*/
  
  prefixRules: {
    number: (token, ctx) => Number(token.value),
    '-':    (token, ctx) => - ctx.parse('unary'),
    '+':    (token, ctx) => ctx.parse('unary'),
    id:     (token, ctx) => ctx.context[token.value],
    '[':    (token, ctx) => ctx.parseList(',', ']'),
    '(':    (token, ctx) => {let v = ctx.parse(); ctx.require(')'); return v;},
    '{':    (token, ctx) => parseObject(ctx),
    string: (token, ctx) => token.value.slice(1, -1),
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
