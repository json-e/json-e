from .AST import ASTnode, UnaryOp
from collections import namedtuple
import re

Token = namedtuple('Token', ['kind', 'value', 'start', 'end'])


class Parser(object):
    def __init__(self, tokens, source):
        self.tokens = tokens
        self.source = source
        self.current_token = next(self.tokens)

    def eat(self, token_type):
        if self.current_token.kind == token_type:
            try:
                self.current_token = next(self.tokens)
            except StopIteration:
                self.current_token = None

    def parse(self):
        """ factor: (PLUS | MINUS) factor | Primitives """
        token = self.current_token
        if token.kind == "+":
            self.eat("+")
            node = UnaryOp(token, self.parse())
        elif token.kind == "-":
            self.eat("-")
            node = UnaryOp(token, self.parse())
        elif token.kind == "!":
            self.eat("!")
            node = UnaryOp(token, self.parse())
        elif token.kind == "number":
            self.eat("number")
            node = ASTnode(token)
        return node


def generate_tokens(source):
    offset = 0
    patterns = {
        'number': '[0-9]+(?:\\.[0-9]+)?',
        'identifier': '[a-zA-Z_][a-zA-Z_0-9]*',
        'string': '\'[^\']*\'|"[^"]*"',
        # avoid matching these as prefixes of identifiers e.g., `insinutations`
        'true': 'true(?![a-zA-Z_0-9])',
        'false': 'false(?![a-zA-Z_0-9])',
        'in': 'in(?![a-zA-Z_0-9])',
        'null': 'null(?![a-zA-Z_0-9])',
    }
    tokens = [
        '**', '+', '-', '*', '/', '[', ']', '.', '(', ')', '{', '}', ':', ',',
        '>=', '<=', '<', '>', '==', '!=', '!', '&&', '||', 'true', 'false', 'in',
        'null', 'number', 'identifier', 'string',
    ]
    token_patterns = [
        '({})'.format(patterns.get(t, re.escape(t)))
        for t in tokens]
    token_re = re.compile('^(?:' + '|'.join(token_patterns) + ')')

    while True:
        start = offset
        remainder = source[offset:]
        mo = token_re.match(remainder)
        if not mo:
            if remainder:
                raise SyntaxError(
                    "Unexpected input: '{}'".format(remainder))
            break
        offset += mo.end()

        # figure out which token matched (note that idx is 0-based)
        indexes = list(
            filter(lambda x: x[1] is not None, enumerate(mo.groups())))
        if indexes:
            idx = indexes[0][0]
            yield Token(
                kind=tokens[idx],
                value=mo.group(idx + 1),  # (mo.group is 1-based)
                start=start,
                end=offset)
