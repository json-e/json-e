from __future__ import absolute_import, print_function, unicode_literals

from nose.tools import eq_
from jsone import JSONTemplateError
from jsone.parser import Tokenizer, Token, Parser
from jsone.AST import ASTNode, UnaryOp, BinOp, FunctionCall, ValueAccess, Object, List

ignoring_tokenizer = Tokenizer(
    r' +',
    {
        'symbol': r'[A-Z]+',
        'number': r'[0-9]+',
    },
    ['symbol', 'number', '+', '-']
)

simple_tokenizer = Tokenizer(
    None,
    {
        'number': r'[0-9]',
    },
    ['number', '+', '-', '*', '(', ')'],
)


def test_tokenizer():
    tests = {
        'empty': (ignoring_tokenizer, '', []),
        'whitespace-pre': (simple_tokenizer, ' 1+2', JSONTemplateError),
        'whitespace-in': (simple_tokenizer, '1 + 2', JSONTemplateError),
        'whitespace-post': (simple_tokenizer, '1+2 ', JSONTemplateError),
        'whitespace-ok': (ignoring_tokenizer, ' 1 + 2 ', [
            Token('number', '1', 1, 2),
            Token('+', '+', 3, 4),
            Token('number', '2', 5, 6),
        ]),
        'multi-char': (ignoring_tokenizer, '1234 ABCD', [
            Token('number', '1234', 0, 4),
            Token('symbol', 'ABCD', 5, 9),
        ]),
        'invalid': (simple_tokenizer, 'xxx', JSONTemplateError),
    }

    def t(name):
        tokenizer, input, output = tests[name]
        try:
            got = list(tokenizer.generate_tokens(input))
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
    def t(input, output):
        parser = Parser(input, simple_tokenizer)
        eq_(treesequals(parser.parse(), output), True)

    yield t, '1+2+3', BinOp(Token('+', '+', 3, 4),
                            BinOp(Token('+', '+', 1, 2), ASTNode(Token('number', '1', 0, 1)),
                                  ASTNode(Token('number', '2', 2, 3))),
                            ASTNode(Token('number', '3', 4, 5)))
    yield t, '3+8*2', BinOp(Token('+', '+', 1, 2), ASTNode(Token('number', '3', 0, 1)),
                            BinOp(Token('*', '*', 3, 4), ASTNode(Token('number', '8', 2, 3)),
                                  ASTNode(Token('number', '2', 4, 5)))
                            )
    yield t, '(3+8)*2', BinOp(Token('*', '*', 5, 6),
                              BinOp(Token('+', '+', 2, 3), ASTNode(Token('number', '3', 1, 2)),
                                    ASTNode(Token('number', '8', 3, 4))),
                              ASTNode(Token('number', '2', 6, 7)))
    yield t, '3*8+2', BinOp(Token('+', '+', 3, 4),
                            BinOp(Token('*', '*', 1, 2), ASTNode(Token('number', '3', 0, 1)),
                                  ASTNode(Token('number', '8', 2, 3))),
                            ASTNode(Token('number', '2', 4, 5)))
    yield t, '3*(8+2)', BinOp(Token('*', '*', 1, 2), ASTNode(Token('number', '3', 0, 1)),
                              BinOp(Token('+', '+', 4, 5), ASTNode(Token('number', '8', 3, 4)),
                                    ASTNode(Token('number', '2', 5, 6))))
    yield t, '((((4))))', ASTNode(Token('number', '4', 4, 5))

    def fail(input, message):
        try:
            parser = Parser(input, simple_tokenizer)
            parser.parse()
        except JSONTemplateError as exc:
            eq_(str(exc), "SyntaxError: " + message)

    yield fail, 'x', 'Unexpected input for \'x\' at \'x\''
    yield fail, '12', 'Found 2, expected *, +, -'
    yield fail, '(', 'Unexpected end of input'
    yield fail, '1+', 'Unexpected end of input'
    yield fail, ')', 'Found ), expected (, number'
    yield fail, '((1+2)+3', 'Unexpected end of input'


def treesequals(first, second):
    if first is None and second is None:
        return True
    elif first is None or second is None:
        return False
    elif first.token != second.token:
        return False
    if isinstance(first, BinOp):
        return treesequals(first.left, second.left) and treesequals(first.right, second.right)
    else:
        return True
