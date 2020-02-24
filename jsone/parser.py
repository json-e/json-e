from .AST import Primitive, UnaryOp, ContextValue, BinOp, FunctionCall, ValueAccess, Object, List
from collections import namedtuple
import re
from .shared import TemplateError

Token = namedtuple('Token', ['kind', 'value', 'start', 'end'])


class SyntaxError(TemplateError):

    @classmethod
    def unexpected(cls, got):
        return cls('Found {}, expected !, (, +, -, [, false, identifier, null, number, string, '
                   'true, {}'.format(got.value, "{"))


class Parser(object):
    def __init__(self, tokens, source):
        self.tokens = tokens
        self.source = source
        self.current_token = next(self.tokens)
        self.unaryOpTokens = ["-", "+", "!"]
        self.primitivesTokens = ["number", "null", "true", "false", "string"]
        self.operatorsByPriority = [["||"], ["&&"], ["in"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"],
                                    ["*", "/"], ["**"]]

    def take_token(self, *kinds):
        if not self.current_token:
            raise SyntaxError('Unexpected end of input')
        if kinds and self.current_token.kind not in kinds:
            raise SyntaxError.unexpected(self.current_token)
        try:
            self.current_token = next(self.tokens)
        except StopIteration:
            self.current_token = None
        except SyntaxError as exc:
            raise exc

    def parse(self, level=0):
        """  expr : logicalAnd (OR logicalAnd)* """
        """  logicalAnd : inStatement (AND inStatement)* """
        """  inStatement : equality (IN equality)*  """
        """  equality : comparison (EQUALITY | INEQUALITY  comparison)* """
        """  comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)* """
        """  addition : multiplication (PLUS | MINUS multiplication)* """
        """  multiplication : exponentiation (MUL | DIV exponentiation)* """
        """  exponentiation : propertyAccess (EXP exponentiation)* """
        if level == len(self.operatorsByPriority) - 1:
            node = self.parse_property_access()
            token = self.current_token

            while token is not None and token.kind in self.operatorsByPriority[level]:
                self.take_token(token.kind)
                node = BinOp(token, self.parse(level), node)
                token = self.current_token
        else:
            node = self.parse(level + 1)
            token = self.current_token

            while token is not None and token.kind in self.operatorsByPriority[level]:
                self.take_token(token.kind)
                node = BinOp(token, node, self.parse(level + 1))
                token = self.current_token

        return node

    def parse_property_access(self):
        """  propertyAccess : unit (accessWithBrackets (functionCall)? | DOT id)* """
        node = self.parse_unit()
        token = self.current_token
        while token is not None and (token.kind == "[" or token.kind == "."):
            if token.kind == "[":
                node = self.parse_access_with_brackets(node)
                if self.current_token is not None and self.current_token.kind == "(":
                    node = self.parse_function_call(node)
            elif token.kind == ".":
                token = self.current_token
                self.take_token(".")
                right_part = Primitive(self.current_token)
                self.take_token("identifier")
                node = BinOp(token, node, right_part)
            token = self.current_token
        return node

    def parse_unit(self):
        # unit : unaryOp unit | primitives | contextValue (functionCall)? | LPAREN expr RPAREN | list | object
        token = self.current_token
        if self.current_token is None:
            raise SyntaxError('Unexpected end of input')
        node = None

        if token.kind in self.unaryOpTokens:
            self.take_token(token.kind)
            node = UnaryOp(token, self.parse_unit())
        elif token.kind in self.primitivesTokens:
            self.take_token(token.kind)
            node = Primitive(token)
        elif token.kind == "identifier":
            self.take_token(token.kind)
            node = ContextValue(token)
            if self.current_token is not None and self.current_token.kind == "(":
                node = self.parse_function_call(node)
        elif token.kind == "(":
            self.take_token("(")
            node = self.parse()
            self.take_token(")")
        elif token.kind == "[":
            node = self.parse_list()
        elif token.kind == "{":
            node = self.parse_object()

        return node

    def parse_function_call(self, name):
        """functionCall: LPAREN (expr ( COMMA expr)*)? RPAREN"""
        args = []
        token = self.current_token
        self.take_token("(")
        node = self.parse()

        if node is not None:
            args.append(node)
        while self.current_token.kind == ",":
            self.take_token(",")
            node = self.parse()
            args.append(node)
        self.take_token(")")

        node = FunctionCall(token, name, args)

        return node

    def parse_list(self):
        """  list: LSQAREBRAKET (expr (COMMA expr)*)? RSQAREBRAKET """
        arr = []
        token = self.current_token
        self.take_token("[")

        if self.current_token != "]":
            node = self.parse()
            arr.append(node)

            while self.current_token and self.current_token.kind == ",":
                self.take_token(",")
                node = self.parse()
                arr.append(node)

        self.take_token("]")
        node = List(token, arr)
        return node

    def parse_access_with_brackets(self, node):
        """  valueAccess : LSQAREBRAKET expr |(expr? COLON expr?)  RSQAREBRAKET)"""
        left = None
        right = None
        is_interval = False
        token = self.current_token
        self.take_token("[")
        if self.current_token.kind != ":":
            left = self.parse()
        if self.current_token.kind == ":":
            is_interval = True
            self.take_token(":")
        if self.current_token.kind != "]":
            right = self.parse()

        self.take_token("]")
        node = ValueAccess(token, node, is_interval, left, right)

        return node

    def parse_object(self):
        # """   object : LCURLYBRACE ( STR | ID COLON expr (COMMA STR | ID COLON expr)*)?
        # RCURLYBRACE """
        obj = {}
        token = self.current_token
        self.take_token("{")

        while self.current_token.kind == "string" or self.current_token.kind == "identifier":
            key = self.current_token.value
            if self.current_token.kind == "string":
                key = parse_string(key)
            self.take_token(self.current_token.kind)
            self.take_token(":")
            value = self.parse()
            obj[key] = value
            if self.current_token and self.current_token.kind == "}":
                break
            else:
                self.take_token(",")

        self.take_token("}")
        node = Object(token, obj)

        return node


def parse_string(string):
    return string[1:-1]


class Tokenizer(object):
    def __init__(self):
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
        self.tokens = [
            '**', '+', '-', '*', '/', '[', ']', '.', '(', ')', '{', '}', ':', ',',
            '>=', '<=', '<', '>', '==', '!=', '!', '&&', '||', 'true', 'false', 'in',
            'null', 'number', 'identifier', 'string',
        ]
        token_patterns = [
            '({})'.format(patterns.get(t, re.escape(t)))
            for t in self.tokens]
        if ignore:
            token_patterns.append(('(?:{})'.format(ignore)))
        self.token_re = re.compile('^(?:' + '|'.join(token_patterns) + ')')

    def change_tokenizer(self, grammar):
        # build a regular expression to generate a sequence of tokens
        self.tokens = grammar.tokens
        token_patterns = [
            '({})'.format(grammar.patterns.get(t, re.escape(t)))
            for t in self.tokens]
        if grammar.ignore:
            token_patterns.append(('(?:{})'.format(grammar.ignore)))
        self.token_re = re.compile('^(?:' + '|'.join(token_patterns) + ')')

    def generate_tokens(self, source):
        offset = 0
        while True:
            start = offset
            remainder = source[offset:]
            mo = self.token_re.match(remainder)
            if not mo:
                if remainder:
                    raise SyntaxError(
                        "Unexpected input for '{}' at '{}'".format(source, remainder))
                break
            offset += mo.end()

            # figure out which token matched (note that idx is 0-based)
            indexes = list(
                filter(lambda x: x[1] is not None, enumerate(mo.groups())))
            if indexes:
                idx = indexes[0][0]
                yield Token(
                    kind=self.tokens[idx],
                    value=mo.group(idx + 1),  # (mo.group is 1-based)
                    start=start,
                    end=offset)
