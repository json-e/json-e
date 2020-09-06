#![allow(unused_variables)]
#![allow(dead_code)]
use crate::errors::Error;
use crate::prattparser::{Context, PrattParser};
use crate::tokenizer::Token;
use serde_json::{map::Map, Number, Value};
use std::collections::HashMap;

pub(crate) struct Interpreter {
    parser: PrattParser<'static, Value, HashMap<String, Value>>,
}

impl Interpreter {
    pub(crate) fn new() -> Interpreter {
        Interpreter {
            // this would only fail if the parser itself were malformed
            parser: create_interpreter().expect("Interpreter initialization failed"),
        }
    }

    /// Parse a string with the given context.
    pub(crate) fn parse(
        &self,
        source: &str,
        context: HashMap<String, Value>,
    ) -> Result<Value, Error> {
        self.parser.parse(source, context, 0)
    }
}

fn parse_list(
    context: &mut Context<Value, HashMap<String, Value>>,
    separator: &str,
    terminator: &str,
) -> Result<Value, Error> {
    let mut list: Vec<Value> = vec![];

    if context.attempt(|t| t == terminator)? == None {
        loop {
            list.push(context.parse(None)?);
            if context.attempt(|t| t == separator)? == None {
                break;
            }
        }
        context.require(|t| t == terminator)?;
    }

    Ok(Value::Array(list))
}

fn parse_object(context: &mut Context<Value, HashMap<String, Value>>) -> Result<Value, Error> {
    let mut obj = Map::new();

    if context.attempt(|t| t == "}")? == None {
        loop {
            let mut k = context.require(|t| t == "identifier" || t == "string")?;

            if k.token_type == "string" {
                k.value = &k.value[1..k.value.len() - 1];
            }
            context.require(|t| t == ":")?;
            let v = context.parse(None)?;
            obj.insert(k.value.to_string(), v);

            if context.attempt(|t| t == ",")? == None {
                break;
            }
        }
        context.require(|t| t == "}")?;
    }

    Ok(Value::Object(obj))
}

fn parse_string(string: &str) -> Result<Value, Error> {
    Ok(Value::String(string[1..string.len() - 1].into()))
}

fn number_binary_op<I64, U64, F64>(
    a: &Number,
    b: &Number,
    op_i64: I64,
    op_u64: U64,
    op_f64: F64,
) -> Number
where
    I64: Fn(i64, i64) -> Option<i64>,
    U64: Fn(u64, u64) -> Option<u64>,
    F64: Fn(f64, f64) -> f64,
{
    if let (Some(a), Some(b)) = (a.as_i64(), b.as_i64()) {
        if let Some(r) = op_i64(a, b) {
            return r.into();
        }
    }

    if let (Some(a), Some(b)) = (a.as_u64(), b.as_u64()) {
        if let Some(r) = op_u64(a, b) {
            return r.into();
        }
    }

    if let (Some(a), Some(b)) = (a.as_f64(), b.as_f64()) {
        return Number::from_f64(op_f64(a, b)).unwrap();
    }

    // TODO: panic (and unwrap above)
    panic!("cannot perform binary numeric operation")
}

/// Serde's Numbers aren't really meant for calculations, and as_i64 will fail if
/// the Number was constructed with from_f64, even if it is an integer f64.
fn number_to_i64(number: serde_json::Number) -> Option<i64> {
    if let Some(i) = number.as_i64() {
        return Some(i);
    }

    if let Some(i) = number.as_f64() {
        if i.fract() == 0f64 {
            // TODO: more chances for overflow here..
            return Some(i as i64);
        }
    }

    None
}

