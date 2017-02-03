let yaml = require('js-yaml');
let fs = require('fs');
let path = require('path');
let _ = require('lodash');
let assert = require('assert');
let parameterize = require('../src/index');

let builtinMethods = {
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
};

suite('intepreter', () => {
  let interpreter = require('../src/interpreter');
  yaml.loadAll(fs.readFileSync(path.join(__dirname, 'expression_language.yml'), {encoding: 'utf8'}),
    (c) => {
      test(c.title, () => {
        try {
          let result = interpreter.parse(c.source, _.defaults({}, c.context, builtinMethods));
          assert(_.isEqual(result, c.result), 'unexpected result');
          return;
        } catch (err) {
          assert(c.error, /*'unexpected error'*/ err);
          return; 
        }
        assert(!c.error, 'expected an error');
      });
    });
});
