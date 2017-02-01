suite('Parameterize', function() {
  var assume = require('assume');
  var parameterize = require('../lib/index.js');
  var tk = require('timekeeper');

  var date = new Date('2017-01-19T16:27:20.974Z');

  var parser = require('../lib/parser/prattparser');

  function min(a, b) {
    if (a < b) {
      return a;
    }
    return b;
  }

  function max(a, b) {
    if (a < b) {
      return b;
    }
    return a;
  }

  suite('simple expression language', function() {
    test('addition', function() {
      var src = 'a + b + 7';
      var context = {a: 1, b: 2};
      assume(parser.parse(src, context)).equals(10);
    });

    test('multiplication', function() {
      var src = 'a * b * 3';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals(18);
    });

    test ('division (1)', function() {
      var src = 'a / b';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals(3 / 2);
    });

    test ('division (2)', function() {
      var src = 'a / b';
      var context = {a: 3.0, b: 2.0};
      assume(parser.parse(src, context)).equals(3.0 / 2.0);
    });

    test ('division (3)', function() {
      var src = 'b / a';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals(2 / 3);
    });

    test ('division (4)', function() {
      var src = 'b / a';
      var context = {a: 3.0, b: 2.0};
      assume(parser.parse(src, context)).equals(2.0 / 3.0);
    });

    test('string concatenation (1)', function() {
      var src = '"a" + "b"';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals('ab');
    });

    test('string concatenation (2)', function() {
      var src = '"a" + b';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals('a2');
    });

    test('string concatenation (3)', function() {
      var src = '"" + a + b';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals('32');
    });

    test('string concatenation (4)', function() {
      var src = '"  " + (a + b)';
      var context = {a: 3, b: 2};
      assume(parser.parse(src, context)).equals('  5');
    });

    test('property access (1)', function() {
      var context = {key: 1};
      var src = 'key';
      assume(parser.parse(src, context)).equals(1);
    });

    test('property access (2)', function() {
      var context = {key: 'a'};
      var src = 'key';
      assume(parser.parse(src, context)).equals('a');
    });

    test('property access (3)', function() {
      var context = {key: true};
      var src = 'key';
      assume(parser.parse(src, context)).equals(true);
    });

    test('property access (4)', function() {
      var context = {key: {a: 1}};
      var src = 'key';
      assume(parser.parse(src, context)).deep.equals({a: 1});
    });

    test('nested property access (1)', function() {
      var context = {key: {key2: {key3: {a: 1}}}};
      var src = 'key.key2.key3';
      assume(parser.parse(src, context)).deep.equals({a: 1});
    });

    test('nested property access (2)', function() {
      var context = {key: {key2: {key3: {a: 1}}}};
      var src = 'key["key2"]["key3"]';
      assume(parser.parse(src, context)).deep.equals({a: 1});
    });

    test('array access (1)', function() {
      var context = {key: [1, 2, 3, 4, 5]};
      var src = 'key[0]';
      assume(parser.parse(src, context)).equals(1);
    });

    test('array access (2)', function() {
      var context = {key: [1, 2, 3, 4, 5]};
      var src = 'key[2]';
      assume(parser.parse(src, context)).equals(3);
    });

    test('array access (3)', function() {
      var context = {key: [1, 2, 3, 4, 5]};
      var src = 'key[0] + key[1] + key[2] + key[3] + key[4]';
      assume(parser.parse(src, context)).equals(15);
    });

    test('nested array access (1)', function() {
      var context = {key: {key2: {key3: [1, 2, 3, 4, 5]}}};
      var src = 'key.key2.key3[0]';
      assume(parser.parse(src, context)).equals(1);
    });

    test('nested array access (2)', function() {
      var context = {key: {key2: {key3: [1, 2, 3, 4, 5]}}};
      var src = 'key["key2"]["key3"][0]';
      assume(parser.parse(src, context)).equals(1);
    });

    test('nested array access (3)', function() {
      var context = {key: {key2: {key3: [1, 2, 3, 4, 5]}}};
      var src = 'key.key2.key3[2]';
      assume(parser.parse(src, context)).equals(3);
    });

    test('nested array access (4)', function() {
      var context = {key: {key2: {key3: [1, 2, 3, 4, 5]}}};
      var src = 'key["key2"]["key3"][2]';
      assume(parser.parse(src, context)).equals(3);
    });

    test('nested array access (5)', function() {
      var context = {key: {key2: {key3: [1, 2, 3, 4, 5]}}};
      var src = 'key.key2.key3[0] + key.key2.key3[1] \
      + key.key2.key3[2] + key.key2.key3[3] + key.key2.key3[4]';
      assume(parser.parse(src, context)).equals(15);
    });

    test('nested array access (6)', function() {
      var context = {key: {key2: {key3: [1, 2, 3, 4, 5]}}};
      var src = 'key["key2"]["key3"][0] + key["key2"]["key3"][1] \
      + key["key2"]["key3"][2] + key["key2"]["key3"][3] + key["key2"]["key3"][4]';
      assume(parser.parse(src, context)).equals(15);
    });

    test('function call (1)', function() {
      var src = 'min(a, b)';
      var context = {a: 3, b: 2, min: min};
      assume(parser.parse(src, context)).equals(2);
    });

    test('function call (2)', function() {
      var src = 'min(1, b)';
      var context = {a: 3, b: 2, min: min};
      assume(parser.parse(src, context)).equals(1);
    });

    test('function call (3)', function() {
      var src = 'min(a, 1)';
      var context = {a: 3, b: 2, min: min};
      assume(parser.parse(src, context)).equals(1);
    });

    test('function call (4)', function() {
      var src = 'min(1, 2)';
      var context = {a: 3, b: 2, min: min};
      assume(parser.parse(src, context)).equals(1);
    });

    test('nested function call (1)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key.key2.key3(a, b)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (2)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key["key2"]["key3"](a, b)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (3)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key.key2.key3(3, b)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (4)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key["key2"]["key3"](3, b)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (5)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key.key2.key3(a, 2)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (6)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key["key2"]["key3"](a, 2)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (7)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key.key2.key3(3, 2)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('nested function call (8)', function() {
      var context = {a: 3, b: 2, key: {key2: {key3: min}}};
      var src = 'key["key2"]["key3"](3, 2)';
      assume(parser.parse(src, context)).equals(2);
    });

    test('equality (1)', function() {
      var src = '1 == 1';
      assume(parser.parse(src, {})).equals(true);
    });

    test('equality (2)', function() {
      var src = '1 == 2';
      assume(parser.parse(src, {})).equals(false);
    });

    test('equality (3)', function() {
      var context = {a: 1, b: 1};
      var src = 'a == b';
      assume(parser.parse(src, context)).equals(true);
    });

    test('equality (4)', function() {
      var context = {a: 1, b: 2};
      var src = 'a == b';
      assume(parser.parse(src, context)).equals(false);
    });

    test('in-equality (1)', function() {
      var src = '1 != 1';
      assume(parser.parse(src, {})).equals(false);
    });

    test('in-equality (2)', function() {
      var src = '1 != 2';
      assume(parser.parse(src, {})).equals(true);
    });

    test('in-equality (3)', function() {
      var context = {a: 1, b: 1};
      var src = 'a != b';
      assume(parser.parse(src, context)).equals(false);
    });

    test('in-equality (4)', function() {
      var context = {a: 1, b: 2};
      var src = 'a != b';
      assume(parser.parse(src, context)).equals(true);
    });

    test('less than (1)', function() {
      var src = '1 < 2';
      assume(parser.parse(src, {})).equals(true);
    });

    test('less than (2)', function() {
      var src = '2 < 1';
      assume(parser.parse(src, {})).equals(false);
    });

    test('less than (3)', function() {
      var src = '"a" < "b"';
      assume(parser.parse(src, {})).equals(true);
    });

    test('less than (4)', function() {
      var src = '"b" < "a"';
      assume(parser.parse(src, {})).equals(false);
    });

    test('less than (5)', function() {
      var context = {a: 1, b: 2};
      var src = 'a < b';
      assume(parser.parse(src, context)).equals(true);
    });

    test('less than (6)', function() {
      var context = {a: 1, b: 2};
      var src = 'b < a';
      assume(parser.parse(src, context)).equals(false);
    });

    test('greater than (1)', function() {
      var src = '2 > 1';
      assume(parser.parse(src, {})).equals(true);
    });

    test('greater than (2)', function() {
      var src = '1 > 2';
      assume(parser.parse(src, {})).equals(false);
    });

    test('greater than (3)', function() {
      var src = '"b" > "a"';
      assume(parser.parse(src, {})).equals(true);
    });

    test('greater than (4)', function() {
      var src = '"a" > "b"';
      assume(parser.parse(src, {})).equals(false);
    });

    test('greater than (5)', function() {
      var context = {a: 1, b: 2};
      var src = 'b > a';
      assume(parser.parse(src, context)).equals(true);
    });

    test('greater than (6)', function() {
      var context = {a: 1, b: 2};
      var src = 'a > b';
      assume(parser.parse(src, context)).equals(false);
    });
  });
  suite('json-e constructs', function() {
    suite('non deep property access', function() {
      test('with property access', function() {
        var template = {id: '${ clientId }'};
        var context = {clientId: '123'};
        assume(parameterize(template, context)).deep.equals({id: '123'});
      });

      test('with array access', function() {
        var template = {id: '${ arr[0] }', name: '${ arr[2] }', count: '${ arr[1] }'};
        var context = {arr: ['123', 248, 'doodle']};
        assume(parameterize(template, context)).deep.equals({id: '123', name: 'doodle', count: '248'}); 
      });

      test('function evaluation', function() {
        var template = {
          name: '${ func("jim") }',
          username: '${ func(a) }',
        };
        var context = {
          a: 'foobar',
          func: function(value) {
            return value;
          },
        };
        assume(parameterize(template, context)).deep.equals({name: 'jim', username: 'foobar'});
      });

      test('Modify string', function() {
        var template = {
          key1:     '${ toUpper( "hello world") }',
          key2:     '${  toLower(toUpper("hello world"))   }',
          key3:     '${   toLower(  toUpper(  text))  }',
        };
        var context = {
          toUpper: function(text) {
            return text.toUpperCase();
          },
          toLower: function(text) {
            return text.toLowerCase();
          },
          text: 'hello World',
        };
        var output = {
          key1:     'HELLO WORLD',
          key2:     'hello world',
          key3:     'hello world',
        };
        assume(parameterize(template, context)).deep.equals(output);
      });

      test('do not evaluate numbers', function() {
        let template = {a: {b: 1}};
        let context = {};
        assume(parameterize(template, context)).deep.equals(template);
      });

      test('do no evaluate simple strings', function() {
        let template = {a: {b: '1'}};
        let context = {};
        assume(parameterize(template, context)).deep.equals(template);
      });
    });

    suite('deep propert access', function() {
      test('with deep array access', function() {
        var template = {image_version: '${task.images[0].versions[0]}', name: '${task.images[0].name}'};
        var context = {
          task: {
            images: [{versions: ['12.10'], name: 'ubuntu'}],
          },
        };
        assume(parameterize(template, context)).deep.equals({image_version: '12.10', name: 'ubuntu'});
      });
    });

    suite('non parameterized json template', function() {
      test('empty template', function() {
        var template = {};
        var context = {};
        assume(parameterize(template, context)).deep.equals({});
      });

      test('non parameterized template', function() {
        var template = {a: {b: {c: {d: 1}}}};
        var context = {};
        assume(parameterize(template, context)).deep.equals(template);
      });
    });

    suite('constructs', function() {
      test('if -> then non-deep', function() {
        var template = {
          a: {
            $if: '1 < 2',
            $then: 'a',
            $else: 'b',
          },
        };
        var context = {};
        assume(parameterize(template, context)).deep.equals({a: 'a'});
      });

      test('if -> else non-deep', function() {
        var template = {
          a: {
            $if: '1 > 2',
            $then: 'a',
            $else: 'b',
          },
        };
        var context = {};
        assume(parameterize(template, context)).deep.equals({a: 'b'});
      });

      test('if -> then deep', function() {
        var template = {
          b: {a: {
            $if: '1 < 2',
            $then: 'a',
            $else: 'b',
          }},
        };
        var context = {};
        assume(parameterize(template, context)).deep.equals({b : {a: 'a'}});
      });

      test('if -> else deep', function() {
        var template = {
          b: {a: {
            $if: '1 > 2',
            $then: 'a',
            $else: 'b',
          }},
        };
        var context = {};
        assume(parameterize(template, context)).deep.equals({b: {a: 'b'}});
      });

      test('switch with only one option', function() {
        var template = {
          a: {
            $switch: '"case" + a',
            case1: 'foo',
          }};
        var context = {a: '1'};
        assume(parameterize(template, context)).deep.equals({a: 'foo'});
      });

      test('switch with multiple options', function() {
        var template = {
          a: {
            $switch: '"case" + b',
            case1: 'foo',
            case2: 'bar',
          }};
        var context = {a: '1', b: '2'};
        assume(parameterize(template, context)).deep.equals({a: 'bar'});
      });

      test('eval with multiple function evaluations', function() {
        var template = {
          value: [
            {$eval: 'func(0)'},
            {$eval: 'func(0)'},
            {$eval: 'func(-1)'},
            {$eval: 'func(-2)'},
            {$eval: 'func(0)'},
            {$eval: 'func(0)'},
            {$eval: 'func(0)'},
            {$eval: 'func(0)'},
            {$eval: 'func(0)'},
            {$eval: 'func(1+1)'},
          ],
        };
        var i = 0;
        var context = {
          func:  function(x) { i += 1; return x + i; },
        };
        var output = {
          value: [1, 2, 2, 2, 5, 6, 7, 8, 9, 12],
        };
        assume(parameterize(template, context)).deep.equals(output);
      });

      test('nested if (then --> then) construct', function() {
        var template = {
          val: {
            $if: 'key1 > key2',
            $then: {
              b: {
                $if: 'key3 > key4',
                $then: '${ foo }',
                $else: '${ bar }',
              },
            },
            $else: {b: 'failed'},
          },
        };

        var context = {key1: 2, key2: 1, key3: 4, key4: 3, foo: 'a', bar: 'b'};
        assume(parameterize(template, context)).deep.equals({val: {b: 'a'}});
      });

      test('nested if (else --> else) construct', function() {
        var template = {
          val: {
            $if: 'key1 < key2',
            $else: {
              b: {
                $if: 'key3 < key4',
                $then: '${ foo }',
                $else: '${ bar }',
              },
            },
            $then: {b: 'failed'},
          },
        };

        var context = {key1: 2, key2: 1, key3: 4, key4: 3, foo: 'a', bar: 'b'};
        assume(parameterize(template, context)).deep.equals({val: {b: 'b'}});
      });

      test('nested if (then --> else) construct', function() {
        var template = {
          val: {
            $if: 'key1 > key2',
            $then: {
              b: {
                $if: 'key3 < key4',
                $then: '${ foo }',
                $else: '${ bar }',
              },
            },
            $else: {b: 'failed'},
          },
        };

        var context = {key1: 2, key2: 1, key3: 4, key4: 3, foo: 'a', bar: 'b'};
        assume(parameterize(template, context)).deep.equals({val: {b: 'b'}});
      });

      test('nested if (else --> then) construct', function() {
        var template = {
          val: {
            $if: 'key1 < key2',
            $else: {
              b: {
                $if: 'key3 > key4',
                $then: '${ foo }',
                $else: '${ bar }',
              },
            },
            $then: {b: 'failed'},
          },
        };

        var context = {key1: 2, key2: 1, key3: 4, key4: 3, foo: 'a', bar: 'b'};
        assume(parameterize(template, context)).deep.equals({val: {b: 'a'}});
      });

      test('nested if (else --> then ---> else) construct', function() {
        var template = {
          val: {
            $if: 'key1 < key2',
            $else: {
              b: {
                $if: 'key3 > key4',
                $then: {
                  c: {
                    $if: 'key5 < key6',
                    $then: 'abc',
                    $else: '${ bar }',
                  },
                },
                $else: 'follow',
              },
            },
            $then: {b: 'failed'},
          },
        };

        var context = {key1: 2, key2: 1, key3: 4, key4: 3, key5: 6, key6: 5, foo: 'a', bar: 'b'};
        assume(parameterize(template, context)).deep.equals({val: {b: {c: 'b'}}});
      });
      test('if ($then) with $eval', function() {
        var template = {
          a: {
            b: {
              $if: '2 < 3',
              $then: {$eval: 'one()'},
              $else: {$eval: 'two()'},
            }}};
        var context = {
          one: () => 1,
          two: () => 2,
        };
        assume(parameterize(template, context)).deep.equals({a:{b:1}});
      });
      test('if (else) with $eval', function() {
        var template = {
          a: {
            b: {
              $if: '2 > 3',
              $then: {$eval: 'one()'},
              $else: {$eval: 'two()'},
            }}};
        var context = {
          one: () => 1,
          two: () => 2,
        };
        assume(parameterize(template, context)).deep.equals({a:{b:2}});
      });

      test('simple $eval with simple value', function() {
        var template = {a: {b: {$eval: '1'}}};
        var context = {};
        assume(parameterize(template, context)).deep.equals({a:{b:1}});
      });

      test('simple $eval with function evaluation', function() {
        var template = {a: {b: {$eval: 'one()'}}};
        var context = {
          one: () => 1,
          two: () => 2,
        };
        assume(parameterize(template, context)).deep.equals({a:{b:1}});
      });

      test('simple $eval with object nested replacement', function() {
        var template = {a: {b: {$eval: 'a.b'}}};
        var context = {
          a: {
            b: {
              c: {
                d: 1,
              },
            },
          },
        };
        assume(parameterize(template, context)).deep.equals({a:{b:{c:{d:1}}}});
      });

      test('switch case where case is an object', function() {
        var template = {
          a: {
            $switch: '"case" + a',
            caseA: {b:1},
          }};
        var context = {a: 'A'};
        assume(parameterize(template, context)).deep.equals({a: {b: 1}});
      });

      test('switch case where case is an interpolation statement', function() {
        var template = {
          a: {
            $switch: '"case" + a',
            caseA: '${ a }',
          }};
        var context = {a: 'A'};
        assume(parameterize(template, context)).deep.equals({a: 'A'});
      });

      test('switch case where case is $eval', function() {
        var template = {
          a: {
            $switch: '"case" + a',
            caseA: {$eval: 'obj'},
          }};
        var context = {a: 'A', obj: {b:1}};
        assume(parameterize(template, context)).deep.equals({a: {b:1}});
      });
    });

    suite('$fromNow suite', function() {
      
      test('$fromNow', function() {
        tk.freeze(date);
        var template = {time: {$fromNow: ''}};
        var context = {};
        assume(parameterize(template, context)['time']).equals('2017-01-19T16:27:20.974Z');
        tk.reset();
      });
      
      test('$fromNow 2 days 3 hours', function() {
        tk.freeze(date);
        var template = {time: {$fromNow: '2 days 3 hours'}};
        var context = {};
        assume(parameterize(template, context)['time']).equals('2017-01-21T19:27:20.974Z');
        tk.reset();
      });

      test('$fromNow -1 hour', function() {
        tk.freeze(date);
        var template = {time: {$fromNow: '-1 hours'}};
        var context = {};
        assume(parameterize(template, context)['time']).equals('2017-01-19T16:27:20.974Z');
        tk.reset();
      });
    });
  });
});
