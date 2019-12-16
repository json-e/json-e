from AST import Term, UnaryOp


class Parser(object):
    def __init__(self, tokens, source):
        self.tokens = tokens
        self.source = source
        # set current token to the first token taken from the input
        self.current_token = self.next(self.tokens)

    def eat(self, token_type):
        if self.current_token.kind == token_type:
            self.current_token = self.next(self.tokens)

    def factor(self):
        """ factor: (PLUS | MINUS) factor | Primitives """
        token = self.current_token
        if token.kind == "+":
            self.eat("+")
            node = UnaryOp(token, self.factor())
        elif token.kind == "-":
            self.eat("-")
            node = UnaryOp(token, self.factor())
        elif token.kind == "!":
            self.eat("!")
            node = UnaryOp(token, self.factor())
        elif token.kind == "number":
            self.eat("number")
            node = Term(token)
        return node

    def parse(self):
        node = self.expr()
        return node
