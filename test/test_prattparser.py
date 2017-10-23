from __future__ import absolute_import, print_function, unicode_literals

from nose.tools import eq_
from jsone import JSONTemplateError
from jsone.prattparser import PrattParser, infix, prefix, Token


class IgnoringAlgebraicParser(PrattParser):

    ignore = r' +'
    patterns = {
        'symbol': r'[A-Z]+',
        'number': r'[0-9]+',
    }
    tokens = ['symbol', 'number', '+', '-']

class SimpleExpressionParser(PrattParser):

    ignore = None
    patterns = {
        'number': r'[0-9]',
    }
    tokens = ['number', '+', '-', '*', '(', ')']
    precedence = [
        ['+', '-'],
        ['*'],
        ['('],
    ]

    @prefix('number')
    def literal(self, token, pc):
        return int(token.value)

    @prefix('(')
    def paren(self, token, pc):
        v = pc.parse()
        pc.require(')')
        return v

    @infix('+', '-', '*')
    def arith(self, left, token, pc):
        right = pc.parse(token.kind)
        if token.kind == '+':
            return left + right
        elif token.kind == '-':
            return left - right
        elif token.kind == '*':
            return left * right


def test_tokenizer():
    ignoring_parser = IgnoringAlgebraicParser()
    simple_parser = SimpleExpressionParser()

    tests = {
        'empty': (ignoring_parser, '', []),
        'whitespace-pre': (simple_parser, ' 1+2', JSONTemplateError),
        'whitespace-in': (simple_parser, '1 + 2', JSONTemplateError),
        'whitespace-post': (simple_parser, '1+2 ', JSONTemplateError),
        'whitespace-ok': (ignoring_parser, ' 1 + 2 ', [
            Token('number', '1', 1, 2),
            Token('+', '+', 3, 4),
            Token('number', '2', 5, 6),
        ]),
        'multi-char': (ignoring_parser, '1234 ABCD', [
            Token('number', '1234', 0, 4),
            Token('symbol', 'ABCD', 5, 9),
        ]),
        'invalid': (simple_parser, 'xxx', JSONTemplateError),
    }
    def t(name):
        parser, input, output = tests[name]
        try:
            got = list(parser._generate_tokens(input))
        except Exception as exc:
            if isinstance(output, list):
                raise  # unexpected exception
            if not isinstance(exc, output):
                raise  # exception different from the expected
            return  # OK
        eq_(got, output)

    for test in tests:
        yield t, test


def test_parser():
    parser = SimpleExpressionParser()

    def t(input, output):
        eq_(parser.parse(input), output)

    yield t, '1+2+3', 6
    yield t, '3+8*2', 19
    yield t, '(3+8)*2', 22
    yield t, '3*8+2', 26
    yield t, '3*(8+2)', 30
    yield t, '((((4))))', 4

    def fail(input, message):
        try:
            parser.parse(input)
        except JSONTemplateError as exc:
            eq_(str(exc), "SyntaxError: " + message)

    yield fail, 'x', 'Unexpected input: \'x\''
    yield fail, '12', 'Found 2, expected *, +, -'
    yield fail, '(', 'Unexpected end of input'
    yield fail, '1+', 'Unexpected end of input'
    yield fail, ')', 'Found ), expected (, number'
    yield fail, '((1+2)+3', 'Unexpected end of input'
