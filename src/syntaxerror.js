import ExtendableError from 'es6-error';

export default class SyntaxError extends ExtendableError {
  constructor(message, {start, end}) {
    super(message);
    this.name = 'SyntaxError';
    this.message = message;
    this.start = start;
    this.end = end;
  }
}
