#![allow(unused_variables)]
#![allow(dead_code)]
use super::context::Context;
use super::node::Node;
use crate::util::{is_equal, is_truthy};
use anyhow::Result;
use serde_json::{map::Map, Number, Value};
use std::{convert::TryFrom, str::FromStr};

pub(crate) fn evaluate(node: &Node, context: &Context) -> Result<Value> {
    match *node {
        Node::Number(n) => Ok(Value::Number(serde_json::Number::from_str(n)?)),
        Node::String(s) => Ok(Value::String(s.to_owned())),
        Node::Ident(i) => match context.get(i) {
            Some(v) => Ok(v.clone()),
            None => Err(interpreter_error!("unknown context value {}", i)),
        },
        Node::Literal("true") => Ok(Value::Bool(true)),
        Node::Literal("false") => Ok(Value::Bool(false)),
        Node::Literal("null") => Ok(Value::Null),
        // TODO: ok, literals should be enum variants..
        Node::Literal(_) => unreachable!(),
        Node::Array(ref items) => Ok(Value::Array(
            items
                .iter()
                .map(|i| evaluate(i, context))
                .collect::<Result<Vec<Value>>>()?,
        )),
        Node::Object(ref items) => {
            let mut map = Map::new();
            for (k, v) in items.iter() {
                let v = evaluate(v, context)?;
                map.insert((*k).to_owned(), v);
            }
            Ok(Value::Object(map))
        }
        Node::Un(ref op, ref v) => un(context, op, v.as_ref()),
        Node::Op(ref l, ref o, ref r) => op(context, l.as_ref(), o, r.as_ref()),
        Node::Index(ref v, ref i) => index(context, v.as_ref(), i.as_ref()),
        Node::Slice(ref v, ref a, ref b) => {
            slice(context, v.as_ref(), option_ref(a), option_ref(b))
        }
        Node::Dot(ref v, ref p) => dot(context, v.as_ref(), p),
        Node::Func(ref f, ref args) => func(context, f.as_ref(), &args[..]),
    }
}

// TODO: there's probably some way to do this with Option..
fn option_ref<'a>(opt: &'a Option<Box<Node<'a>>>) -> Option<&'a Node<'a>> {
    match opt {
        Some(b) => Some(b.as_ref()),
        None => None,
    }
}

fn un(context: &Context, op: &str, v: &Node) -> Result<Value> {
    let v = evaluate(v, context)?;
    match (op, v) {
        ("-", Value::Number(ref n)) => Ok(Value::Number(number_op(
            n,
            n,
            |a, _| a.checked_neg(),
            |_, _| None,
            |a, _| -a,
        ))),
        ("-", _) => Err(interpreter_error!("This operator expects a number")),

        ("+", v @ Value::Number(_)) => Ok(v),
        ("+", _) => Err(interpreter_error!("This operator expects a number")),

        ("!", v) => Ok(Value::Bool(!is_truthy(&v))),

        _ => unreachable!(),
    }
}

