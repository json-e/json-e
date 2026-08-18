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

  test('by(__proto__) cannot be used to look up unrelated identifiers like constructor', function() {
    let func = () => "foobar";

    let template = {
      $let: {"hasOwn${'Property'}": {$eval: 'func'}},
      in: {
        $sort: [{$eval: 'func'}],
        "by(__proto__)": 'constructor("return 42")()',
      },
    };

    assume(() => jsone(template, {func})).throws(/unknown context value constructor/);
  });

  test('identifier lookup ignores a context value named hasOwnProperty', function() {
    let func = () => "foobar";

    assume(() => jsone({$eval: 'constructor'}, {hasOwnProperty: func}))
      .throws(/unknown context value constructor/);
    assume(() => jsone({$eval: 'toString'}, {hasOwnProperty: func}))
      .throws(/unknown context value toString/);
  });

  test('by(__proto__) does not affect state outside the sort', function() {
    jsone({$sort: [{a: 1}, {a: 2}], 'by(__proto__)': '__proto__.a'}, {});

    assume(({}).a).equals(undefined);
    assume(Object.prototype.a).equals(undefined);
  });

  test('interpolated __proto__ result key is an ordinary property', function() {
    let result = jsone({"__pro${e}to__": {$eval: '1 + 1'}}, {e: ''});

    assume(Object.prototype.hasOwnProperty.call(result, '__proto__')).equals(true);
    assume(result.__proto__).equals(2);
    assume(Object.getPrototypeOf(result)).equals(Object.prototype);
  });

  test('the defined builtin only sees real context keys', function() {
    let func = () => "foobar";
    assume(jsone({$eval: 'defined("constructor")'}, {hasOwnProperty: func})).equals(false);
  });

  test('each(__proto__) cannot be used to look up unrelated identifiers like constructor', function() {
    let func = () => "foobar";

    let template = {
      $let: {"hasOwn${'Property'}": {$eval: 'func'}},
      in: {
        $map: [{$eval: 'func'}],
        "each(__proto__)": {$eval: 'constructor("return 42")()'},
      },
    };

    assume(() => jsone(template, {func})).throws(/unknown context value constructor/);
  });

  test('__proto__ as an each() binding behaves like any other identifier', function() {
    assume(jsone({$map: [1, 2, 3], 'each(__proto__)': {$eval: '__proto__ + 1'}}, {})).eql([2, 3, 4]);
    assume(jsone(
      {$reduce: [1, 2, 3], initial: 0, 'each(a, __proto__)': {$eval: 'a + __proto__'}}, {},
    )).equals(6);
    assume(jsone({$find: [1, 2, 3], 'each(__proto__)': '__proto__ > 1'}, {})).equals(2);

    assume(({}).a).equals(undefined);
    assume(Object.prototype.a).equals(undefined);
  });

  test('__proto__ as a by() binding behaves like any other identifier', function() {
    assume(jsone({$sort: [3, 1, 2], 'by(__proto__)': '__proto__'}, {})).eql([1, 2, 3]);
  });

  test('__proto__ as a $let variable name is an ordinary binding', function() {
    let template = JSON.parse('{"$let": {"__proto__": 5}, "in": {"$eval": "__proto__ + 1"}}');
    assume(jsone(template, {})).equals(6);
  });

  test('$merge preserves a literal __proto__ key without touching the real prototype', function() {
    let template = JSON.parse('{"$merge": [{"__proto__": 1}, {"a": 2}]}');
    let result = jsone(template, {});

    assume(Object.keys(result).sort()).eql(['__proto__', 'a']);
    assume(result.__proto__).equals(1);
    assume(result.a).equals(2);
    assume(Object.getPrototypeOf(result)).equals(Object.prototype);
  });

  test('__proto__ in an expression object literal is an ordinary key', function() {
    for (let expr of ['{"__proto__": 1, "a": 2}', '{__proto__: 1, a: 2}']) {
      let result = jsone({$eval: expr}, {});

      assume(Object.keys(result)).eql(['__proto__', 'a']);
      assume(result.__proto__).equals(1);
      assume(result.a).equals(2);
      assume(Object.getPrototypeOf(result)).equals(Object.prototype);
    }
  });

  test('$mergeDeep preserves a literal __proto__ key without touching the real prototype', function() {
    let template = JSON.parse('{"$mergeDeep": [{"__proto__": {"x": 1}}, {"__proto__": {"y": 2}}]}');
    let result = jsone(template, {});

    assume(Object.keys(result)).eql(['__proto__']);
    assume(result.__proto__).eql({x: 1, y: 2});
    assume(Object.getPrototypeOf(result)).equals(Object.prototype);
  });
});
