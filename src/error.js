class JSONTemplateError extends Error {
  constructor(message) {
    super(message);
    this.location = [];
  }

  add_location(loc) {
    this.location.unshift(loc);
  }

  toString() {
    if (this.location.length) {
      return `${this.name} at template${this.location.join('')}: ${this.message}`;
    } else {
      return `${this.name}: ${this.message}`;
    }
  }
}

class SyntaxError extends JSONTemplateError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'SyntaxError';
  }
}

class BaseError extends JSONTemplateError {
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

module.exports = {JSONTemplateError, SyntaxError, InterpreterError, TemplateError, BuiltinError};
