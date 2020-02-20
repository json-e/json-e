class ASTNode(object):
    def __init__(self, token):
        self.token = token


Primitive = ASTNode


class BinOp(ASTNode):
    def __init__(self, token, left, right):
        ASTNode.__init__(self, token)
        self.left = left
        self.right = right


class UnaryOp(ASTNode):
    def __init__(self, token, expr):
        ASTNode.__init__(self, token)
        self.expr = expr


class ContextValue(ASTNode):
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
