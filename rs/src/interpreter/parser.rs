//! An interpreter for the expression language embedded in JSON-e.
//!
//! Evaluation of expressions operates in two phases: parsing to an AST, and evaluating that AST.

#![allow(unused_variables)]
#![allow(dead_code)]

use super::Node;
use crate::whitespace::ws;
use anyhow::{anyhow, Result};
use nom::{
    branch::alt,
    bytes::complete::{tag, take_till},
    character::complete::{alpha1, alphanumeric1, char, digit1},
    combinator::{complete, map_res, not, opt, recognize},
    multi::{fold_many0, many0, separated_list0},
    sequence::{delimited, pair, tuple},
    Err, IResult,
};

// atomic values

/// Parse a number token (integer or decimal)
fn number(input: &str) -> IResult<&str, Node<'_>> {
    fn node(input: &str) -> Result<Node, std::num::ParseIntError> {
        Ok(Node::Number(input))
    }

    map_res(
        ws(recognize(pair(digit1, opt(pair(char('.'), digit1))))),
        node,
    )(input)
}

/// Parse a atomic literal JSON value (true, false, null)
fn literal(input: &str) -> IResult<&str, Node<'_>> {
    fn node(input: &str) -> Result<Node, ()> {
        Ok(match input {
            "true" => Node::True,
            "false" => Node::False,
            "null" => Node::Null,
            _ => unreachable!(),
        })
    }

    map_res(
        ws(recognize(pair(
            alt((tag("true"), tag("false"), tag("null"))),
            // things like "falsey", where a literal is followed by more
            // identifier characters, are not literals
            not(alt((alphanumeric1, tag("_")))),
        ))),
        node,
    )(input)
}

/// Parse an identifier as an &str
fn ident_str(input: &str) -> IResult<&str, &str> {
    ws(recognize(pair(
        alt((alpha1, tag("_"))),
        many0(alt((alphanumeric1, tag("_")))),
    )))(input)
}

/// Parse an identifier as a Node
fn ident(input: &str) -> IResult<&str, Node<'_>> {
    fn node(input: &str) -> Result<Node, ()> {
        Ok(Node::Ident(input))
    }

    map_res(ident_str, node)(input)
}

/// Parse a string (single- or double-quoted, with no escaping)
fn string_str(input: &str) -> IResult<&str, &str> {
    fn strip_quotes(s: &str) -> Result<&str, ()> {
        Ok(&s[1..s.len() - 1])
    }
    map_res(
        ws(recognize(alt((
            delimited(char('"'), take_till(|c| c == '"'), char('"')),
            delimited(char('\''), take_till(|c| c == '\''), char('\'')),
        )))),
        strip_quotes,
    )(input)
}

/// Parse a string as a Node
fn string(input: &str) -> IResult<&str, Node<'_>> {
    fn node(input: &str) -> Result<Node, ()> {
        Ok(Node::String(input))
    }

    map_res(string_str, node)(input)
}

/// Parse any atomic value
fn atom(input: &str) -> IResult<&str, Node<'_>> {
    alt((number, literal, ident, string))(input)
}

// recognizers for operators that are prefixes of other tokens

/// The "in" operator (disambiguated from longer identifiers)
fn in_op(input: &str) -> IResult<&str, &str> {
    recognize(pair(tag("in"), not(alt((alphanumeric1, tag("_"))))))(input)
}

/// The "<" operator (disambiguated from "<=")
fn lt_op(input: &str) -> IResult<&str, &str> {
    recognize(pair(tag("<"), not(tag("="))))(input)
}

/// The ">" operator (disambiguated from ">=")
fn gt_op(input: &str) -> IResult<&str, &str> {
    recognize(pair(tag(">"), not(tag("="))))(input)
}

/// The "!" operator (disambiguated from "!=")
fn bang_op(input: &str) -> IResult<&str, &str> {
    recognize(pair(tag("!"), not(tag("="))))(input)
}

/// The "*" operator (disambiguated from "**")
fn mul_op(input: &str) -> IResult<&str, &str> {
    recognize(pair(tag("*"), not(tag("*"))))(input)
}

// combinations of atoms into larger structures

/// A parenthesized expression
fn parens(input: &str) -> IResult<&str, Node<'_>> {
    ws(delimited(char('('), expression, char(')')))(input)
}

/// An array literal
fn array_literal(input: &str) -> IResult<&str, Node<'_>> {
    fn node<'a>(input: Vec<Node<'a>>) -> Result<Node<'a>, ()> {
        Ok(Node::Array(input))
    }
    map_res(
        ws(delimited(
            char('['),
            separated_list0(ws(tag(",")), expression),
            char(']'),
        )),
        node,
    )(input)
}