fn create_interpreter() -> Result<PrattParser<'static, Value, HashMap<String, Value>>, Error> {
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
        fn(&Token, &mut Context<Value, HashMap<String, Value>>) -> Result<Value, Error>,
    > = HashMap::new();

    prefix_rules.insert("number", |token, _context| {
        let n = serde_json::from_str(token.value)
            .map_err(|e| Error::SyntaxError(format!("Error parsing number: {}", e)))?;
        Ok(n)
    });

    prefix_rules.insert("!", |_token, context| {
        let operand = context.parse(Some("unary"))?;
        match operand {
            // TODO: use is_truthy
            Value::Null => Ok(Value::Bool(true)),
            Value::String(o) => Ok(Value::Bool(o.len() == 0)),
            Value::Number(o) => Ok(Value::Bool(o.as_f64() == Some(0f64))),
            Value::Array(o) => Ok(Value::Bool(o.len() == 0)),
            Value::Object(o) => Ok(Value::Bool(o.is_empty())),
            Value::Bool(o) => Ok(Value::Bool(!o)),
        }
    });

    prefix_rules.insert("-", |_token, context| {
        let v = context.parse(Some("unary"))?;

        println!("negating {:?}", v);

        // try to keep integers as integers..
        if let Some(n) = v.as_i64() {
            if let Some(neg) = n.checked_neg() {
                return Ok(Value::Number(neg.into()));
            }
        }

        if let Some(n) = v.as_f64() {
            // unwrap is OK here as the number is defined
            return Ok(Value::Number(Number::from_f64(-n).unwrap()));
        } else {
            return Err(Error::InterpreterError(
                "This operator expects a number".to_string(),
            ));
        }
    });

    prefix_rules.insert("+", |_token, context| {
        let v = context.parse(Some("unary"))?;
        if v.is_number() {
            return Ok(v);
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

    prefix_rules.insert("null", |_token, _context| Ok(Value::Null));

    prefix_rules.insert("[", |_token, context| parse_list(context, ",", "]"));

    prefix_rules.insert("(", |_token, context| {
        let expression = context.parse(None)?;

        context.require(|t| t == ")")?;

        Ok(expression)
    });

    prefix_rules.insert("{", |_token, context| parse_object(context));

    prefix_rules.insert("string", |token, _context| {
        Ok(Value::String(token.value[1..token.value.len() - 1].into()))
    });

    prefix_rules.insert("true", |_token, _context| Ok(Value::Bool(true)));

    prefix_rules.insert("false", |_token, _context| Ok(Value::Bool(false)));

    let mut infix_rules: HashMap<
        &str,
        fn(&Value, &Token, &mut Context<Value, HashMap<String, Value>>) -> Result<Value, Error>,
    > = HashMap::new();

    infix_rules.insert("+", |left, token, context| {
        let right = context.parse(Some("+"))?;

        match (&left, &right) {
            (&Value::Number(ref a), &Value::Number(ref b)) => Ok(Value::Number(number_binary_op(
                a,
                b,
                i64::checked_add,
                u64::checked_add,
                |a, b| a + b,
            ))),
            (&Value::String(_), &Value::String(_)) => {
                let sum = [left.as_str().unwrap(), right.as_str().unwrap()].concat();
                Ok(Value::String(sum))
            }
            (_, _) => Err(Error::InterpreterError(
                "infix: +', 'number/string + number/string".to_string(),
            )),
        }
    });

    infix_rules.insert("*", |left, token, context| {
        let right = context.parse(Some("*"))?;

        match (&left, &right) {
            (&Value::Number(ref a), &Value::Number(ref b)) => Ok(Value::Number(number_binary_op(
                a,
                b,
                i64::checked_mul,
                u64::checked_mul,
                |a, b| a * b,
            ))),
            (_, _) => Err(Error::InterpreterError(
                "infix: *', 'number + number".to_string(),
            )),
        }
    });

    infix_rules.insert("**", |left, token, context| {
        let right = context.parse(Some("**-right-associative"))?;

        match (&left, &right) {
            (&Value::Number(ref a), &Value::Number(ref b)) => Ok(Value::Number(number_binary_op(
                a,
                b,
                // TODO: these 'as u32' could panic..
                |a, b| i64::checked_pow(a, b as u32),
                |a, b| u64::checked_pow(a, b as u32),
                |a, b| a.powf(b),
            ))),
            (_, _) => Err(Error::InterpreterError(
                "infix: **', 'number + number".to_string(),
            )),
        }
    });

    // todo infix [
    #[allow(unused_assignments)] // temporary
    infix_rules.insert("[", |left, token, context| {
        let mut a: i64;
        let b: i64;
        let mut is_interval = false;

        // Successful cases this function handles:
        //  [1,2][1] - integer index of array [DONE]
        //  [1,2][1:2] - interval of array
        //  "abc"[1] - integer index of string
        //  "abc"[1:2] - interval of string
        //  {bar: 10}['bar'] - object property access

        if context.attempt(|t| t == ":")?.is_some() {
            a = 0;
            is_interval = true;
        } else {
            let parsed = context.parse(None)?;
            print!("parsed is {:?}\n", parsed);
            if let Value::Number(n) = parsed {
                if let Some(int_val) = number_to_i64(n) {
                    a = int_val;
                } else {
                    return Err(Error::InterpreterError(
                        "should only use integers to access arrays or strings".to_string(),
                    ));
                }
                if context.attempt(|t| t == ":")?.is_some() {
                    is_interval = true;
                }
            } else {
                return Err(Error::InterpreterError(
                    "left part of slice operator is not a number".to_string(),
                ));
            }
        }

        if is_interval && !context.attempt(|t| t == "]")?.is_some() {
            let parsed = context.parse(None)?;
            if let Value::Number(n) = parsed {
                if let Some(int_val) = number_to_i64(n) {
                    b = int_val;
                } else {
                    return Err(Error::InterpreterError(
                        "cannot perform interval access with non-integers".to_string(),
                    ));
                }
            } else {
                return Err(Error::InterpreterError(
                    "right part of slice operator is not a number".to_string(),
                ));
            }

            context.require(|t| t == "]")?;
        }

        if is_interval {
            unreachable!()
        } else {
            match left {
                Value::Array(ref arr) => {
                    if a < 0 {
                        a = a + (arr.len() as i64);
                    }

                    if a >= (arr.len() as i64) || a < 0 {
                        print!("index is {}\n", a);
                        return Err(Error::InterpreterError("index out of bounds".to_string()));
                    }

                    return Ok(arr[a as usize].clone());
                }

                _ => unreachable!(),
            }
        }
    });

    // todo infix .
    // todo infix (
    // todo infix ==
    // todo infix >= <= > < == !=
    // todo infix ||
    // todo infix &&
    // todo infix in

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
    use serde_json::{json, map::Map, Value};
    use std::collections::HashMap;

    #[test]
    fn parse_number_expression() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("23.67", HashMap::new(), 0).unwrap(),
            json!(23.67)
        );
    }

    #[test]
    fn parse_boolean_negation() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("!true", HashMap::new(), 0).unwrap(),
            json!(false)
        );
    }

    #[test]
    fn parse_minus_expression_negative_number() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("-7", HashMap::new(), 0).unwrap(),
            json!(-7)
        );
    }

    #[test]
    fn parse_minus_expression_double_negative() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("--7", HashMap::new(), 0).unwrap(),
            json!(7)
        );
    }

    #[test]
    fn parse_minus_expression_plus() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("-+10", HashMap::new(), 0).unwrap(),
            json!(-10)
        );
    }

    #[test]
    fn parse_minus_expression_zero() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("-0", HashMap::new(), 0).unwrap(),
            json!(0)
        );
    }

    #[test]
    fn parse_plus_expression_positive_number() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("+5", HashMap::new(), 0).unwrap(),
            json!(5)
        );
    }

    #[test]
    fn parse_plus_expression_zero() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("+0", HashMap::new(), 0).unwrap(),
            json!(0)
        );
    }

    #[test]
    fn parse_plus_expression_minus() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("+-10", HashMap::new(), 0).unwrap(),
            json!(-10)
        );
    }

    #[test]
    fn parse_boolean_true() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("true", HashMap::new(), 0).unwrap(),
            json!(true)
        );
    }

    #[test]
    fn parse_boolean_false() {
        let interpreter = create_interpreter().unwrap();

        assert_eq!(
            interpreter.parse("false", HashMap::new(), 0).unwrap(),
            json!(false)
        );
    }

    #[test]
    fn parse_identifier_positive() {
        let interpreter = create_interpreter().unwrap();
        let mut context = HashMap::new();
        context.insert("x".to_string(), Value::Number(10.into()));

        assert_eq!(interpreter.parse("x", context, 0).unwrap(), json!(10));
    }

    #[test]
    fn parse_identifier_negative_non_existing_variable() {
        let interpreter = create_interpreter().unwrap();
        let mut context = HashMap::new();
        context.insert("x".to_string(), Value::Number(10.into()));

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
            json!([1, 2]),
        );
    }

    #[test]
    fn parse_array_empty() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[]", HashMap::new(), 0).unwrap(),
            json!([])
        );
    }

    #[test]
    fn parse_parens_negative() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("(true]", HashMap::new(), 0).err(),
            Some(Error::SyntaxError("Unexpected token error".to_string())),
        );
    }

    #[test]
    fn parse_parens() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("2*(3+4)", HashMap::new(), 0).unwrap(),
            json!(14),
        );
    }

    #[test]
    fn parse_curly_braces() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("{a: 10}", HashMap::new(), 0).unwrap(),
            json!({"a": 10}),
        );
    }

    #[test]
    fn parse_curly_braces_negative_semicolon() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("{b: 20; a: 10}", HashMap::new(), 0).err(),
            Some(Error::SyntaxError(
                "unexpected EOF for {b: 20; a: 10} at ; a: 10}".to_string()
            )),
        );
    }

    #[test]
    fn parse_curly_braces_two_keys() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter
                .parse("{b: 20, a: 10}", HashMap::new(), 0)
                .unwrap(),
            json!({"a": 10, "b": 20}),
        );
    }

    #[test]
    fn parse_curly_braces_empty() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("{}", HashMap::new(), 0).unwrap(),
            Value::Object(Map::new()),
        );
    }

    #[test]
    fn parse_curly_braces_string() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter
                .parse("{\"abc def\": 10}", HashMap::new(), 0)
                .unwrap(),
            json!({"abc def": 10}),
        );
    }

    #[test]
    fn parse_string() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("\"banana\"", HashMap::new(), 0).unwrap(),
            Value::String("banana".to_string()),
        );
    }

    #[test]
    fn parse_string_empty() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("\"\"", HashMap::new(), 0).unwrap(),
            Value::String("".to_string()),
        );
    }

    #[test]
    fn parse_string_addition() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter
                .parse("\"banana\" + \"chocolate\"", HashMap::new(), 0)
                .unwrap(),
            Value::String("bananachocolate".to_string()),
        );
    }

    #[test]
    fn parse_exponentiation() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("2**3", HashMap::new(), 0).unwrap(),
            json!(8),
        );
    }

    #[test]
    fn parse_exponentiation_zero_base() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("2**0", HashMap::new(), 0).unwrap(),
            json!(1),
        );
    }

    #[test]
    fn parse_array_of_integers() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1,2][1]", HashMap::new(), 0).unwrap(),
            json!(2),
        );
    }

    #[test]
    fn parse_array_negative_index() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1,2][-1]", HashMap::new(), 0).unwrap(),
            json!(2),
        );
    }

    #[test]
    fn parse_array_noninteger_index() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1,2][0.7]", HashMap::new(), 0).err(),
            Some(Error::InterpreterError(
                "should only use integers to access arrays or strings".to_string()
            ))
        );
    }

    #[test]
    fn parse_array_string_index() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1,2]['foo']", HashMap::new(), 0).err(),
            Some(Error::InterpreterError(
                // TODO: this is not the same message as JS
                "left part of slice operator is not a number".to_string()
            ))
        );
    }

    #[test]
    fn parse_array_positive_index_overflow() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1,2][9]", HashMap::new(), 0).err(),
            Some(Error::InterpreterError("index out of bounds".to_string()))
        );
    }

    #[test]
    fn parse_array_negative_index_overflow() {
        let interpreter = create_interpreter().unwrap();
        assert_eq!(
            interpreter.parse("[1,2][-9]", HashMap::new(), 0).err(),
            Some(Error::InterpreterError("index out of bounds".to_string()))
        );
    }
}
