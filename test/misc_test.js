var assume = require('assume');
var jsone = require('../src/');

suite('misc', function() {
  test('custom builtin', function() {
    let my_builtin = (x, y) => Math.sqrt(x * x + y * y);

    assume(jsone({$eval: 'my_builtin(3, 4)'}, {my_builtin})).eql(5);
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

  test('isJSON works', function() {
    let isJSON = require('../src/type-utils').isJSON;
    assume(isJSON('a')).eql(true);
    assume(isJSON(1)).eql(true);
    assume(isJSON(null)).eql(true);
    assume(isJSON([])).eql(true);
    assume(isJSON({})).eql(true);
    assume(isJSON(['a', 1, null, [true, [], {}], {x: { y: ['z']}}])).eql(true);
    assume(isJSON(() => {})).eql(false);
    assume(isJSON(['a', 1, null, [true, [], {}], {x: { y: [Symbol('z')]}}])).eql(false);
  });
});
