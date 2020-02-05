from .shared import TemplateError, InterpreterError, string
import json


def infixExpectationError(operator, expected):
    return InterpreterError('infix: {} expects {} {} {}'.
                            format(operator, expected, operator, expected))


class Interpreter:
    def __init__(self, context):
        self.context = context

    def visit(self, node):
        method_name = 'visit_' + type(node).__name__
        visitor = getattr(self, method_name)
        return visitor(node)

    def visit_ASTNode(self, node):
        if node.token.kind == "number":
            v = node.token.value
            return float(v) if '.' in v else int(v)
        elif node.token.kind == "null":
            return None
        elif node.token.kind == "string":
            return node.token.value[1:-1]
        elif node.token.kind == "true":
            return True
        elif node.token.kind == "false":
            return False

    def visit_UnaryOp(self, node):
        value = self.visit(node.expr)
        if node.token.kind == "+":
            if not isNumber(value):
                raise InterpreterError('{} expects {}'.format('unary +', 'number'))
            return value
        elif node.token.kind == "-":
            if not isNumber(value):
                raise InterpreterError('{} expects {}'.format('unary -', 'number'))
            return -value
        elif node.token.kind == "!":
            return not self.visit(node.expr)

    def visit_BinOp(self, node):
        left = self.visit(node.left)
        if node.token.kind == "||":
            return bool(left or self.visit(node.right))
        elif node.token.kind == "&&":
            return bool(left and self.visit(node.right))
        elif node.token.kind == ".":
            right = node.right.value
        else:
            right = self.visit(node.right)

        if node.token.kind == "+":
            if not isinstance(left, (string, int, float)) or isinstance(left, bool):
                raise infixExpectationError('+', 'number/string')
            if not isinstance(right, (string, int, float)) or isinstance(right, bool):
                raise infixExpectationError('+', 'number/string')
            if type(right) != type(left) and \
                    (isinstance(left, string) or isinstance(right, string)):
                raise infixExpectationError('+', 'numbers/strings')
            return left + right
        elif node.token.kind == "-":
            testMathOperands("-", left, right)
            return left - right
        elif node.token.kind == "/":
            testMathOperands("/", left, right)
            return left / right
        elif node.token.kind == "*":
            testMathOperands("*", left, right)
            return left * right
        elif node.token.kind == ">":
            testComparisonOperands(">", left, right)
            return left > right
        elif node.token.kind == "<":
            testComparisonOperands("<", left, right)
            return left < right
        elif node.token.kind == ">=":
            testComparisonOperands(">=", left, right)
            return left >= right
        elif node.token.kind == "<=":
            testComparisonOperands("<=", left, right)
            return left <= right
        elif node.token.kind == "!=":
            return left != right
        elif node.token.kind == "==":
            return left == right
        elif node.token.kind == "**":
            testMathOperands("**", left, right)
            return right ** left
        elif node.token.value == "in":
            if isinstance(right, dict):
                if not isinstance(left, string):
                    raise infixExpectationError('in-object', 'string on left side')
            elif isinstance(right, string):
                if not isinstance(left, string):
                    raise infixExpectationError('in-string', 'string on left side')
            elif not isinstance(right, list):
                raise infixExpectationError(
                    'in', 'Array, string, or object on right side')
            try:
                return left in right
            except TypeError:
                raise infixExpectationError('in', 'scalar value, collection')

        elif node.token.kind == ".":
            if not isinstance(left, dict):
                raise infixExpectationError('.', 'object')
            try:
                return left[right]
            except KeyError:
                raise TemplateError(
                    '"{}" not found in {}'.format(right, json.dumps(left)))

    def visit_List(self, node):
        list = []

        if node.list[0] is not None:
            for item in node.list:
                list.append(self.visit(item))

        return list

    def visit_ValueAccess(self, node):
        value = self.visit(node.arr)
        left = 0
        right = None

        if node.left:
            left = self.visit(node.left)
        if node.right:
            right = self.visit(node.right)

        if isinstance(value, (list, string)):
            if node.isInterval:
                if right is None:
                    right = len(value)
                try:
                    return value[left:right]
                except TypeError:
                    raise InterpreterError('should only use integers to access arrays or strings')
            else:
                try:
                    return value[left]
                except IndexError:
                    raise TemplateError('index out of bounds')
                except TypeError:
                    raise InterpreterError('should only use integers to access arrays or strings')

        if not isinstance(value, dict):
            raise infixExpectationError('[..]', 'object, array, or string')
        if not isinstance(left, string):
            raise infixExpectationError('[..]', 'string index')

        try:
            return value[left]
        except KeyError:
            return None

    def visit_Builtin(self, node):
        args = []
        try:
            builtin = self.context[node.token.value]
        except KeyError:
            raise InterpreterError(
                'unknown context value {}'.format(node.token.value))
        if callable(builtin):
            if node.args is not None:
                for item in node.args:
                    args.append(self.visit(item))
                return builtin(*args)
        return builtin

    def visit_Object(self, node):
        obj = {}
        for key in node.obj:
            obj[key] = self.visit(node.obj[key])
        return obj

    def interpret(self, tree):
        return self.visit(tree)


def testMathOperands(op, left, right):
    if not isNumber(left):
        raise infixExpectationError(op, 'number')
    if not isNumber(right):
        raise infixExpectationError(op, 'number')
    return


def testComparisonOperands(op, left, right):
    if type(left) != type(right) or \
            not (isinstance(left, (int, float, string)) and not isinstance(left, bool)):
        raise infixExpectationError(op, 'numbers/strings')
    return


def isNumber(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)
