var assume = require('assume');
var jsone = require('../src/');

suite('misc', function() {
  test('custom builtin', function() {
    let my_builtin = (x, y) => Math.sqrt(x * x + y * y);

    assume(jsone({$eval: 'my_builtin(3, 4)'}, {my_builtin})).eql(5);
  });
});
