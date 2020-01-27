import unittest

from .AST import *
from .newparser import Parser, generate_tokens, Token
from .newinterpreter import Interpreter
from .interpreter import ExpressionEvaluator


class TestConstructors(unittest.TestCase):

    def test_binOp_constructor(self):
        op = Token("MINUS", "-", 0, 1)
        left = ASTNode(op)
        right = ASTNode(op)
        node = BinOp(op, left, right)
        self.assertEqual(isinstance(node, BinOp), True)

    def test_unaryOp_constructor(self):
        token = Token("MINUS", "-", 0, 1)
        expr = ASTNode(token)
        node = UnaryOp(token, expr)
        self.assertEqual(isinstance(node, UnaryOp), True)

    def test_builtin_constructor(self):
        builtin = "max"
        args = []
        token = Token("MINUS", "-", 0, 1)
        node = Builtin(token, builtin, args)
        self.assertEqual(isinstance(node, Builtin), True)

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

    def test_interpreterForUnaryMinus(self):
        expr = "-2"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForUnaryPlus(self):
        expr = "+7"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForNot(self):
        expr = "!5"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForBinaryPlus(self):
        expr = "2+3"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForBinaryMinus(self):
        expr = "2-3"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForDiv(self):
        expr = "6/2"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForMul(self):
        expr = "2*3"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForGreater(self):
        expr = "5>2"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForLess(self):
        expr = "4<7"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForMoreOrEqual(self):
        expr = "3>=3"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForLessOrEqual(self):
        expr = "6<=2"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForNotEqual(self):
        expr = "2!=3"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForEqual(self):
        expr = "5==2"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForOr(self):
        expr = "false||false"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForAND(self):
        expr = "true&&false"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForSquaring(self):
        expr = "2**3"
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter({})
        oldInterpreter = ExpressionEvaluator({})
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))