fn op(context: &Context, l: &Node, o: &str, r: &Node) -> Result<Value> {
    let l = evaluate(l, context)?;

    // perform the short-circuiting operations first
    if o == "||" && is_truthy(&l) {
        return Ok(Value::Bool(true));
    } else if o == "&&" && !is_truthy(&l) {
        return Ok(Value::Bool(false));
    }

    // now we can unconditionally evaluate the right operand
    let r = evaluate(r, context)?;

    match (l, o, r) {
        (Value::Number(ref l), "**", Value::Number(ref r)) => Ok(Value::Number(number_op(
            l,
            r,
            |a, b| u32::try_from(b).ok().and_then(|b| a.checked_pow(b)),
            |a, b| u32::try_from(b).ok().and_then(|b| a.checked_pow(b)),
            |a, b| a.powf(b),
        ))),
        (_, "**", _) => Err(interpreter_error!("This operator expects numbers")),

        (Value::Number(ref l), "*", Value::Number(ref r)) => Ok(Value::Number(number_op(
            l,
            r,
            i64::checked_mul,
            u64::checked_mul,
            |a, b| a / b,
        ))),
        (_, "*", _) => Err(interpreter_error!("This operator expects numbers")),

        (Value::Number(ref l), "/", Value::Number(ref r)) => Ok(Value::Number(number_op(
            l,
            r,
            i64::checked_div,
            u64::checked_div,
            |a, b| a / b,
        ))),
        (_, "/", _) => Err(interpreter_error!("This operator expects numbers")),

        (Value::String(ref l), "+", Value::String(ref r)) => {
            Ok(Value::String(format!("{}{}", l, r)))
        }
        (Value::Number(ref l), "+", Value::Number(ref r)) => Ok(Value::Number(number_op(
            l,
            r,
            i64::checked_add,
            u64::checked_add,
            |a, b| a + b,
        ))),
        (_, "+", _) => Err(interpreter_error!(
            "This operator expects numbers or strings"
        )),

        (Value::Number(ref l), "-", Value::Number(ref r)) => Ok(Value::Number(number_op(
            l,
            r,
            i64::checked_sub,
            u64::checked_sub,
            |a, b| a - b,
        ))),
        (_, "-", _) => Err(interpreter_error!("This operator expects numbers")),

        (l, "<", r) => comparison_op(
            &l,
            &r,
            |a, b| a < b,
            |a, b| a < b,
            |a, b| a < b,
            |a, b| a < b,
        ),
        (l, ">", r) => comparison_op(
            &l,
            &r,
            |a, b| a > b,
            |a, b| a > b,
            |a, b| a > b,
            |a, b| a > b,
        ),
        (l, "<=", r) => comparison_op(
            &l,
            &r,
            |a, b| a <= b,
            |a, b| a <= b,
            |a, b| a <= b,
            |a, b| a <= b,
        ),
        (l, ">=", r) => comparison_op(
            &l,
            &r,
            |a, b| a >= b,
            |a, b| a >= b,
            |a, b| a >= b,
            |a, b| a >= b,
        ),

        // For equality, use object equality *except* casting numbers to f64 to allow comparison
        // of integers in different representations.
        (l, "==", r) => Ok(Value::Bool(is_equal(&l, &r))),
        (l, "!=", r) => Ok(Value::Bool(!is_equal(&l, &r))),

        (Value::String(ref l), "in", Value::String(ref r)) => Ok(Value::Bool(l.find(r).is_some())),
        (ref l, "in", Value::Array(ref r)) => Ok(Value::Bool(r.iter().any(|x| is_equal(l, x)))),
        (Value::String(ref l), "in", Value::Object(ref r)) => Ok(Value::Bool(r.contains_key(l))),

        // We have already handled the left operand of the logical operators above, so these
        // consider only the right.
        (_, "&&", r) => Ok(Value::Bool(is_truthy(&r))),
        (_, "||", r) => Ok(Value::Bool(is_truthy(&r))),

        (_, _, _) => unreachable!(),
    }
}

fn index(context: &Context, v: &Node, i: &Node) -> Result<Value> {
    // TODO
    Ok(Value::Null)
}

fn slice(context: &Context, v: &Node, a: Option<&Node>, b: Option<&Node>) -> Result<Value> {
    // TODO
    Ok(Value::Null)
}

fn dot(context: &Context, v: &Node, p: &str) -> Result<Value> {
    // TODO
    Ok(Value::Null)
}

fn func(context: &Context, f: &Node, args: &[Node]) -> Result<Value> {
    // TODO
    Ok(Value::Null)
}

// utilities for doing arithmetic on serde_json::Number

fn number_op<I64, U64, F64>(a: &Number, b: &Number, op_i64: I64, op_u64: U64, op_f64: F64) -> Number
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

