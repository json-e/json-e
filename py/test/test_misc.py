from __future__ import absolute_import, print_function, unicode_literals

import pytest
import math
import datetime
from jsone.shared import string, stringDate
from jsone import render, JSONTemplateError


def test_custom_builtin():
    def my_builtin(x, y):
        return math.sqrt(x**2 + y**2)

    assert render({"$eval": "my_builtin(3, 4)"}, {"my_builtin": my_builtin}) == 5


def test_no_arg_func():
    def my_builtin():
        return 42

    assert render({"$eval": "my_builtin()"}, {"my_builtin": my_builtin}) == 42


def test_non_object_context():
    with pytest.raises(JSONTemplateError):
        render({}, None)
    with pytest.raises(JSONTemplateError):
        render({}, False)
    with pytest.raises(JSONTemplateError):
        render({}, 3.2)
    with pytest.raises(JSONTemplateError):
        render({}, "two")
    with pytest.raises(JSONTemplateError):
        render({}, [{}])


def test_same_time_within_evaluation_operator():
    template = [{"$fromNow": ""} for _ in range(1000)]
    result = render(template, {})
    assert len(set(result)) == 1


def test_same_time_within_evaluation_builtin():
    template = [{"$eval": 'fromNow("")'} for _ in range(1000)]
    result = render(template, {})
    assert len(set(result)) == 1


def test_now_builtin():
    assert isinstance(render({"$eval": "now"}, {}), string) == True


def test_stringDate_microseconds():
    assert (
        stringDate(datetime.datetime(2017, 11, 1, 22, 0, 9, 0))
        == "2017-11-01T22:00:09.000Z"
    )
