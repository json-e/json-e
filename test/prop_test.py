import os
import json
import subprocess
import string

from nose.tools import eq_
from hypothesis import given, settings
from hypothesis.strategies import *

import jsone
from jsone.render import operators as defined_operators
from jsone.builtins import builtins as defined_builtins


def py(template, context):
    try:
        return jsone.render(template, context)
    except jsone.JSONTemplateError:
        return Exception


def js(template, context):
    input = json.dumps({'template': template, 'context': context})
    command = ['node', '-e', ' '.join([
        'var jsone = require("./lib").default, fs = require("fs");',
        'var input = JSON.parse(fs.readFileSync("/dev/stdin").toString());',
        'console.error(JSON.stringify(input));',
        'var output = JSON.stringify(jsone(input.template, input.context));',
        'console.log(output);'])]
    proc = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = proc.communicate(input.encode('utf-8'))
    returncode = proc.wait()
    if returncode:
        return Exception
    return json.loads(stdout.decode('utf-8'))


def make_strategies():
    identifiers = lambda: text(alphabet='$' + string.ascii_lowercase, min_size=1, max_size=8)
    prefixed_identifiers = lambda: identifiers().filter(lambda i: '$' + i)
    operators = lambda: sampled_from(list(defined_operators))
    builtins = lambda: sampled_from(list(defined_builtins))

    def expressions():
        # strategies for individual tokens..
        simple_tokens = lambda: sampled_from([
            '**', '+', '-', '*', '/', '[', ']', '.', '(', ')', '{', '}', ':', ',',
            '>=', '<=', '<', '>', '==', '!=', '!', '&&', '||', 'true', 'false', 'in',
            'null',
            ])
        numbers = lambda: integers(min_value=-100, max_value=100).map(lambda i: str(i))
        strings = lambda: (
            text(max_size=5).map(lambda s: '"' + s.replace('"', '') + '"') |
            text(max_size=5).map(lambda s: "'" + s.replace("'", "") + "'"))
        tokens = lambda: simple_tokens() | numbers() | identifiers() | builtins() | strings()

        # .. now put those together into lists and join with whitespace
        return lists(tokens()).map(lambda l: ' '.join(l))

    properties = lambda: prefixed_identifiers() | operators()
    json_strategy = lambda: recursive(
        none() |
        booleans() |
        integers(min_value=-2**31, max_value=2**31) |
        floats(min_value=-10, max_value=10, allow_nan=False, allow_infinity=False) |
        expressions(),
        lambda children: lists(children) | dictionaries(properties(), children))

    return dict(
        template=json_strategy(),
        context=dictionaries(prefixed_identifiers(), json_strategy()))


if os.environ.get('RUN_PROP_TESTS'):
    @given(**make_strategies())
    def test_json(template, context):
        eq_(py(template, context), js(template, context))