/// An object literal, allowing either strings or identifiers as keys
fn object_literal(input: &str) -> IResult<&str, Node<'_>> {
    fn node<'a>(mut input: Vec<(&'a str, &'a str, Node<'a>)>) -> Result<Node<'a>, ()> {
        Ok(Node::Object(
            input.drain(..).map(|(k, _, v)| (k, v)).collect(),
        ))
    }
    map_res(
        ws(delimited(
            char('{'),
            separated_list0(
                ws(tag(",")),
                tuple((ws(alt((string_str, ident_str))), tag(":"), ws(expression))),
            ),
            char('}'),
        )),
        node,
    )(input)
}

/// A single value (an atom, parenthesized value, or compound literal
fn value(input: &str) -> IResult<&str, Node<'_>> {
    alt((atom, parens, array_literal, object_literal))(input)
}

/// A unary expression
fn unary_expr(input: &str) -> IResult<&str, Node<'_>> {
    fn node<'a>(input: (&'a str, Node<'a>)) -> Result<Node<'a>, ()> {
        Ok(Node::Un(input.0, Box::new(input.1)))
    }
    alt((
        map_res(ws(tuple((alt((bang_op, tag("-"), tag("+"))), value))), node),
        value,
    ))(input)
}

/// An index expression (`x[i]`, `x[a..b]` or `x.p`).  These are left-associative at equal
/// precedence.
fn index_expr(input: &str) -> IResult<&str, Node<'_>> {
    // An index operation without its left-hand side.  The `fold_multi0` closure attaches
    // these to their LHS's and creates Nodes.
    enum IndexOp<'a> {
        Index(Box<Node<'a>>),
        Slice(Option<Box<Node<'a>>>, Option<Box<Node<'a>>>),
        Dot(&'a str),
    }

    fn index_op<'a>(input: (&'a str, Node<'a>, &'a str)) -> Result<IndexOp<'a>, ()> {
        Ok(IndexOp::Index(Box::new(input.1)))
    }

    fn slice_node<'a>(
        input: (
            &'a str,
            Option<Node<'a>>,
            &'a str,
            Option<Node<'a>>,
            &'a str,
        ),
    ) -> Result<IndexOp<'a>> {
        Ok(IndexOp::Slice(input.1.map(Box::new), input.3.map(Box::new)))
    }

    fn dot_node<'a>(input: (&'a str, &'a str)) -> Result<IndexOp<'a>> {
        Ok(IndexOp::Dot(input.1))
    }

    let (i, init) = unary_expr(input)?;

    let mut init = Some(init);
    fold_many0(
        ws(alt((
            map_res(tuple((tag("["), expression, tag("]"))), index_op),
            map_res(
                tuple((
                    tag("["),
                    opt(expression),
                    tag(":"),
                    opt(expression),
                    tag("]"),
                )),
                slice_node,
            ),
            map_res(tuple((tag("."), ident_str)), dot_node),
        ))),
        // This is a FnMut but is only called once, so `take` it from the Option to avoid cloning
        // it. See https://github.com/rust-bakery/nom/issues/1656.
        move || init.take().unwrap(),
        |acc: Node, index_op: IndexOp| {
            let acc = Box::new(acc);
            match index_op {
                IndexOp::Index(i) => Node::Index(acc, i),
                IndexOp::Slice(a, b) => Node::Slice(acc, a, b),
                IndexOp::Dot(p) => Node::Dot(acc, p),
            }
        },
    )(i)
}

/// A function-invocation expression
fn function_expr(input: &str) -> IResult<&str, Node<'_>> {
    fn node<'a>(input: (Node<'a>, &'a str, Vec<Node<'a>>, &'a str)) -> Result<Node<'a>, ()> {
        Ok(Node::Func(Box::new(input.0), input.2))
    }
    alt((
        map_res(
            ws(tuple((
                index_expr,
                tag("("),
                separated_list0(ws(tag(",")), expression),
                tag(")"),
            ))),
            node,
        ),
        index_expr,
    ))(input)
}

/// Exponentiation is right-associative
fn exp_expr(input: &str) -> IResult<&str, Node<'_>> {
    fn node<'a>(input: (Node<'a>, &'a str, Node<'a>)) -> Result<Node<'a>, ()> {
        Ok(Node::Op(Box::new(input.0), input.1, Box::new(input.2)))
    }

    alt((
        map_res(tuple((function_expr, tag("**"), exp_expr)), node),
        function_expr,
    ))(input)
}

/// Define a simple left-associative binary operation which chains to a
/// higher-precedence operation.
macro_rules! binop {
    ($name:ident, $higher_prec:ident, $ops:expr) => {
        fn $name(input: &str) -> IResult<&str, Node<'_>> {
            let (i, init) = $higher_prec(input)?;

            let mut init = Some(init);
            fold_many0(
                pair($ops, $higher_prec),
                // This is a FnMut but is only called once, so `take` it from the Option to avoid
                // cloning it. See https://github.com/rust-bakery/nom/issues/1656.
                move || init.take().unwrap(),
                |acc: Node, (op, val): (&str, Node)| Node::Op(Box::new(acc), op, Box::new(val)),
            )(i)
        }
    };
}

