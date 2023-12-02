var assume = require('assume');
var jsone = require('../src/');

suite('misc', function() {
  test('custom builtin', function() {
    let my_builtin = (x, y) => Math.sqrt(x * x + y * y);

    assume(jsone({$eval: 'my_builtin(3, 4)'}, {my_builtin})).eql(5);
  });

  test('non-object context is not allowed', function() {
    assume(() => jsone({}, "I am not an object")).throws(/must be an object/);
  });

  test('time doesn\'t change mid-evaluation (operator)', function() {
    let template = [...Array(1000).keys()].map(() => ({$fromNow: ''}));
    let result = new Set(jsone(template, {}));

    assume(result.size).eql(1);
  });

  test('time doesn\'t change mid-evaluation (builtin)', function() {
    let template = [...Array(1000).keys()].map(() => ({$eval: 'fromNow("")'}));
    let result = new Set(jsone(template, {}));

    assume(result.size).eql(1);
  });

  test('now builtin returns a string', function() {
    assume(typeof jsone({$eval: 'now'}, {})).eql(typeof 'string');
  });

  test('syntax error has correct type', function() {
    let jsoneSyntaxError = require('../src/error').SyntaxError;
    assume(() => jsone({$eval: 'this is not valid'}, {})).throws(jsoneSyntaxError);
  });

  test('templates can\'t evaluate to an uncalled custom builtin', function() {
    assume(() => jsone({$eval: 'custom'}, { custom: () => null })).throws();
  });

  test('Anything other than an object is not allowed for context', function() {
    assume(() => jsone({}, null)).throws();
    assume(() => jsone({}, false)).throws();
    assume(() => jsone({}, 3.2)).throws();
    assume(() => jsone({}, "two")).throws();
    assume(() => jsone({}, [{}])).throws();
  });

  test('Argument-less functions are OK', function() {
    let my_builtin = () => 42;
    assume(jsone({$eval: 'my_builtin()'}, {my_builtin})).eql(42);
  });
});
