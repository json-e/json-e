from __future__ import absolute_import, print_function, unicode_literals

import json as jsonmodule
from .shared import JSONTemplateError, DeleteMarker
from . import shared

constructs = {}


def construct(fn):
    constructs['$' + fn.__name__] = fn
    return fn


@construct
def eval(template, context):
    # TODO: actually evaluate
    return template['$eval']


@construct
def flatten(template, context):
    value = template['$flatten']
    if not isinstance(value, list):
        raise JSONTemplateError('$flatten value must evaluate to an array of arrays')

    def gen():
        for e in value:
            if isinstance(e, list):
                for e2 in e:
                    yield e2
            else:
                yield e
    return list(gen())


@construct
def flattenDeep(template, context):
    value = template['$flattenDeep']
    if not isinstance(value, list):
        raise JSONTemplateError('$flatten value must evaluate to an array')

    def gen(value):
        if isinstance(value, list):
            for e in value:
                for sub in gen(e):
                    yield sub
        else:
            yield value

    return list(gen(value))


@construct
def fromNow(template, context):
    # copied/modified from taskcluster-client.py
    offset = template['$fromNow']
    return shared.fromNow(offset)


@construct
def reverse(template, context):
    value = template['$reverse']
    # TODO: checkType function
    if not isinstance(value, list):
        raise JSONTemplateError("$reverse value must evaluate to an array")
    return list(reversed(value))


@construct
def json(template, context):
    return jsonmodule.dumps(template['$json'], separators=(',', ':'))
