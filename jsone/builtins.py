from __future__ import absolute_import, print_function, unicode_literals

import math
from .interpreter import ExpressionError
from . import shared

builtins = {}


def builtin(name, variadic=None, argument_tests=None, minArgs=None):
    def wrap(fn):
        def bad():
            raise ExpressionError('invalid arguments to {}'.format(name))
        if variadic:
            def invoke(args):
                if minArgs:
                    if len(args) < minArgs:
                        bad()
                for arg in args:
                    if not variadic(arg):
                        bad()
                return fn(*args)

        elif argument_tests:
            def invoke(args):
                if len(args) != len(argument_tests):
                    bad()
                for t, arg in zip(argument_tests, args):
                    if not t(arg):
                        bad()
                return fn(*args)

        else:
            def invoke(args):
                return fn(*args)

        builtins[name] = invoke
        return fn
    return wrap


def number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)

def string(v):
    return isinstance(v, basestring)

def string_or_array(v):
    return isinstance(v, (basestring, list))

def anything(v):
    return isinstance(v, (basestring, int, float, list))

# ---


builtin('min', variadic=number, minArgs=1)(min)
builtin('max', variadic=number, minArgs=1)(max)
builtin('sqrt', argument_tests=[number])(math.sqrt)
builtin('ceil', argument_tests=[number])(math.ceil)
builtin('floor', argument_tests=[number])(math.floor)
builtin('abs', argument_tests=[number])(abs)

@builtin('lowercase', argument_tests=[string])
def lowercase(v):
    return v.lower()

@builtin('uppercase', argument_tests=[string])
def lowercase(v):
    return v.upper()

builtin('len', argument_tests=[string_or_array])(len)

@builtin('str', argument_tests=[anything])
def to_str(v):
    if isinstance(v, bool):
        return {True: 'true', False: 'false'}[v]
    elif isinstance(v, list):
        return ','.join(to_str(e) for e in v)
    else:
        return str(v)

@builtin('str', argument_tests=[anything])
def to_str(v):
    if isinstance(v, bool):
        return {True: 'true', False: 'false'}[v]
    elif isinstance(v, list):
        return ','.join(to_str(e) for e in v)
    else:
        return str(v)

builtin('fromNow', argument_tests=[string])(shared.fromNow)
