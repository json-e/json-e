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
        elif node.token.kind == "str":
            return node.token.value
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

    def visit_List(self, node):
        list = []

        if node.list is not None:
            for item in node.list:
                list.append(self.visit(item))

        return list

    def visitArrayAccess(self, node):
        array = self.context[node.token.value]
        left = None
        right = None

        if node.left:
            left = self.visit(node.left)
        if node.right:
            right = self.visit(node.right)

        if left < 0:
            left = len(array) +left

        if node.isInterval:
            if right is None:
                right = len(array)




    def interpret(self, tree):
        return self.visit(tree)
