class ASTnode(object):
    def __init__(self, token):
        self.token = token


class BinOp(ASTnode):
    def __init__(self, left, right, op):
        ASTnode.__init__(self, op)
        self.left = left
        self.op = op
        self.right = right


class UnaryOp(ASTnode):
    def __init__(self, op, expr):
        ASTnode.__init__(self, op)
        self.op = op
        self.expr = expr


class Builtins(ASTnode):
    def __init__(self, builtin, args, token):
        ASTnode.__init__(self, token)
        self.builtin = builtin
        self.args = args