binop!(muldiv_expr, exp_expr, alt((mul_op, tag("/"))));
binop!(addsub_expr, muldiv_expr, alt((tag("+"), tag("-"))));
binop!(
    inequality_expr,
    addsub_expr,
    alt((tag("<="), tag(">="), lt_op, gt_op))
);
binop!(equality_expr, inequality_expr, alt((tag("=="), tag("!="))));
binop!(in_expr, equality_expr, in_op);
binop!(and_expr, in_expr, tag("&&"));
binop!(or_expr, and_expr, tag("||"));

/// Parse a JSON-e expression.
fn expression(input: &str) -> IResult<&str, Node<'_>> {
    alt((or_expr, value))(input)
}

/// Parse an entire string as an expression.  Un-parsed characters are treated as an error.
pub(crate) fn parse_all(input: &str) -> anyhow::Result<Node> {
    match complete(expression)(input) {
        Ok(("", node)) => Ok(node),
        Ok((unused, _)) => Err(anyhow!("Unexpected trailing characters {}", unused)),
        Err(Err::Incomplete(_)) => unreachable!(),
        Err(Err::Error(e)) => Err(anyhow!("Parse error at {:?}", e.input)),
        Err(Err::Failure(e)) => Err(anyhow!("Parse error at {:?}", e.input)),
    }
}

