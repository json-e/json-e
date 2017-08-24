import jsone
import os
import unittest
import yaml
import jsone.shared
from freezegun import freeze_time
from nose.tools import eq_

def test():
    def spec_test(name, spec):
        "Make a test function for a case from specification.yml"
        def test(*args):
            exc, res = None, None
            try:
                res = jsone.render(spec['template'], spec['context'])
            except jsone.JSONTemplateError as e:
                if 'error' not in spec:
                    raise
                exc = e
            if 'error' in spec:
                assert exc, "expected exception"
                expected = spec['error']
                if expected is True:  # no specific expectation
                    return
                eq_(str(exc), expected)
            else:
                assert not exc
                assert res == spec['result'], \
                    '{!r} != {!r}'.format(res, spec['result'])
        return test

    with open(os.path.join(os.path.dirname(__file__), '../specification.yml')) as f:
        with freeze_time('2017-01-19T16:27:20.974Z'):
            for spec in yaml.load_all(f):
                if 'section' in spec:
                    section = spec['section']
                    continue

                name = '{}: {}'.format(section, spec['title'])
                t = spec_test(name, spec)
                yield (t, name)
