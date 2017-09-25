from __future__ import absolute_import, print_function, unicode_literals

import math
from nose.tools import eq_
from jsone import render, JSONTemplateError


def test_custom_builtin():
    def my_builtin(x, y):
        return math.sqrt(x ** 2 + y ** 2)
    eq_(render({'$eval': 'my_builtin(3, 4)'}, {'my_builtin': my_builtin}), 5)

def test_same_time_within_evaluation_operator():
    template = [{'$fromNow': ''} for _ in range(1000)]
    result = render(template, {})
    eq_(len(set(result)), 1)

def test_same_time_within_evaluation_builtin():
    template = [{'$eval': 'fromNow("")'} for _ in range(1000)]
    result = render(template, {})
    eq_(len(set(result)), 1)

def test_now_builtin():
    eq_(isinstance(render({'$eval': 'now'}, {}), str), True)
