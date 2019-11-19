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
    //    patterns.insert("true", "true(?![a-zA-Z_0-9])"); // todo use fancy regex?? also: https://stackoverflow.com/questions/37973332/whats-the-most-sensible-way-to-emulate-lookbehind-behavior-in-rust-regex
    //    patterns.insert("false", "false(?![a-zA-Z_0-9])");
    //    patterns.insert("in", "in(?![a-zA-Z_0-9])");
    //    patterns.insert("null", "null(?![a-zA-Z_0-9])");

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

    let mut prefix_rules: HashMap<
        &str,
        fn(&Token, &mut Context<JsonValue>) -> Result<JsonValue, Error>,
    > = HashMap::new();
    prefix_rules.insert("number", |token, _context| {
        let n: Number = token.value.parse::<f64>()?.into();
        Ok(JsonValue::Number(n))
    });

    let mut infix_rules: HashMap<
        &str,
        fn(&JsonValue, &Token, &mut Context<JsonValue>) -> Result<JsonValue, Error>,
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

#[cfg(test)]
mod tests {
    use crate::interpreter::create_interpreter;
    use std::collections::HashMap;

    #[test]
    fn parse_number_expression() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("23.67", HashMap::new(), 0).unwrap(),
            23.67
        );
    }
}
