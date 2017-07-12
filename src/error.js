var ExtendableError = require('es6-error');

class SyntaxError extends ExtendableError {
  constructor(message, {start, end}) {
    super(message);
    this.name = 'SyntaxError';
    this.message = message;
    this.start = start;
    this.end = end;
  }
}

class BaseError extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'BaseError';
  }
}

class InterpreterError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'InterpreterError';
  }
}

class TemplateError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'TemplateError';
  }
}

class BuiltinError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'BuiltinError';
  }
}

module.exports = {SyntaxError, InterpreterError, TemplateError, BuiltinError};
