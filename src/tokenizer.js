var assert = require('assert');
var {SyntaxError} = require('./error');

let escapeRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

let isRegEx = (re) => {
  if (typeof re !== 'string') {
    return false;
  }
  try {
    new RegExp(`^${re}$`);
  } catch (e) {
    return false;
  }
  return true;
};

let isNonCaptureRegex = (re) => {
  return isRegEx(re) && (new RegExp(`^(?:|${re})$`)).exec('').length === 1;
};

let indexOfNotUndefined = (a, start = 0) => {
  let n = a.length;
  for (let i = start; i < n; i++) {
    if (a[i] !== undefined) {
      return i;
    }
  }
  return -1;
};

class Tokenizer {
  constructor(options = {}) {
    options = Object.assign({}, {
      ignore: null,
      patterns: {},
      tokens: [],
    }, options);

    // Validate options
    assert(options.ignore === null || isNonCaptureRegex(options.ignore));
    assert(options.patterns instanceof Object);
    for (let pattern of Object.keys(options.patterns)) {
      assert(isNonCaptureRegex(options.patterns[pattern]));
    }
    assert(options.tokens instanceof Array);
    options.tokens.forEach(tokenName => assert(typeof tokenName === 'string'));

    // Build regular expression
    this._tokens = options.tokens;
    this._hasIgnore = options.ignore ? 1 : 0;
    this._regex = new RegExp('^(?:' + [
      this._hasIgnore ? `(${options.ignore})` : null,
      ...this._tokens.map(tokenName => {
        return `(${options.patterns[tokenName] || escapeRegex(tokenName)})`;
      }),
    ].filter(e => e !== null).join('|') + ')');
  }

  next(source, offset = 0) {
    let m, i;
    do {
      m = this._regex.exec(source.slice(offset));
      if (m === null) {
        // If not at end of input throw an error
        if (source.slice(offset) !== '') {
          throw new SyntaxError(`unexpected EOF for '${source}' at '${source.slice(offset)}'`,
            {start: offset, end: source.length});
        }
        return null;
      }
      i = indexOfNotUndefined(m, 1);
      offset += m[0].length;
    } while (this._hasIgnore && i === 1);
    return {
      kind:   this._tokens[i - 1 - this._hasIgnore],
      value:  m[i],
      start:  offset - m[0].length,
      end:    offset,
    };
  }

  tokenize(source, offset = 0) {
    let token = {end: offset};
    let tokens = [];
    while (token = this.next(source, token.end)) {
      tokens.push(token);
    }
    return tokens;
  }
}

// Export Tokenizer
module.exports = Tokenizer;
