import unittest

from .AST import *
from .newparser import Parser, generate_tokens, Token
from .newinterpreter import Interpreter
from .interpreter import ExpressionEvaluator
from . import builtins


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
        args = []
        token = Token("MINUS", "-", 0, 1)
        node = Builtin(token, args)
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

    def test_interpreterForBuiltinFunction(self):
        expr = "max(5,2,9)"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForBuiltin(self):
        expr = "a"
        context = builtins.build({})
        context.update({"a": 3})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForEmptyList(self):
        expr = "[]"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForList(self):
        expr = "[2, 5]"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForArrayAccess(self):
        expr = "a[2]"
        context = builtins.build({})
        context.update({"a": [1, 2, 3, 4]})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForIntervalWithOneLeftArg(self):
        expr = "a[2:]"
        context = builtins.build({})
        context.update({"a": [1, 2, 3, 4]})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForIntervalWithOneRightArg(self):
        expr = "a[:2]"
        context = builtins.build({})
        context.update({"a": [1, 2, 3, 4]})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForInterval(self):
        expr = "a[2:4]"
        context = builtins.build({})
        context.update({"a": [1, 2, 3, 4]})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForEmptyObject(self):
        expr = "{}"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForObject(self):
        expr = "{k : 2}"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForComplexObject(self):
        expr = "{\"a\" : 2+5, b : \"zxc\"}"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForDotOp(self):
        expr = "{a: 1}.a"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForDotOpWithContext(self):
        expr = "k.b"
        context = builtins.build({})
        context.update({"k": {"b": 8}})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForInOpWithArray(self):
        expr = "5 in [\"5\", \"five\"]"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForInOpWithObject(self):
        expr = "\"5\" in {\"5\": \"five\"}"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForInOpWithString(self):
        expr = "\"5\" in {\"5\": \"five\"}"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        oldInterpreter = ExpressionEvaluator(context)
        self.assertEqual(newInterpreter.interpret(tree), oldInterpreter.parse(expr))

    def test_interpreterForOrShortCircuitEvaluation(self):
        expr = "true || a"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        self.assertEqual(newInterpreter.interpret(tree), True)

    def test_interpreterForAndShortCircuitEvaluation(self):
        expr = "false && a"
        context = builtins.build({})
        tokens = generate_tokens(expr)
        parser = Parser(tokens, expr)
        tree = parser.parse()
        newInterpreter = Interpreter(context)
        self.assertEqual(newInterpreter.interpret(tree), False)
