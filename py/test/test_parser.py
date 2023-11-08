from __future__ import absolute_import, print_function, unicode_literals

import pytest
from jsone import JSONTemplateError
from jsone.parser import Tokenizer, Token, Parser
from jsone.AST import ASTNode, UnaryOp, BinOp, FunctionCall, ValueAccess, Object, List

ignoring_tokenizer = Tokenizer(
    r" +",
    {
        "symbol": r"[A-Z]+",
        "number": r"[0-9]+",
    },
    ["symbol", "number", "+", "-"],
)

simple_tokenizer = Tokenizer(
    None,
    {
        "number": r"[0-9]",
    },
    ["number", "+", "-", "*", "(", ")"],
)


tokenizer_tests = {
    "empty": (ignoring_tokenizer, "", []),
    "whitespace-pre": (simple_tokenizer, " 1+2", JSONTemplateError),
    "whitespace-in": (simple_tokenizer, "1 + 2", JSONTemplateError),
    "whitespace-post": (simple_tokenizer, "1+2 ", JSONTemplateError),
    "whitespace-ok": (
        ignoring_tokenizer,
        " 1 + 2 ",
        [
            Token("number", "1", 1, 2),
            Token("+", "+", 3, 4),
            Token("number", "2", 5, 6),
        ],
    ),
    "multi-char": (
        ignoring_tokenizer,
        "1234 ABCD",
        [
            Token("number", "1234", 0, 4),
            Token("symbol", "ABCD", 5, 9),
        ],
    ),
    "invalid": (simple_tokenizer, "xxx", JSONTemplateError),
}


@pytest.mark.parametrize(
    "tokenizer,input,output", tokenizer_tests.values(), ids=tokenizer_tests.keys()
)
def test_tokenizer(tokenizer, input, output):
    try:
        got = list(tokenizer.generate_tokens(input))
    except Exception as exc:
        if isinstance(output, list):
            raise  # unexpected exception
        if not isinstance(exc, output):
            raise  # exception different from the expected
        return  # OK
    assert got == output


def treesequals(first, second):
    if first is None and second is None:
        return True
    elif first is None or second is None:
        return False
    elif first.token != second.token:
        return False
    if isinstance(first, BinOp):
        return treesequals(first.left, second.left) and treesequals(
            first.right, second.right
        )
    else:
        return True


def test_parser_equal_precedence():
    input = "1+2+3"
    output = BinOp(
        Token("+", "+", 3, 4),
        BinOp(
            Token("+", "+", 1, 2),
            ASTNode(Token("number", "1", 0, 1)),
            ASTNode(Token("number", "2", 2, 3)),
        ),
        ASTNode(Token("number", "3", 4, 5)),
    )
    parser = Parser(input, simple_tokenizer)
    assert treesequals(parser.parse(), output)


def test_parser_diff_precedence():
    input = "3+8*2"
    output = BinOp(
        Token("+", "+", 1, 2),
        ASTNode(Token("number", "3", 0, 1)),
        BinOp(
            Token("*", "*", 3, 4),
            ASTNode(Token("number", "8", 2, 3)),
            ASTNode(Token("number", "2", 4, 5)),
        ),
    )
    parser = Parser(input, simple_tokenizer)
    assert treesequals(parser.parse(), output)


def test_parser_parens():
    input = "(3+8)*2"
    output = BinOp(
        Token("*", "*", 5, 6),
        BinOp(
            Token("+", "+", 2, 3),
            ASTNode(Token("number", "3", 1, 2)),
            ASTNode(Token("number", "8", 3, 4)),
        ),
        ASTNode(Token("number", "2", 6, 7)),
    )
    parser = Parser(input, simple_tokenizer)
    assert treesequals(parser.parse(), output)


def test_parser_left_precedence():
    input = "3*8+2"
    output = BinOp(
        Token("+", "+", 3, 4),
        BinOp(
            Token("*", "*", 1, 2),
            ASTNode(Token("number", "3", 0, 1)),
            ASTNode(Token("number", "8", 2, 3)),
        ),
        ASTNode(Token("number", "2", 4, 5)),
    )
    parser = Parser(input, simple_tokenizer)
    assert treesequals(parser.parse(), output)


def test_parser_parens_right():
    input = "3*(8+2)"
    output = BinOp(
        Token("*", "*", 1, 2),
        ASTNode(Token("number", "3", 0, 1)),
        BinOp(
            Token("+", "+", 4, 5),
            ASTNode(Token("number", "8", 3, 4)),
            ASTNode(Token("number", "2", 5, 6)),
        ),
    )
    parser = Parser(input, simple_tokenizer)
    assert treesequals(parser.parse(), output)


def test_parser_lots_parens():
    input = "((((4))))"
    output = ASTNode(Token("number", "4", 4, 5))
    parser = Parser(input, simple_tokenizer)
    assert treesequals(parser.parse(), output)


def fail_parsing(input, message):
    try:
        parser = Parser(input, simple_tokenizer)
        parser.parse()
    except JSONTemplateError as exc:
        assert str(exc) == "SyntaxError: " + message


def test_parser_fail_ident():
    fail_parsing("x", "Unexpected input for 'x' at 'x'")


def test_parser_fail_non_operator():
    fail_parsing("12", "Found 2, expected *, +, -")


def test_parser_fail_unexpected_eoi():
    fail_parsing("(", "Unexpected end of input")


def test_parser_fail_unexpected_eoi_binop():
    fail_parsing("1+", "Unexpected end of input")


def test_parser_fail_unexpected_rparen():
    fail_parsing(")", "Found ), expected (, number")


def test_parser_fail_unnested_parens():
    fail_parsing("((1+2)+3", "Unexpected end of input")
