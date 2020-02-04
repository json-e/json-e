class Interpreter:
    def __init__(self, context):
        self.context = context

    def visit(self, node):
        method_name = 'visit_' + type(node).__name__
        visitor = getattr(self, method_name)
        return visitor(node)

    def visit_ASTNode(self, node):
        if node.token.kind == "number":
            return int(node.token.value)
        elif node.token.kind == "null":
            return None
        elif node.token.kind == "string":
            return node.token.value[1:-1]
        elif node.token.kind == "true":
            return True
        elif node.token.kind == "false":
            return False

    def visit_UnaryOp(self, node):
        if node.token.kind == "+":
            return +self.visit(node.expr)
        elif node.token.kind == "-":
            return -self.visit(node.expr)
        elif node.token.kind == "!":
            return not self.visit(node.expr)

    def visit_BinOp(self, node):
        if node.token.kind == "+":
            return self.visit(node.left) + self.visit(node.right)
        elif node.token.kind == "-":
            return self.visit(node.left) - self.visit(node.right)
        elif node.token.kind == "/":
            return self.visit(node.left) / self.visit(node.right)
        elif node.token.kind == "*":
            return self.visit(node.left) * self.visit(node.right)
        elif node.token.kind == ">":
            return self.visit(node.left) > self.visit(node.right)
        elif node.token.kind == "<":
            return self.visit(node.left) < self.visit(node.right)
        elif node.token.kind == ">=":
            return self.visit(node.left) >= self.visit(node.right)
        elif node.token.kind == "<=":
            return self.visit(node.left) <= self.visit(node.right)
        elif node.token.kind == "!=":
            return self.visit(node.left) != self.visit(node.right)
        elif node.token.kind == "==":
            return self.visit(node.left) == self.visit(node.right)
        elif node.token.kind == "||":
            return self.visit(node.left) or self.visit(node.right)
        elif node.token.kind == "&&":
            return self.visit(node.left) and self.visit(node.right)
        elif node.token.kind == "**":
            return self.visit(node.left) ** self.visit(node.right)
        elif node.token.kind == ".":
            obj = self.visit(node.left)
            key = node.right.value

            if key in obj:
                return obj[key]
        elif node.token.value == "in":
            left = self.visit(node.left)
            right = self.visit(node.right)
            return left in right

    def visit_List(self, node):
        list = []

        if node.list[0] is not None:
            for item in node.list:
                list.append(self.visit(item))

        return list

    def visit_ArrayAccess(self, node):
        array = self.context[node.token.value]
        left = None
        right = None

        if node.left:
            left = self.visit(node.left)
        else:
            left = 0
        if node.right:
            right = self.visit(node.right)

        if left < 0:
            left = len(array) + left

        if node.isInterval:
            if right is None:
                right = len(array)
            if right < 0:
                right = len(array) + right
                if right < 0:
                    right = 0
            if left > right:
                left = right
            return array[left:right]

        return array[left]

    def visit_Builtin(self, node):
        args = []
        builtin = self.context[node.token.value]
        if callable(builtin):
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
