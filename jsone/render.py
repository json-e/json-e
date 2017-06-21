from __future__ import absolute_import, print_function, unicode_literals

import re
import json as json
from .shared import JSONTemplateError, DeleteMarker
from . import shared
from .interpreter import ExpressionEvaluator

operators = {}


def operator(name):
    def wrap(fn):
        operators[name] = fn
        return fn
    return wrap


def evaluate_expression(expr, context):
    evaluator = ExpressionEvaluator(context)
    return evaluator.parse(expr)


@operator('$eval')
def eval(template, context):
    return evaluate_expression(renderValue(template['$eval'], context), context)


@operator('$flatten')
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


@operator('$flattenDeep')
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


@operator('$fromNow')
def fromNow(template, context):
    offset = renderValue(template['$fromNow'], context)
    return shared.fromNow(offset)


# TODO: eval the value
#@operator('$if')
def ifConstruct(template, context):
    condition = renderValue(template['$if'], context)
    try:
        if condition:
            rv = template['then']
        else:
            rv = template['else']
    except KeyError:
        return DeleteMarker
    return renderValue(rv, context)

@operator('$json')
def jsonConstruct(template, context):
    value = renderValue(template['$json'], context)
    return json.dumps(value, separators=(',', ':'))


# TODO: requires $eval
#@operator('$let')
def let(template, context):
    print(context)
    variables = renderValue(template['$let'], context)
    if not isinstance(variables, dict):
        raise JSONTemplateError("$let value must evaluate to an object")
    subcontext = context.copy()
    subcontext.update(variables)
    try:
        in_expression = template['in']
    except KeyError:
        raise JSONTemplateError("$let operator requires an `in` clause")
    return renderValue(in_expression, subcontext)


# TODO: requires $eval
#@operator('$map')

@operator('$merge')
def merge(template, context):
    value = renderValue(template['$merge'], context)
    # TODO: checkType function
    if not isinstance(value, list) or not all(isinstance(e, dict) for e in value):
        raise JSONTemplateError("$reverse value must evaluate to an array of objects")
    v = dict()
    for e in value:
        v.update(e)
    return v


@operator('$reverse')
def reverse(template, context):
    value = renderValue(template['$reverse'], context)
    # TODO: checkType function
    if not isinstance(value, list):
        raise JSONTemplateError("$reverse value must evaluate to an array")
    return list(reversed(value))


# awaiting https://github.com/taskcluster/json-e/issues/71
#@operator('$sort')
def sort(template, context):
    value = renderValue(template['$sort'], context)
    # TODO: checkType function
    if not isinstance(value, list):
        raise JSONTemplateError("$sort value must evaluate to an array")
    return list(sorted(value))


def renderValue(template, context):
    if isinstance(template, basestring):
        # TODO: interpolate
        return template

    elif isinstance(template, dict):
        matches = [k for k in template if k in operators]
        if matches:
            if len(matches) > 1:
                raise JSONTemplateError("only one operator allowed")
            return operators[matches[0]](template, context)
        def updated():
            for k, v in template.viewitems():
                if k.startswith('$$') and k[1:] in operators:
                    k = k[1:]
                v = renderValue(v, context)
                if v is not DeleteMarker:
                    yield k, v
        return dict(updated())

    elif isinstance(template, list):
        rendered = (renderValue(e, context) for e in template)
        return [e for e in rendered if e is not DeleteMarker]

    else:
        return template
