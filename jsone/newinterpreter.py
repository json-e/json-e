class Interpreter:

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

    def interpret(self, tree):
        return self.visit(tree)
