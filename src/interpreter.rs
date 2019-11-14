use crate::errors::Error;
use crate::prattparser::{Context, PrattParser};
use crate::tokenizer::Token;
use json::number::Number;
use json::JsonValue;
use std::collections::HashMap;

pub fn create_interpreter() -> Result<PrattParser<'static, JsonValue>, Error> {
    let mut patterns = HashMap::new();
    patterns.insert("number", "[0-9]+(?:\\.[0-9]+)?");
    patterns.insert("identifier", "[a-zA-Z_][a-zA-Z_0-9]*");
    patterns.insert("string", "\'[^\']*\'|\"[^\"]*\"");
    // avoid matching these as prefixes of identifiers e.g., `insinutations`
    patterns.insert("true", "true(?![a-zA-Z_0-9])");
    patterns.insert("false", "false(?![a-zA-Z_0-9])");
    patterns.insert("in", "in(?![a-zA-Z_0-9])");
    patterns.insert("null", "null(?![a-zA-Z_0-9])");

    let token_types = vec![
        "**",
        "+",
        "-",
        "*",
        "/",
        "[",
        "]",
        ".",
        "(",
        ")",
        "{",
        "}",
        ":",
        ",",
        ">=",
        "<=",
        "<",
        ">",
        "==",
        "!=",
        "!",
        "&&",
        "||",
        "true",
        "false",
        "in",
        "null",
        "number",
        "identifier",
        "string",
    ];

    let precedence = vec![
        vec!["||"],
        vec!["&&"],
        vec!["in"],
        vec!["==", "!="],
        vec![">=", "<=", "<", ">"],
        vec!["+", "-"],
        vec!["*", "/"],
        vec!["**-right-associative"],
        vec!["**"],
        vec!["[", "."],
        vec!["("],
        vec!["unary"],
    ];

    let mut prefix_rules: HashMap<&str, fn(&Token, &mut Context<JsonValue>) -> JsonValue> =
        HashMap::new();
    prefix_rules.insert("number", |token, _context| {
        let n: Number = token.value.parse::<f64>().unwrap().into();
        JsonValue::Number(n)
    });

    let mut infix_rules: HashMap<
        &str,
        fn(&JsonValue, &Token, &mut Context<JsonValue>) -> JsonValue,
    > = HashMap::new();

    PrattParser::new(
        "\\s+",
        patterns,
        token_types,
        precedence,
        prefix_rules,
        infix_rules,
    )
}

// TODO: test for a number expression
