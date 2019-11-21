use crate::errors::Error;
use crate::prattparser::{Context, PrattParser};
use crate::tokenizer::Token;
use json::number::Number;
use json::JsonValue;
use std::collections::HashMap;

fn parse_list(
    context: &mut Context<JsonValue, HashMap<String, JsonValue>>,
    separator: &str,
    terminator: &str,
) -> Result<JsonValue, Error> {
    let mut list: Vec<JsonValue> = vec![];

    if context.attempt(|t| t == terminator)? == None {
        loop {
            list.push(context.parse(None)?);
            if context.attempt(|t| t == separator)? == None {
                break;
            }
        }
        context.require(|t| t == terminator)?;
    }

    Ok(JsonValue::Array(list))
}

pub fn create_interpreter(
) -> Result<PrattParser<'static, JsonValue, HashMap<String, JsonValue>>, Error> {
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

    let mut prefix_rules: HashMap<
        &str,
        fn(&Token, &mut Context<JsonValue, HashMap<String, JsonValue>>) -> Result<JsonValue, Error>,
    > = HashMap::new();

    prefix_rules.insert("number", |token, _context| {
        let n: Number = token.value.parse::<f64>()?.into();
        Ok(JsonValue::Number(n))
    });

    prefix_rules.insert("!", |_token, context| {
        let operand = context.parse(Some("unary"))?;
        match operand {
            JsonValue::Null => Ok(JsonValue::Boolean(true)),
            JsonValue::Short(o) => Ok(JsonValue::Boolean(o.len() == 0)),
            JsonValue::String(o) => Ok(JsonValue::Boolean(o.len() == 0)),
            JsonValue::Number(o) => Ok(JsonValue::Boolean(o == 0)),
            JsonValue::Array(o) => Ok(JsonValue::Boolean(o.len() == 0)),
            JsonValue::Object(o) => Ok(JsonValue::Boolean(o.is_empty())),
            JsonValue::Boolean(o) => Ok(JsonValue::Boolean(!o)),
        }
    });

    prefix_rules.insert("-", |_token, context| {
        let v = context.parse(Some("unary"))?;
        if let Some(n) = v.as_number() {
            return Ok(JsonValue::Number(-n));
        } else {
            return Err(Error::InterpreterError(
                "This operator expects a number".to_string(),
            ));
        }
    });

    prefix_rules.insert("+", |_token, context| {
        let v = context.parse(Some("unary"))?;
        if let Some(n) = v.as_number() {
            return Ok(JsonValue::Number(n));
        } else {
            return Err(Error::InterpreterError(
                "This operator expects a number".to_string(),
            ));
        }
    });

    prefix_rules.insert("identifier", |token, context| {
        if let Some(v) = context.context.get(token.value) {
            return Ok(v.clone());
        }
        return Err(Error::InterpreterError(format!(
            "unknown context value {}",
            token.value
        )));
    });

    prefix_rules.insert("null", |_token, _context| Ok(JsonValue::Null));

    prefix_rules.insert("[", |_token, context| parse_list(context, ",", "]"));

    // todo prefix (
    // todo prefix {
    // todo prefix string

    prefix_rules.insert("true", |_token, _context| Ok(JsonValue::Boolean(true)));

    prefix_rules.insert("false", |_token, _context| Ok(JsonValue::Boolean(false)));

    let mut infix_rules: HashMap<
        &str,
        fn(
            &JsonValue,
            &Token,
            &mut Context<JsonValue, HashMap<String, JsonValue>>,
        ) -> Result<JsonValue, Error>,
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
    use crate::errors::Error;
    use crate::interpreter::create_interpreter;
    use json::JsonValue;
    use std::collections::HashMap;

    #[test]
    fn parse_number_expression() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("23.67", HashMap::new(), 0).unwrap(),
            23.67
        );
    }

    #[test]
    fn parse_boolean_negation() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("!true", HashMap::new(), 0).unwrap(),
            false
        );
    }

    #[test]
    fn parse_minus_expression_negative_number() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("-7", HashMap::new(), 0).unwrap(), -7);
    }

    #[test]
    fn parse_minus_expression_double_negative() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("--7", HashMap::new(), 0).unwrap(), 7);
    }

    #[test]
    fn parse_minus_expression_plus() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("-+10", HashMap::new(), 0).unwrap(), -10);
    }

    #[test]
    fn parse_minus_expression_zero() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("-0", HashMap::new(), 0).unwrap(), 0);
    }

    #[test]
    fn parse_plus_expression_positive_number() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("+5", HashMap::new(), 0).unwrap(), 5);
    }

    #[test]
    fn parse_plus_expression_zero() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("+0", HashMap::new(), 0).unwrap(), 0);
    }

    #[test]
    fn parse_plus_expression_minus() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("+-10", HashMap::new(), 0).unwrap(), -10);
    }

    #[test]
    fn parse_boolean_true() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(interpreter.parse("true", HashMap::new(), 0).unwrap(), true);
    }

    #[test]
    fn parse_boolean_false() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("false", HashMap::new(), 0).unwrap(),
            false
        );
    }

    #[test]
    fn parse_identifier_positive() {
        let interpreter = create_interpreter().unwrap();
        let mut context = HashMap::new();
        context.insert("x".to_string(), JsonValue::Number(10.into()));

        assert_eq!(interpreter.parse("x", context, 0).unwrap(), 10);
    }

    #[test]
    fn parse_identifier_negative_non_existing_variable() {
        let interpreter = create_interpreter().unwrap();
        let mut context = HashMap::new();
        context.insert("x".to_string(), JsonValue::Number(10.into()));

        assert_eq!(
            interpreter.parse("y", context, 0).err(),
            Some(Error::InterpreterError(
                "unknown context value y".to_string()
            ))
        );
    }

    #[test]
    fn parse_array_positive() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1, 2]", HashMap::new(), 0).unwrap(),
            JsonValue::Array(vec![1.into(), 2.into()]),
        );
    }

    #[test]
    fn parse_array_empty() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[]", HashMap::new(), 0).unwrap(),
            JsonValue::Array(vec![]),
        );
    }
}
