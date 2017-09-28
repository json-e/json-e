from __future__ import absolute_import, print_function, unicode_literals

import re
import json as json
from .shared import JSONTemplateError, TemplateError, DeleteMarker, string, to_str
from . import shared
from .interpreter import ExpressionEvaluator
from .six import viewitems
import functools

operators = {}
IDENTIFIER_RE = re.compile(r'[a-zA-Z_][a-zA-Z0-9_]*$')


def operator(name):
    def wrap(fn):
        operators[name] = fn
        return fn
    return wrap


def evaluateExpression(expr, context):
    evaluator = ExpressionEvaluator(context)
    return evaluator.parse(expr)


_interpolation_start_re = re.compile(r'\$?\${')
def interpolate(string, context):
    mo = _interpolation_start_re.search(string)
    if not mo:
        return string

    result = []
    evaluator = ExpressionEvaluator(context)

    while True:
        result.append(string[:mo.start()])
        if mo.group() != '$${':
            string = string[mo.end():]
            parsed, offset = evaluator.parseUntilTerminator(string, '}')
            if isinstance(parsed, (list, dict)):
                raise TemplateError(
                    "interpolation of '{}' produced an array or object".format(string[:offset]))
            if to_str(parsed) == "null":
                result.append("")
            else:
                result.append(to_str(parsed))
            string = string[offset + 1:]
        else:  # found `$${`
            result.append('${')
            string = string[mo.end():]

        mo = _interpolation_start_re.search(string)
        if not mo:
            result.append(string)
            break

    return ''.join(result)


@operator('$eval')
def eval(template, context):
    return evaluateExpression(renderValue(template['$eval'], context), context)


@operator('$flatten')
def flatten(template, context):
    value = renderValue(template['$flatten'], context)
    if not isinstance(value, list):
        raise TemplateError('$flatten value must evaluate to an array')

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
    value = renderValue(template['$flattenDeep'], context)
    if not isinstance(value, list):
        raise TemplateError('$flattenDeep value must evaluate to an array')

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
    reference = renderValue(template['from'], context) if 'from' in template else context.get('now')

    if not isinstance(offset, string):
        raise TemplateError("$fromNow expects a string")
    return shared.fromNow(offset, reference)


@operator('$if')
def ifConstruct(template, context):
    condition = evaluateExpression(template['$if'], context)
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


@operator('$let')
def let(template, context):
    variables = renderValue(template['$let'], context)    
    
    if not isinstance(variables, dict):
        raise TemplateError("$let value must evaluate to an object")
    else:
        if not all(IDENTIFIER_RE.match(variableNames) for variableNames in variables.keys()):
          raise TemplateError('top level keys of $let must follow /[a-zA-Z_][a-zA-Z0-9_]*/')
    
    subcontext = context.copy()
    subcontext.update(variables)
    try:
        in_expression = template['in']
    except KeyError:
        raise TemplateError("$let operator requires an `in` clause")
    return renderValue(in_expression, subcontext)


@operator('$map')
def map(template, context):
    value = renderValue(template['$map'], context)
    if not isinstance(value, list) and not isinstance(value, dict):
        raise TemplateError("$map value must evaluate to an array or object")

    is_obj = isinstance(value, dict)

    each_keys = [k for k in template if k.startswith('each(')]
    if len(each_keys) != 1:
        raise TemplateError("$map requires exactly one other property, each(..)")
    each_key = each_keys[0]
    each_var = each_key[5:-1]
    each_template = template[each_key]

    if is_obj:
        value = [{'key': v[0], 'val': v[1]} for v in value.items()]

    def gen():
        subcontext = context.copy()
        for elt in value:
            subcontext[each_var] = elt
            elt = renderValue(each_template, subcontext)
            if elt is not DeleteMarker:
                yield elt

    if is_obj:
        v = dict()
        for e in gen():
            v.update(e)
        return v
    else:
        return list(gen())


@operator('$merge')
def merge(template, context):
    if(len(template)>1):
        raise TemplateError("$merge with undefined properties")
    value = renderValue(template['$merge'], context)
    if not isinstance(value, list) or not all(isinstance(e, dict) for e in value):
        raise TemplateError("$merge value must evaluate to an array of objects")
    v = dict()
    for e in value:
        v.update(e)
    return v


@operator('$mergeDeep')
def merge(template, context):
    value = renderValue(template['$mergeDeep'], context)
    if not isinstance(value, list) or not all(isinstance(e, dict) for e in value):
        raise TemplateError("$mergeDeep value must evaluate to an array of objects")
    def merge(l, r):
        if isinstance(l, list) and isinstance(r, list):
            return l + r
        if isinstance(l, dict) and isinstance(r, dict):
            res = l.copy()
            for k, v in viewitems(r):
                if k in l:
                    res[k] = merge(l[k], v)
                else:
                    res[k] = v
            return res
        return r
    if len(value) == 0:
        return {}
    return functools.reduce(merge, value[1:], value[0])


@operator('$reverse')
def reverse(template, context):
    value = renderValue(template['$reverse'], context)
    if not isinstance(value, list):
        raise TemplateError("$reverse value must evaluate to an array")
    return list(reversed(value))


@operator('$sort')
def sort(template, context):
    value = renderValue(template['$sort'], context)
    if not isinstance(value, list):
        raise TemplateError("$sort value must evaluate to an array")

    # handle by(..) if given, applying the schwartzian transform
    by_keys = [k for k in template if k.startswith('by(')]
    if len(by_keys) == 1:
        by_key = by_keys[0]
        by_var = by_key[3:-1]
        by_expr = template[by_key]

        def xform():
            subcontext = context.copy()
            for e in value:
                subcontext[by_var] = e
                yield evaluateExpression(by_expr, subcontext), e
        to_sort = list(xform())
    elif len(by_keys) == 0:
        to_sort = [(e, e) for e in value]
    else:
        raise TemplateError('only one by(..) is allowed')

    # check types
    try:
        eltype = type(to_sort[0][0])
    except IndexError:
        return []
    if eltype in (list, dict, bool, type(None)):
        raise TemplateError('$sort values must be sortable')
    if not all(isinstance(e[0], eltype) for e in to_sort):
        raise TemplateError('$sorted values must all have the same type')

    # unzip the schwartzian transform
    return list(e[1] for e in sorted(to_sort))


def renderValue(template, context):
    if isinstance(template, string):
        return interpolate(template, context)

    elif isinstance(template, dict):
        matches = [k for k in template if k in operators]
        if matches:
            if len(matches) > 1:
                raise TemplateError("only one operator allowed")
            return operators[matches[0]](template, context)

        def updated():
            for k, v in viewitems(template):
                if k.startswith('$$'):
                    k = k[1:]
                elif k.startswith('$') and IDENTIFIER_RE.match(k[1:]):
                    raise TemplateError('$<identifier> is reserved; ues $$<identifier>')
                else:
                    k = interpolate(k, context)

                try:
                    v = renderValue(v, context)
                except JSONTemplateError as e:
                    if IDENTIFIER_RE.match(k):
                        e.add_location('.{}'.format(k))
                    else:
                        e.add_location('[{}]'.format(json.dumps(k)))
                    raise
                if v is not DeleteMarker:
                    yield k, v
        return dict(updated())

    elif isinstance(template, list):
        def updated():
            for i, e in enumerate(template):
                try:
                    v = renderValue(e, context)
                    if v is not DeleteMarker:
                        yield v
                except JSONTemplateError as e:
                    e.add_location('[{}]'.format(i))
                    raise
        return list(updated())

    else:
        return template
