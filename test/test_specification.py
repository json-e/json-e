import dateutil.parser
import jsone
import os
import unittest
import yaml
import jsone.shared

TEST_DATE = dateutil.parser.parse('2017-01-19T16:27:20.974Z')

def setup_module():
    global old_utcnow
    old_utcnow = jsone.shared.utcnow
    jsone.shared.utcnow = lambda: TEST_DATE

def teardown_module():
    jsone.shared.utcnow = old_utcnow

def test():
    def todo(test, reason):
        "Wrap a test that should not pass yet"
        def wrap(*args):
            try:
                test()
            except Exception:
                raise unittest.SkipTest(reason)
            raise AssertionError("test passed unexpectedly")
        return wrap

    def spec_test(name, spec):
        "Make a test function for a case from specification.yml"
        def test(*args):
            exc, res = None, None
            try:
                res = jsone.render(spec['template'], spec['context'])
            except jsone.JSONTemplateError as e:
                exc = e
            if 'error' in spec:
                assert exc, "expected exception"
            else:
                if exc:
                    raise exc
                assert res == spec['result'], \
                    '{!r} != {!r}'.format(res, spec['result'])
        return test

    with open(os.path.join(os.path.dirname(__file__), '../specification.yml')) as f:
        for spec in yaml.load_all(f):
            if 'section' in spec:
                section = spec['section']
                continue

            name = '{}: {}'.format(section, spec['title'])
            t = spec_test(name, spec)
            if 'todo' in spec and 'python' in spec['todo']:
                t = todo(t, spec['todo']['python'])
            yield (t, name)
