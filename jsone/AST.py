class ASTNode(object):
    def __init__(self, token):
        self.token = token

    def __eq__(self, other):
        res = self.token == other.token
        return res


class BinOp(ASTNode):
    def __init__(self, token, left, right):
        ASTNode.__init__(self, token)
        self.left = left
        self.right = right

    def __eq__(self, other):
        return self.token == other.token and self.left == other.left and self.right == other.right


class UnaryOp(ASTNode):
    def __init__(self, token, expr):
        ASTNode.__init__(self, token)
        self.expr = expr

    def __eq__(self, other):
        return self.token == other.token and self.expr == other.expr


class Builtin(ASTNode):
    def __init__(self, token, args):
        ASTNode.__init__(self, token)
        self.args = args

    def __eq__(self, other):
        return self.token == other.token and self.args == other.args


class List(ASTNode):
    def __init__(self, token, list):
        ASTNode.__init__(self, token)
        self.list = list

    def __eq__(self, other):
        return self.token == other.token and self.list == other.list


class ValueAccess(ASTNode):
    def __init__(self, token, arr, isInterval, left, right):
        ASTNode.__init__(self, token)
        self.arr = arr
        self.isInterval = isInterval
        self.left = left
        self.right = right

    def __eq__(self, other):
        res = self.token == other.token and self.left == other.left and self.right == other.right
        return res and self.isInterval == other.isInterval and self.arr == other.arr


class Object(ASTNode):
    def __init__(self, token, obj):
        ASTNode.__init__(self, token)
        self.obj = obj

    def __eq__(self, other):
        return self.token == other.token and self.obj == other.obj
