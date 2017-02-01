/*
* Author: Jonas Finnemann Jensen
* Github: https://github.com/jonasfj
*/


var _ = require('lodash');


let parseList = (ctx, separator, terminator) => {
  let list = [];
  if (!ctx.try(terminator)) {
    do {
      list.push(ctx.parse());
    } while (ctx.try(separator));
    ctx.require(terminator);
  }
  return list;
}

let parseObject = (ctx) => {
  let obj = {};
  if (!this.try('}')) {
    do {
      let k = this.require('id', 'string');
      this.require(':');
      let v = this.parse();
      obj[k] = v;
    } while(this.try(','));
    this.require('}');
  }
  return obj;
}

module.exports = {
  ignore: '\\s+', // ignore all whitespace including \n
  patterns: {
    number: '[0-9]+(?:\\.[0-9]+)?',
    id:     '[a-zA-Z_][a-zA-Z_0-9]*',
    string: '\'[^\']*\'|"[^"]*"',
  },
  tokens: [
    ...'+-*/[].(){}:,'.split(''),
    'number', 'id', 'string',
    '==', '!=', '===', '!==',
    '<', '<=', '>', '>=',
  ],
  precedence: [
  	['==', '!='],
  	['<', '<=', '>', '>='],
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
    'number': (token, ctx) => Number(token.value),
    '-':      (token, ctx) => - ctx.parse('unary'),
    '+':      (token, ctx) => ctx.parse('unary'),
    'id':     (token, ctx) => ctx.context[token.value],
    '[':      (token, ctx) => ctx.parseList(',', ']'),
    '(':      (token, ctx) => {let v = ctx.parse(); ctx.require(')'); return v;},
    '{':      (token, ctx) => parseObject(ctx),
	'string': (token, ctx) => _.trim(_.trim(token.value, '\''), '"'),
  },
  infixRules: {
    '+': (left, token, ctx) => left + ctx.parse('+'),
    '-': (left, token, ctx) => left - ctx.parse('-'),
    '*': (left, token, ctx) => left * ctx.parse('*'),
    '/': (left, token, ctx) => left / ctx.parse('/'),
    '[': (left, token, ctx) => {let v = left[ctx.parse()]; ctx.require(']'); return v;},
    '.': (left, token, ctx) => left[ctx.require('id').value],
    '(': (left, token, ctx) => left.apply(null, parseList(ctx, ',', ')')),
    '==': (left, token, ctx) => left === ctx.parse('=='),
    '!=': (left, token, ctx) => left !== ctx.parse('!='),
    '<': (left, token, ctx) => left < ctx.parse('<'),
    '<=': (left, token, ctx) => left <= ctx.parse('<='),
    '>': (left, token, ctx) => left > ctx.parse('>'),
    '>=': (left, token, ctx) => left >= ctx.parse('>='),
  },
}
