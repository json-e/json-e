class ASTNode(object):
    def __init__(self, token):
        self.token = token


class BinOp(ASTNode):
    def __init__(self, op, left, right):
        ASTNode.__init__(self, op)
        self.left = left
        self.op = op
        self.right = right


class UnaryOp(ASTNode):
    def __init__(self, op, expr):
        ASTNode.__init__(self, op)
        self.op = op
        self.expr = expr


class Builtins(ASTNode):
    def __init__(self, token, builtin, args):
        ASTNode.__init__(self, token)
        self.builtin = builtin
        self.args = args
