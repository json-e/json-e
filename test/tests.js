let yaml = require('js-yaml');
let fs = require('fs');
let path = require('path');
let _ = require('lodash');
let assert = require('assert');
let parameterize = require('../src/index');
let tk = require('timekeeper');

let builtinMethods = {
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
};

let date = new Date('2017-01-19T16:27:20.974Z');

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
          assert(c.error, 'unexpected error' + err);
          return; 
        }
        assert(!c.error, 'expected an error');
      });
    });
});

suite('json-e', () => {
  let jsoneSuite = {};
  let currentSection = null;
  yaml.loadAll(fs.readFileSync(path.join(__dirname, '../specification.yml'), {encoding: 'utf8'}),
  (doc) => {
    if (doc.hasOwnProperty('section')) {
      jsoneSuite[doc.section] = [];
      currentSection = doc.section;
    } else {
      jsoneSuite[currentSection].push(doc);
    }
  });

  for (let currentSuite of Object.keys(jsoneSuite)) {
    suite(currentSuite, () => {
      before(() => tk.freeze(date));
      after(() => tk.reset());
      jsoneSuite[currentSuite].forEach((c) => {
        test(c.title, () => {
          try {
            let result = parameterize(c.template, _.defaults({}, c.context, builtinMethods));
            assert(_.isEqual(result, c.result), 'unexpected result');
            return;
          } catch (err) {
            assert(c.error, 'unexpected error' + err);
            return; 
          }
          assert(!c.error, 'expected an error');
        });
      });
    });
  }
});
