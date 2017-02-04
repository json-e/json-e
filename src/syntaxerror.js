let ExtendableError = require('es6-error');

class SyntaxError extends ExtendableError {
  constructor(message, token) {
    super(message);
    this.message = message;
    this.start = token.start;
    this.end = token.end;
    this.name = 'SyntaxError';
  }
}

module.exports = SyntaxError;
