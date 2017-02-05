/*
* Author: Jonas Finnemann Jensen
* Github: https://github.com/jonasfj
*/

let Tokenizer = require('./tokenizer');
let SyntaxError = require('./syntaxerror');

let syntaxRuleError = (token, expects) => new SyntaxError(`Found '${token.value}' expected '${expects}'`, token);

class PrattParser {
  constructor(options = {}) {
    let {ignore, patterns, tokens,
         precedence, prefixRules, infixRules} = Object.assign({}, {
           ignore: null,
           patterns: {},
           tokens: [],
           precedence: [],
           prefixRules: {},
           infixRules: {},
         }, options);

    // creating map of kinds in precedence array
    let kindMap = {};
    precedence.forEach((row) => {
      row.forEach((kind) => {
        kindMap[kind] = true;
      });
    });

    // Ensure we have precedence for all the kinds used in infixRules
    for (let kind of Object.keys(infixRules)) {
      if (!kindMap[kind]) {
        throw new Error(`No prefix rule for kind '${kind}'`);
      }
    }

    this._tokenizer = new Tokenizer({ignore, patterns, tokens});

    this._precedenceMap = {}; // Map from string to precedence level
    precedence.forEach((row, i) => row.forEach(kind => {
      this._precedenceMap[kind] = i + 1;
    }));

    this._prefixRules = prefixRules;
    this._infixRules = infixRules;
  }

  parse(source, context = {}, offset = 0) {
    let ctx = new Context(this, source, context, offset);
    let result = ctx.parse();
    let eof;
    if (eof = ctx.attempt()) {
      throw syntaxRuleError(eof, 'end of input');
      //throw new Error('Expected end of input');
    }
    return result;
  }
};

class Context {
  constructor(parser, source, context = {}, offset = 0) {
    this._source = source;
    this._tokenizer = parser._tokenizer;
    this._precedenceMap = parser._precedenceMap;
    this._prefixRules = parser._prefixRules;
    this._infixRules = parser._infixRules;
    this._next = this._tokenizer.next(this._source, offset);
    this.context = context;
  }

  /**
   * Try to get the next token if it matches one of the kinds given, otherwise
   * return null. If no kinds are given returns the next of any kind.
   */
  attempt(...kinds) {
    let token = this._next;
    if (!token) {
      return null;
    }
    if (kinds.length > 0 && kinds.indexOf(token.kind) === -1) {
      return null;
    }
    this._next = this._tokenizer.next(this._source, token.end);
    return token;
  }

  /**
   * Get the next token, throw an error if it doesn't match one of the given
   * kinds or end of input. If no kinds are given returns the next of any kind.
   */
  require(...kinds) {
    let token = this.attempt();
    if (!token) {
      throw new Error('unexpected end of input');
    }
    if (kinds.length > 0 && kinds.indexOf(token.kind) === -1) {
      throw new Error('Unexpected token error');
    }
    return token;
  }

  parse(precedence = null) {
    precedence = precedence === null ? 0 : this._precedenceMap[precedence];
    let token = this.require();
    let prefixRule = this._prefixRules[token.kind];
    if (!prefixRule) {
      throw syntaxRuleError(token, Object.keys(this._prefixRules).join(', '));
    }
    let left = prefixRule(token, this);
    while (this._next && precedence < this._precedenceMap[this._next.kind] && this._infixRules[this._next.kind]) {
      let token = this.require();
      let infixRule = this._infixRules[token.kind];
      left = infixRule(left, token, this);
    }
    return left;
  }
}

// Export PrattParser
module.exports = PrattParser;
