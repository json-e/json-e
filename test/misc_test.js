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
    assume(typeof jsone({$eval: 'now'}, {})).eql(typeof "string");
  });
});
