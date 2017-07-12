var yaml = require('js-yaml');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var assert = require('assert');
var tk = require('timekeeper');
var assume = require('assume');
var jsone = require('../src/');

const SPEC_FILE = path.join(__dirname, '../specification.yml');
const TEST_DATE = new Date('2017-01-19T16:27:20.974Z');

suite('json-e', () => {
  let spec = {};
  let section = null;
  let rawspec = fs.readFileSync(SPEC_FILE, {encoding: 'utf8'});
  yaml.loadAll(rawspec, c => {
    if (c.section) {
      spec[c.section] = section = [];
    } else {
      section.push(c);
    }
  });

  before(() => tk.freeze(TEST_DATE));
  after(() => tk.reset());

  _.forEach(spec, (C, s) => suite(s, function() {
    C.forEach(c => {
      let t = function() {
        let result;
        try {
          result = jsone(c.template, c.context);
        } catch (err) {
          if (!c.error) {
            throw err;
          }
          return;
        }
        assert(!c.error, 'Expected an error');
        assume(result).eql(c.result);
      };
      test(c.title, t);
    });
  }));
});