/// Parse a part of a string as an expression, returning the remainder of the string.
pub(crate) fn parse_partial(input: &str) -> anyhow::Result<(Node, &str)> {
    match complete(expression)(input) {
        Ok((unused, node)) => Ok((node, unused)),
        Err(Err::Incomplete(_)) => unreachable!(),
        Err(Err::Error(e)) => Err(anyhow!("Parse error at {:?}", e.input)),
        Err(Err::Failure(e)) => Err(anyhow!("Parse error at {:?}", e.input)),
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_number_integer() {
        assert_eq!(number("123"), Ok(("", Node::Number("123"))));
    }

    #[test]
    fn test_number_integer_ws() {
        assert_eq!(number("  123\t\n"), Ok(("", Node::Number("123"))));
    }

    #[test]
    fn test_number_decimal() {
        assert_eq!(number("123.456"), Ok(("", Node::Number("123.456"))));
    }

    #[test]
    fn test_literal_true() {
        assert_eq!(literal("true"), Ok(("", Node::True)));
    }

    #[test]
    fn test_literal_true_as_atom() {
        assert_eq!(atom("true"), Ok(("", Node::True)));
    }

    #[test]
    fn test_literal_false_as_atom() {
        assert_eq!(atom("false"), Ok(("", Node::False)));
    }

    #[test]
    fn test_literal_null_as_atom() {
        assert_eq!(atom("null"), Ok(("", Node::Null)));
    }

    #[test]
    fn test_ident() {
        assert_eq!(ident("abc"), Ok(("", Node::Ident("abc"))));
    }

    #[test]
    fn test_ident_digits() {
        assert!(ident("1").is_err());
    }

    #[test]
    fn test_ident_literal_prefix_as_atom() {
        assert_eq!(atom("falsey"), Ok(("", Node::Ident("falsey"))));
    }

    #[test]
    fn test_ident_underscore() {
        assert_eq!(ident("_abc"), Ok(("", Node::Ident("_abc"))));
    }

    #[test]
    fn test_ident_underscore_numeric() {
        assert_eq!(ident("_abc0def"), Ok(("", Node::Ident("_abc0def"))));
    }

    #[test]
    fn test_string_single_quote() {
        assert_eq!(string(" 'ab \"cd'"), Ok(("", Node::String("ab \"cd"))));
    }

    #[test]
    fn test_string_double_quote() {
        assert_eq!(string("\"a' bcd\" "), Ok(("", Node::String("a' bcd"))));
    }

    #[test]
    fn test_empty_string_single_quote() {
        assert_eq!(string("''"), Ok(("", Node::String(""))));
    }

    #[test]
    fn test_empty_string_double_quote() {
        assert_eq!(string("\"\""), Ok(("", Node::String(""))));
    }

    #[test]
    fn test_in_op() {
        assert_eq!(in_op("in"), Ok(("", "in")));
    }

    #[test]
    fn test_in_op_in_larger_identifier() {
        assert!(in_op("insinuation").is_err());
    }

    #[test]
    fn test_unary_neg() {
        assert_eq!(
            expression("- 1 + -2"),
            Ok((
                "",
                Node::Op(
                    Box::new(Node::Un("-", Box::new(Node::Number("1")))),
                    "+",
                    Box::new(Node::Un("-", Box::new(Node::Number("2"))))
                )
            ))
        );
    }

    #[test]
    fn test_index() {
        assert_eq!(
            expression("a[2+3]"),
            Ok((
                "",
                Node::Index(
                    Box::new(Node::Ident("a")),
                    Box::new(Node::Op(
                        Box::new(Node::Number("2")),
                        "+",
                        Box::new(Node::Number("3"))
                    )),
                )
            ))
        );
    }

    #[test]
    fn test_slice_some() {
        assert_eq!(
            expression("a[2:3]"),
            Ok((
                "",
                Node::Slice(
                    Box::new(Node::Ident("a")),
                    Some(Box::new(Node::Number("2"))),
                    Some(Box::new(Node::Number("3")))
                )
            ))
        );
    }

    #[test]
    fn test_slice_none() {
        assert_eq!(
            expression("a[:]"),
            Ok(("", Node::Slice(Box::new(Node::Ident("a")), None, None)))
        );
    }

    #[test]
    fn test_dot() {
        assert_eq!(
            expression("a.b"),
            Ok(("", Node::Dot(Box::new(Node::Ident("a")), "b")))
        );
    }

    #[test]
    fn test_function() {
        assert_eq!(
            expression("-1 (2, 3)"),
            Ok((
                "",
                Node::Func(
                    Box::new(Node::Un("-", Box::new(Node::Number("1")))),
                    vec![Node::Number("2"), Node::Number("3"),],
                )
            ))
        );
    }

    #[test]
    fn test_expr_or() {
        assert_eq!(
            expression("true || ( false || true ) || false"),
            Ok((
                "",
                Node::Op(
                    Box::new(Node::Op(
                        Box::new(Node::True),
                        "||",
                        Box::new(Node::Op(Box::new(Node::False), "||", Box::new(Node::True)))
                    )),
                    "||",
                    Box::new(Node::False),
                )
            ))
        );
    }

    #[test]
    fn test_expr_and_or() {
        assert_eq!(
            expression("a || b && c || d"),
            Ok((
                "",
                Node::Op(
                    Box::new(Node::Op(
                        Box::new(Node::Ident("a")),
                        "||",
                        Box::new(Node::Op(
                            Box::new(Node::Ident("b")),
                            "&&",
                            Box::new(Node::Ident("c"))
                        ))
                    )),
                    "||",
                    Box::new(Node::Ident("d")),
                )
            ))
        );
    }

    #[test]
    fn test_inequalities() {
        assert_eq!(
            expression("1 < 2 == 3 >= 4"),
            Ok((
                "",
                Node::Op(
                    Box::new(Node::Op(
                        Box::new(Node::Number("1")),
                        "<",
                        Box::new(Node::Number("2")),
                    )),
                    "==",
                    Box::new(Node::Op(
                        Box::new(Node::Number("3")),
                        ">=",
                        Box::new(Node::Number("4"))
                    ))
                )
            ))
        );
    }

    #[test]
    fn test_exp_right_assoc() {
        assert_eq!(
            expression("a + 1 ** 2 ** 3"),
            expression("a + (1 ** (2 ** 3))")
        );
    }

    #[test]
    fn test_parse_all() {
        assert_eq!(parse_all("abcd").unwrap(), Node::Ident("abcd"));
    }

    #[test]
    fn test_exp_high_followed_by_low_prec() {
        assert_eq!(
            parse_all("9 * 10 + 11").unwrap(),
            Node::Op(
                Box::new(Node::Op(
                    Box::new(Node::Number("9")),
                    "*",
                    Box::new(Node::Number("10")),
                )),
                "+",
                Box::new(Node::Number("11"))
            )
        );
    }

    #[test]
    fn test_parse_function_call_in_operator() {
        assert_eq!(
            parse_all("x(10) + 11").unwrap(),
            Node::Op(
                Box::new(Node::Func(
                    Box::new(Node::Ident("x")),
                    vec![Node::Number("10")]
                )),
                "+",
                Box::new(Node::Number("11"))
            )
        );
    }

    #[test]
    fn test_parse_all_err() {
        assert!(parse_all("~~~").is_err());
    }

    #[test]
    fn test_parse_all_trailing_chars() {
        assert!(parse_all("abc 123").is_err());
    }

    #[test]
    fn test_parse_partial() {
        assert_eq!(parse_partial("abcd").unwrap(), (Node::Ident("abcd"), ""));
    }

    #[test]
    fn test_parse_partial_err() {
        assert!(parse_partial("~~~").is_err());
    }

    #[test]
    fn test_parse_partial_trailing_chars() {
        // note that this consumes the whitespace, too
        assert_eq!(
            parse_partial("abc 123").unwrap(),
            (Node::Ident("abc"), "123")
        );
    }
}
