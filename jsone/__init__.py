from __future__ import absolute_import, print_function, unicode_literals

import json as jsonmodule


class DeleteMarker:
    pass


class JSONTemplateError(Exception):
    pass


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
def reverse(template, context):
    value = template['$reverse']
    # TODO: checkType function
    if not isinstance(value, list):
        raise JSONTemplateError("$reverse value must evaluate to an array")
    return list(reversed(value))


@construct
def json(template, context):
    return jsonmodule.dumps(template['$json'], separators=(',', ':'))


def render(template, context):
    # TODO: check context keys + test
    def recur(template, context):
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
            rendered = (recur(e, context) for e in template)
            return [e for e in rendered if e is not DeleteMarker]

        else:
            return template

    return recur(template, context)
