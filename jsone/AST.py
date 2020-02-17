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


class Builtin(ASTNode):
    def __init__(self, token, args):
        ASTNode.__init__(self, token)
        self.args = args


class List(ASTNode):
    def __init__(self, token, list):
        ASTNode.__init__(self, token)
        self.list = list


class ValueAccess(ASTNode):
    def __init__(self, token, arr, isInterval, left, right):
        ASTNode.__init__(self, token)
        self.arr = arr
        self.isInterval = isInterval
        self.left = left
        self.right = right


class Object(ASTNode):
    def __init__(self, token, obj):
        ASTNode.__init__(self, token)
        self.obj = obj
