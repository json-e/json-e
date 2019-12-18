import unittest

from .AST import *
from .newparser import Parser, generate_tokens, Token


class TestConstructors(unittest.TestCase):

    def test_binOp_constructor(self):
        op = Token("MINUS", "-", 0, 1)
        left = ASTnode(op)
        right = ASTnode(op)
        node = BinOp(left, right, op)
        self.assertEqual(isinstance(node, BinOp), True)

    def test_unaryOp_constructor(self):
        token = Token("MINUS", "-", 0, 1)
        expr = ASTnode(token)
        node = UnaryOp(token, expr)
        self.assertEqual(isinstance(node, UnaryOp), True)

    def test_builtin_constructor(self):
        builtin = "max"
        args = []
        token = Token("MINUS", "-", 0, 1)
        node = Builtins(builtin, args, token)
        self.assertEqual(isinstance(node, Builtins), True)

    def test_term(self):
        tokens = generate_tokens("2")
        parser = Parser(tokens, "2")
        node = parser.parse()
        self.assertEqual(node.token.kind == "number" and node.token.value == '2', True)

    def test_unaryOp(self):
        tokens = generate_tokens("-2")
        parser = Parser(tokens, "-2")
        node = parser.parse()
        isUnaryNodeCorrect = node.token.value == "-" and node.token.kind == "-"
        self.assertEqual(isUnaryNodeCorrect and node.expr.token.value == '2', True)
