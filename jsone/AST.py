class AST(object):
    def __init__(self, token):
        self.token = token


class tkn(object):
    def __init__(self, valueType, value):
        self.value = value
        self.valueType = valueType


class Term(AST):
    def __init__(self, token):
        AST.__init__(self, token)
        self.value = token.value


class BinOp(AST):
    def __init__(self, left, right, op):
        AST.__init__(self, op)
        self.left = left
        self.op = op
        self.right = right


class UnaryOp(AST):
    def __init__(self, op, expr):
        AST.__init__(self, op)
        self.op = op
        self.expr = expr


class Builtins(AST):
    def __init__(self, builtin, args, token):
        AST.__init__(self, token)
        self.builtin = builtin
        self.args = args  # a list of AST nodes

# class NodeVisitor(object):
#     def visit(self, node):
#         method_name = 'visit_' + type(node).__name__
#         visitor = getattr(self, method_name, self.generic_visit)
#         return visitor(node)
#
#     def generic_visit(self, node):
#         raise Exception('No visit_{} method'.format(type(node).__name__))
