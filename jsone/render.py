from __future__ import absolute_import, print_function, unicode_literals

import re
import json as json
from .shared import JSONTemplateError, DeleteMarker
from . import shared

constructs = {}


def construct(name):
    def wrap(fn):
        constructs[name] = fn
        return fn
    return wrap


@construct('$eval')
def eval(template, context):
    # TODO: actually evaluate
    return template['$eval']


@construct('$flatten')
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


@construct('$flattenDeep')
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


@construct('$fromNow')
def fromNow(template, context):
    offset = renderValue(template['$fromNow'], context)
    return shared.fromNow(offset)


@construct('$ifxxx')
def ifConstruct(template, context):
    offset = renderValue(template['$if'], context)


@construct('$reverse')
def reverse(template, context):
    value = renderValue(template['$reverse'], context)
    # TODO: checkType function
    if not isinstance(value, list):
        raise JSONTemplateError("$reverse value must evaluate to an array")
    return list(reversed(value))


@construct('$json')
def jsonConstruct(template, context):
    value = renderValue(template['$json'], context)
    return json.dumps(value, separators=(',', ':'))


def renderValue(template, context):
    if isinstance(template, basestring):
        # TODO: interpolate
        return template

    elif isinstance(template, dict):
        matches = [k for k in template if k in constructs]
        if not matches:
            return template
        if len(matches) > 1:
            raise JSONTemplateError("only one construct allowed")
        return constructs[matches[0]](template, basestring)

    elif isinstance(template, list):
        rendered = (renderValue(e, context) for e in template)
        return [e for e in rendered if e is not DeleteMarker]

    else:
        # TODO: copy, unquote $$
        return template
