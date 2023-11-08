import jsone
import os
import unittest
import yaml
import jsone.shared
from freezegun import freeze_time


def test_spec(spec):
    "A test function for a case from ../specification.yml"
    with freeze_time("2017-01-19T16:27:20.974Z"):
        exc, res = None, None
        try:
            res = jsone.render(spec["template"], spec["context"])
        except jsone.JSONTemplateError as e:
            if "error" not in spec:
                raise
            exc = e
        if "error" in spec:
            assert exc, "expected exception"
            expected = spec["error"]
            if expected is True:  # no specific expectation
                return
            assert str(exc) == expected
        else:
            assert not exc
            assert res == spec["result"], "{!r} != {!r}".format(res, spec["result"])


def pytest_generate_tests(metafunc):
    names = []
    specs = []
    with open(os.path.join(os.path.dirname(__file__), "../../specification.yml")) as f:
        for spec in yaml.load_all(f, Loader=yaml.FullLoader):
            if "section" in spec:
                section = spec["section"]
                continue

            name = "{}: {}".format(section, spec["title"])
            names.append(name)
            specs.append(spec)
    metafunc.parametrize("spec", specs, ids=names)
