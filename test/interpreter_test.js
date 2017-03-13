import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import assert from 'assert';
import assume from 'assume';
import jsone from '../lib/';
import interpreter from '../lib/interpreter';

const EXPR_SPEC = path.join(__dirname, 'expression-language.yml');
const builtinMethods = {
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
};

suite('intepreter', () => {
  let rawexpr = fs.readFileSync(EXPR_SPEC, {encoding: 'utf8'});
  yaml.loadAll(rawexpr, c => test(c.title, () => {
    let result;
    try {
      result = interpreter.parse(c.source, _.defaults({}, c.context, builtinMethods));
    } catch (err) {
      if (!c.error) {
        throw err;
      }
      return;
    }
    assert(!c.error, 'Expected an error from: ' + c.source);
    assume(result).eql(c.result);
  }));
});
