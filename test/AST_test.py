import unittest
from AST import *


class TestConstructors(unittest.TestCase):

    def test_term(self):
        token = tkn("MINUS", "-")
        node = Term(token)
        self.assertEqual(isinstance(node, Term), True)

    def test_binOp(self):
        op = tkn("MINUS", "-")
        left = AST(op)
        right = AST(op)
        node = BinOp(left, right, op)
        self.assertEqual(isinstance(node, BinOp), True)

    def test_unaryOp(self):
        token = tkn("MINUS", "-")
        expr = AST(token)
        node = UnaryOp(token, expr)
        self.assertEqual(isinstance(node, UnaryOp), True)

    def test_builtin(self):
        builtin = "max"
        args = []
        token = tkn("MINUS", "-")
        node = Builtins(builtin, args, token)
        self.assertEqual(isinstance(node, Builtins), True)
