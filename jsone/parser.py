from .AST import ASTNode, UnaryOp, BinOp, Builtin, ValueAccess, Object, List
from collections import namedtuple
import re
from .shared import TemplateError

Token = namedtuple('Token', ['kind', 'value', 'start', 'end'])


class SyntaxError(TemplateError):

    @classmethod
    def unexpected(cls, got, exp):
        exp = ', '.join(sorted(exp))
        return cls('Found {}, expected {}'.format(got.value, exp))


class Parser(object):
    def __init__(self, tokens, source):
        self.tokens = tokens
        self.source = source
        self.current_token = next(self.tokens)
        self.unaryOpTokens = ["-", "+", "!"]
        self.primitivesTokens = ["number", "null", "true", "false"]

    def eat(self, *kinds):
        if not self.current_token:
            raise SyntaxError('Unexpected end of input')
        if kinds and self.current_token.kind not in kinds:
            raise SyntaxError.unexpected(self.current_token, kinds)
        try:
            self.current_token = next(self.tokens)
        except StopIteration:
            self.current_token = None
        except SyntaxError as exc:
            raise exc

    def parse(self):
        """  expr : logicalAnd (OR logicalAnd)* """
        node = self.logicalAnd()
        token = self.current_token

        while token is not None and token.kind == "||":
            self.eat(token.kind)
            node = BinOp(token, node, self.logicalAnd())
            token = self.current_token

        return node

    def logicalAnd(self):
        """  logicalAnd : inStatement (AND inStatement)* """
        node = self.inStatement()
        token = self.current_token

        while token is not None and token.kind == "&&":
            self.eat(token.kind)
            node = BinOp(token, node, self.inStatement())
            token = self.current_token

        return node

    def inStatement(self):
        """  inStatement : equality (IN equality)* """
        node = self.equality()
        token = self.current_token

        while token is not None and token.kind == "in":
            self.eat(token.kind)
            node = BinOp(token, node, self.equality())
            token = self.current_token

        return node

    def equality(self):
        """  equality : comparison (EQUALITY | INEQUALITY  comparison)* """
        node = self.comparison()
        token = self.current_token
        operations = ["==", "!="]

        while token is not None and token.kind in operations:
            self.eat(token.kind)
            node = BinOp(token, node, self.comparison())
            token = self.current_token

        return node

    def comparison(self):
        """  comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)* """
        node = self.addition()
        token = self.current_token
        operations = ["<", ">", ">=", "<="]

        while token is not None and token.kind in operations:
            self.eat(token.kind)
            node = BinOp(token, node, self.addition())
            token = self.current_token

        return node

    def addition(self):
        """  addition : multiplication (PLUS | MINUS multiplication)* """
        node = self.multiplication()
        token = self.current_token
        operations = ["-", "+"]

        while token is not None and token.kind in operations:
            self.eat(token.kind)
            node = BinOp(token, node, self.multiplication())
            token = self.current_token

        return node

    def multiplication(self):
        """  multiplication : exponentiation (MUL | DIV exponentiation)* """
        node = self.exponentiation()
        token = self.current_token
        operations = ["*", "/"]

        while token is not None and token.kind in operations:
            self.eat(token.kind)
            node = BinOp(token, node, self.exponentiation())
            token = self.current_token

        return node

    def exponentiation(self):
        """  exponentiation : factor (EXP exponentiation)* """
        node = self.factor()
        token = self.current_token

        while token is not None and token.kind == "**":
            self.eat(token.kind)
            node = BinOp(token, self.exponentiation(), node)
            token = self.current_token

        return node

    def factor(self):
        # factor : unaryOp factor | primitives | (string | list | builtin) (valueAccess)? |
        #           |  LPAREN expr RPAREN |object
        token = self.current_token
        node = None

        if token.kind in self.unaryOpTokens:
            self.eat(token.kind)
            node = UnaryOp(token, self.factor())
        elif token.kind in self.primitivesTokens:
            self.eat(token.kind)
            node = ASTNode(token)
        elif token.kind == "string":
            self.eat(token.kind)
            node = ASTNode(token)
            node = self.valueAccess(node)
        elif token.kind == "(":
            self.eat("(")
            node = self.parse()
            self.eat(")")
        elif token.kind == "[":
            node = self.list()
            node = self.valueAccess(node)
        elif token.kind == "{":
            node = self.object()
        elif token.kind == "identifier":
            node = self.builtins()
            node = self.valueAccess(node)

        return node

    def builtins(self):
        """  builtins : ID((LPAREN (expr ( COMMA expr)*)? RPAREN)? | (DOT ID)*) """
        args = None
        token = self.current_token
        self.eat("identifier")

        if self.current_token is not None and self.current_token.kind == "(":
            args = []
            self.eat("(")
            node = self.parse()
            if node is not None:
                args.append(node)

            while self.current_token.kind == ",":
                self.eat(",")
                node = self.parse()
                args.append(node)
            self.eat(")")

        node = Builtin(token, args)
        token = self.current_token

        while token is not None and token.kind == ".":
            self.eat(".")
            right = ASTNode(self.current_token)
            self.eat(self.current_token.kind)
            node = BinOp(token, node, right)
            token = self.current_token

        return node

    def list(self):
        arr = []
        token = self.current_token
        self.eat("[")

        if self.current_token != "]":
            node = self.parse()
            arr.append(node)

            while self.current_token and self.current_token.kind == ",":
                self.eat(",")
                node = self.parse()
                arr.append(node)

        self.eat("]")
        node = List(token, arr)
        return node

    def valueAccess(self, node):
        """  valueAccess : LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET) (LSQAREBRAKET expr
        //   |(expr? SEMI expr?)  RSQAREBRAKET))*"""
        left = None
        right = None
        isInterval = False
        token = self.current_token

        while token is not None and token.kind == "[":
            self.eat("[")
            if self.current_token.kind != ":":
                left = self.parse()
            if self.current_token.kind == ":":
                isInterval = True
                self.eat(":")
            if self.current_token.kind != "]":
                right = self.parse()

            self.eat("]")
            node = ValueAccess(token, node, isInterval, left, right)
            token = self.current_token

        return node

    def object(self):
        # """   object : LCURLYBRACE ( STR | ID SEMI expr (COMMA STR | ID SEMI expr)*)?
        # RCURLYBRACE (DOT ID)?"""
        obj = {}
        token = self.current_token
        self.eat("{")

        while self.current_token.kind == "string" or self.current_token.kind == "identifier":
            key = self.current_token.value
            if self.current_token.kind == "string":
                key = parseString(key)
            self.eat(self.current_token.kind)
            self.eat(":")
            value = self.parse()
            obj[key] = value
            if self.current_token and self.current_token.kind == "}":
                break
            else:
                self.eat(",")

        self.eat("}")
        node = Object(token, obj)
        token = self.current_token
        while token is not None and token.kind == ".":
            self.eat(".")
            right = ASTNode(self.current_token)
            self.eat(self.current_token.kind)
            node = BinOp(token, node, right)
            token = self.current_token
        return node


def parseString(string):
    return string[1:-1]


def generate_tokens(source):
    offset = 0
    ignore = '\\s+'
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
    if ignore:
        token_patterns.append(('(?:{})'.format(ignore)))
    token_re = re.compile('^(?:' + '|'.join(token_patterns) + ')')
    offset = 0
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
