#![allow(unused_variables)]
#![allow(dead_code)]
use super::context::Context;
use super::node::Node;
use crate::value::{Object, Value};
use anyhow::Result;

pub(crate) fn evaluate(node: &Node, context: &Context) -> Result<Value> {
    match *node {
        Node::Number(n) => Ok(Value::Number(n.parse()?)),
        Node::String(s) => Ok(Value::String(s.to_owned())),
        Node::Ident(i) => match context.get(i) {
            Some(v) => Ok(v.clone()),
            None => Err(interpreter_error!("unknown context value {}", i)),
        },
        Node::True => Ok(Value::Bool(true)),
        Node::False => Ok(Value::Bool(false)),
        Node::Null => Ok(Value::Null),
        Node::Array(ref items) => Ok(Value::Array(
            items
                .iter()
                .map(|i| evaluate(i, context))
                .collect::<Result<Vec<Value>>>()?,
        )),
        Node::Object(ref items) => {
            let mut map = Object::new();
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
        ("-", Value::Number(ref n)) => Ok(Value::Number(-*n)),
        ("-", _) => Err(interpreter_error!("This operator expects a number")),

        ("+", v @ Value::Number(_)) => Ok(v),
        ("+", _) => Err(interpreter_error!("This operator expects a number")),

        ("!", v) => Ok(Value::Bool(!bool::from(v))),

        _ => unreachable!(),
    }
}

fn op(context: &Context, l: &Node, o: &str, r: &Node) -> Result<Value> {
    let l = evaluate(l, context)?;

    // perform the short-circuiting operations first
    if o == "||" && bool::from(&l) {
        return Ok(Value::Bool(true));
    } else if o == "&&" && !bool::from(&l) {
        return Ok(Value::Bool(false));
    }

    // now we can unconditionally evaluate the right operand
    let r = evaluate(r, context)?;

    match (l, o, r) {
        (Value::Number(ref l), "**", Value::Number(ref r)) => Ok(Value::Number(l.powf(*r))),
        (_, "**", _) => Err(interpreter_error!("This operator expects numbers")),

        (Value::Number(ref l), "*", Value::Number(ref r)) => Ok(Value::Number(*l * *r)),
        (_, "*", _) => Err(interpreter_error!("This operator expects numbers")),

        // TODO: div by zero
        (Value::Number(ref l), "/", Value::Number(ref r)) => Ok(Value::Number(*l / *r)),
        (_, "/", _) => Err(interpreter_error!("This operator expects numbers")),

        (Value::String(ref l), "+", Value::String(ref r)) => {
            Ok(Value::String(format!("{}{}", l, r)))
        }
        (Value::Number(ref l), "+", Value::Number(ref r)) => Ok(Value::Number(*l + *r)),
        (_, "+", _) => Err(interpreter_error!(
            "This operator expects numbers or strings"
        )),

        (Value::Number(ref l), "-", Value::Number(ref r)) => Ok(Value::Number(*l - *r)),
        (_, "-", _) => Err(interpreter_error!("This operator expects numbers")),

        (Value::String(ref a), "<", Value::String(ref b)) => Ok(Value::Bool(a < b)),
        (Value::Number(a), "<", Value::Number(b)) => Ok(Value::Bool(a < b)),
        (_, "<", _) => Err(interpreter_error!("Expected numbers or strings")),

        (Value::String(ref a), ">", Value::String(ref b)) => Ok(Value::Bool(a > b)),
        (Value::Number(a), ">", Value::Number(b)) => Ok(Value::Bool(a > b)),
        (_, ">", _) => Err(interpreter_error!("Expected numbers or strings")),

        (Value::String(ref a), "<=", Value::String(ref b)) => Ok(Value::Bool(a <= b)),
        (Value::Number(a), "<=", Value::Number(b)) => Ok(Value::Bool(a <= b)),
        (_, "<=", _) => Err(interpreter_error!("Expected numbers or strings")),

        (Value::String(ref a), ">=", Value::String(ref b)) => Ok(Value::Bool(a >= b)),
        (Value::Number(a), ">=", Value::Number(b)) => Ok(Value::Bool(a >= b)),
        (_, ">=", _) => Err(interpreter_error!("Expected numbers or strings")),

        (l, "==", r) => Ok(Value::Bool(l == r)),
        (l, "!=", r) => Ok(Value::Bool(l != r)),

        (Value::String(ref l), "in", Value::String(ref r)) => Ok(Value::Bool(l.find(r).is_some())),
        (ref l, "in", Value::Array(ref r)) => Ok(Value::Bool(r.iter().any(|x| l == x))),
        (Value::String(ref l), "in", Value::Object(ref r)) => Ok(Value::Bool(r.contains_key(l))),
        (_, "in", _) => Err(interpreter_error!("Expected proper args for in")),

        // We have already handled the left operand of the logical operators above, so these
        // consider only the right.
        (_, "&&", r) => Ok(Value::Bool(r.into())),
        (_, "||", r) => Ok(Value::Bool(r.into())),

        (_, _, _) => unreachable!(),
    }
}

fn index(context: &Context, v: &Node, i: &Node) -> Result<Value> {
    match (evaluate(v, context)?, evaluate(i, context)?) {
        (Value::Array(ref a), Value::Number(mut n)) => {
            if n < 0.0 {
                n = a.len() as f64 + n
            }
            let i = n as usize;
            if i as f64 != n {
                Err(interpreter_error!(
                    "should only use integers to access arrays or strings"
                ))
            } else {
                if let Some(v) = a.get(i) {
                    Ok(v.clone())
                } else {
                    Err(interpreter_error!("index out of bounds"))
                }
            }
        }
        (Value::Array(_), _) => Err(interpreter_error!(
            "should only use integers to access arrays or strings"
        )),

        (Value::String(ref s), Value::Number(mut n)) => {
            if n < 0.0 {
                n = s.len() as f64 + n
            }
            let i = n as usize;
            if i as f64 != n {
                Err(interpreter_error!(
                    "should only use integers to access arrays or strings"
                ))
            } else {
                if let Some(Some(c)) = s.get(i..).map(|substr| substr.chars().next()) {
                    Ok(Value::String(c.into()))
                } else {
                    Err(interpreter_error!("index out of bounds"))
                }
            }
        }
        (Value::String(_), _) => Err(interpreter_error!(
            "should only use integers to access arrays or strings"
        )),

        (Value::Object(ref o), Value::String(ref s)) => {
            if let Some(v) = o.get(s) {
                Ok(v.clone())
            } else {
                Ok(Value::Null)
            }
        }
        (Value::Object(_), _) => Err(interpreter_error!("object keys must be strings")),
        _ => Err(interpreter_error!(
            "indexing operator expects an object, string, or array"
        )),
    }
}

fn slice(context: &Context, v: &Node, a: Option<&Node>, b: Option<&Node>) -> Result<Value> {
    // TODO
    Ok(Value::Null)
}

fn dot(context: &Context, v: &Node, p: &str) -> Result<Value> {
    match evaluate(v, context)? {
        Value::Object(ref o) => {
            if let Some(v) = o.get(p) {
                Ok(v.clone())
            } else {
                Err(interpreter_error!("object has no property {}", p))
            }
        }
        _ => Err(interpreter_error!("dot operator expects an object")),
    }
}

fn func(context: &Context, f: &Node, args: &[Node]) -> Result<Value> {
    // TODO
    Ok(Value::Null)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_literals() {
        assert_eq!(evaluate(&Node::Null, &Context::new()).unwrap(), Value::Null);
        assert_eq!(
            evaluate(&Node::True, &Context::new()).unwrap(),
            Value::Bool(true)
        );
        assert_eq!(
            evaluate(&Node::False, &Context::new()).unwrap(),
            Value::Bool(false)
        );
    }

    #[test]
    fn test_number() {
        assert_eq!(
            evaluate(&Node::Number("13"), &Context::new()).unwrap(),
            Value::Number(13.0),
        );
        assert_eq!(
            evaluate(&Node::Number("13.5"), &Context::new()).unwrap(),
            Value::Number(13.5),
        );
    }

    #[test]
    fn test_string() {
        assert_eq!(
            evaluate(&Node::String("abc"), &Context::new()).unwrap(),
            Value::String("abc".into()),
        );
    }

    #[test]
    fn test_ident() {
        let mut c = Context::new();
        c.insert("a", Value::Number(29.0));
        assert_eq!(
            evaluate(&Node::Ident("a"), &c).unwrap(),
            Value::Number(29.0)
        );
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
            Value::Number(10.0),
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
            Value::Number("-9223372036854775809".parse().unwrap()),
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
            Value::Number(-29.25),
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
            Value::Number(29.25),
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
            evaluate(&Node::Un("!", Box::new(Node::False)), &c).unwrap(),
            Value::Bool(true),
        );
    }
}