fn comparison_op<STR, I64, U64, F64>(
    a: &Value,
    b: &Value,
    op_str: STR,
    op_i64: I64,
    op_u64: U64,
    op_f64: F64,
) -> Result<Value>
where
    STR: Fn(&str, &str) -> bool,
    I64: Fn(i64, i64) -> bool,
    U64: Fn(u64, u64) -> bool,
    F64: Fn(f64, f64) -> bool,
{
    match (a, b) {
        (Value::String(ref a), Value::String(ref b)) => Ok(Value::Bool(op_str(a, b))),
        (Value::Number(ref a), Value::Number(ref b)) => {
            if let (Some(a), Some(b)) = (a.as_i64(), b.as_i64()) {
                return Ok(Value::Bool(op_i64(a, b)));
            }

            if let (Some(a), Some(b)) = (a.as_u64(), b.as_u64()) {
                return Ok(Value::Bool(op_u64(a, b)));
            }

            if let (Some(a), Some(b)) = (a.as_f64(), b.as_f64()) {
                return Ok(Value::Bool(op_f64(a, b)));
            }

            // TODO: panic (and unwrap above)
            panic!("cannot perform binary numeric operation")
        }
        _ => Err(interpreter_error!("Expected numbers or strings")),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use serde_json::{from_str, json};

    #[test]
    fn test_literals() {
        assert_eq!(
            evaluate(&Node::Literal("null"), &Context::new()).unwrap(),
            json!(null)
        );
        assert_eq!(
            evaluate(&Node::Literal("true"), &Context::new()).unwrap(),
            json!(true)
        );
        assert_eq!(
            evaluate(&Node::Literal("false"), &Context::new()).unwrap(),
            json!(false)
        );
    }

    #[test]
    fn test_number() {
        assert_eq!(
            evaluate(&Node::Number("13"), &Context::new()).unwrap(),
            json!(13)
        );
        assert_eq!(
            evaluate(&Node::Number("13.5"), &Context::new()).unwrap(),
            json!(13.5)
        );
    }

    #[test]
    fn test_string() {
        assert_eq!(
            evaluate(&Node::String("abc"), &Context::new()).unwrap(),
            json!("abc")
        );
    }

    #[test]
    fn test_ident() {
        let mut c = Context::new();
        c.insert("a", json!(29));
        assert_eq!(evaluate(&Node::Ident("a"), &c).unwrap(), json!(29));
    }

    #[test]
    fn test_ident_nosuch() {
        let c = Context::new();
        assert_interpreter_error!(evaluate(&Node::Ident("a"), &c), "unknown context value a");
    }

    #[test]
    fn test_unary_minus_i64() {
        let c = Context::new();
        assert_eq!(
            evaluate(&Node::Un("-", Box::new(Node::Number("-10"))), &c).unwrap(),
            json!(10)
        );
    }

    #[test]
    fn test_unary_minus_u64() {
        let c = Context::new();
        assert_eq!(
            evaluate(
                // this number is larger that i64::MAX
                &Node::Un("-", Box::new(Node::Number("9223372036854775809"))),
                &c
            )
            .unwrap(),
            from_str::<Value>("-9223372036854775809").unwrap(),
        );
    }

    #[test]
    fn test_unary_minus_f64() {
        let c = Context::new();
        assert_eq!(
            evaluate(
                // this number is larger that i64::MAX
                &Node::Un("-", Box::new(Node::Number("29.25"))),
                &c
            )
            .unwrap(),
            json!(-29.25),
        );
    }

    #[test]
    fn test_unary_minus_not_number() {
        let c = Context::new();
        assert_interpreter_error!(
            evaluate(
                // this number is larger that i64::MAX
                &Node::Un("-", Box::new(Node::String("abc"))),
                &c
            ),
            "This operator expects a number"
        );
    }

    #[test]
    fn test_unary_plus() {
        let c = Context::new();
        assert_eq!(
            evaluate(&Node::Un("+", Box::new(Node::Number("29.25"))), &c).unwrap(),
            json!(29.25),
        );
    }

    #[test]
    fn test_unary_plus_not_number() {
        let c = Context::new();
        assert_interpreter_error!(
            evaluate(&Node::Un("-", Box::new(Node::String("abc"))), &c),
            "This operator expects a number"
        );
    }

    #[test]
    fn test_unary_bang() {
        let c = Context::new();
        assert_eq!(
            evaluate(&Node::Un("!", Box::new(Node::Literal("false"))), &c).unwrap(),
            json!(true),
        );
    }
}
