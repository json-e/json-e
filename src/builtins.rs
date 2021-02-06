#![allow(unused_variables)]
use crate::interpreter::Context;
use crate::value::{Function, Value};
use anyhow::Result;
use lazy_static::lazy_static;

lazy_static! {
    pub(crate) static ref BUILTINS: Context<'static> = {
        let mut builtins = Context::new();
        builtins.insert("abs", Value::Function(Function(abs_builtin)));
        builtins.insert("str", Value::Function(Function(str_builtin)));
        builtins.insert("len", Value::Function(Function(len_builtin)));
        builtins.insert("min", Value::Function(Function(min_builtin)));
        builtins.insert("max", Value::Function(Function(max_builtin)));
        builtins.insert("sqrt", Value::Function(Function(sqrt_builtin)));
        builtins.insert("ceil", Value::Function(Function(ceil_builtin)));
        builtins.insert("floor", Value::Function(Function(floor_builtin)));
        builtins.insert("lowercase", Value::Function(Function(lowercase_builtin)));
        builtins.insert("uppercase", Value::Function(Function(uppercase_builtin)));
        builtins.insert("number", Value::Function(Function(number_builtin)));
        builtins.insert("strip", Value::Function(Function(strip_builtin)));
        builtins.insert("rstrip", Value::Function(Function(rstrip_builtin)));
        builtins.insert("lstrip", Value::Function(Function(lstrip_builtin)));
        builtins.insert("join", Value::Function(Function(join_builtin)));
        builtins.insert("split", Value::Function(Function(split_builtin)));
        builtins.insert("fromNow", Value::Function(Function(from_now_builtin)));
        builtins.insert("typeof", Value::Function(Function(typeof_builtin)));
        builtins.insert("defined", Value::Function(Function(defined_builtin)));
        builtins
    };
}

// utility functions

fn array_arithmetic<F: Fn(f64, f64) -> f64>(args: &[Value], f: F) -> Result<Value> {
    let mut res = None;
    for arg in args {
        let arg = *arg
            .as_f64()
            .ok_or_else(|| interpreter_error!("invalid arguments to builtin: min"))?;
        if let Some(r) = res {
            res = Some(f(arg, r));
        } else {
            res = Some(arg);
        }
    }
    if let Some(r) = res {
        Ok(Value::Number(r))
    } else {
        Err(interpreter_error!("invalid arguments to builtin: min"))
    }
}

fn unary_arithmetic<F: Fn(f64) -> f64>(args: &[Value], op: F) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("expected one argument"));
    }
    let v = &args[0];

    match v {
        Value::Number(n) => Ok(Value::Number(op(*n))),
        _ => Err(interpreter_error!("invalid arguments to builtin")),
    }
}

fn unary_string<F: Fn(&str) -> String>(args: &[Value], op: F) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("expected one argument"));
    }
    let v = &args[0];

    match v {
        Value::String(s) => Ok(Value::String(op(s.as_ref()))),
        _ => Err(interpreter_error!("invalid arguments to builtin")),
    }
}

// builtin implementations

fn abs_builtin(args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::abs)
}

fn str_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("str expects one argument"));
    }
    let v = &args[0];

    match v {
        Value::Null | Value::String(_) | Value::Number(_) | Value::Bool(_) => {
            v.stringify().map(|s| Value::String(s))
        }
        _ => Err(interpreter_error!("invalid arguments to builtin: str")),
    }
}

fn len_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("len expects one argument"));
    }
    let v = &args[0];

    match v {
        Value::String(s) => Ok(Value::Number(s.chars().count() as f64)),
        Value::Array(a) => Ok(Value::Number(a.len() as f64)),
        _ => Err(interpreter_error!("invalid arguments to builtin: len")),
    }
}

fn min_builtin(args: &[Value]) -> Result<Value> {
    array_arithmetic(args, |a, b| if a < b { a } else { b })
}

fn max_builtin(args: &[Value]) -> Result<Value> {
    array_arithmetic(args, |a, b| if a < b { b } else { a })
}

fn sqrt_builtin(args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::sqrt)
}

fn ceil_builtin(args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::ceil)
}

fn floor_builtin(args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::floor)
}

fn lowercase_builtin(args: &[Value]) -> Result<Value> {
    unary_string(args, str::to_lowercase)
}

fn uppercase_builtin(args: &[Value]) -> Result<Value> {
    unary_string(args, str::to_uppercase)
}

fn number_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("number expects one argument"));
    }
    let v = &args[0];
    let num: f64 = match v {
        Value::Null => 0.0,
        Value::String(s) => match s.parse() {
            Ok(num) => num,
            Err(_) => return Err(interpreter_error!("string can't be converted to number")),
        },
        Value::Number(num) => *num,
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        _ => return Err(interpreter_error!("invalid arguments to builtin: number")),
    };
    Ok(Value::Number(num))
}

fn strip_builtin(args: &[Value]) -> Result<Value> {
    unary_string(args, |s| str::trim(s).to_owned())
}

fn rstrip_builtin(args: &[Value]) -> Result<Value> {
    unary_string(args, |s| str::trim_end(s).to_owned())
}

fn lstrip_builtin(args: &[Value]) -> Result<Value> {
    unary_string(args, |s| str::trim_start(s).to_owned())
}

fn join_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 2 {
        return Err(interpreter_error!("join expects two arguments"));
    }
    let v = &args[0];
    let sep = &args[1];

    let sep = match sep.stringify() {
        Ok(s) => s,
        Err(_) => return Err(interpreter_error!("invalid separator for split")),
    };

    match v {
        Value::Array(v) => {
            let strings: Result<Vec<String>> = v.into_iter().map(|val| val.stringify()).collect();
            match strings {
                Ok(s) => Ok(Value::String(s.join(&sep))),
                Err(_) => Err(interpreter_error!(
                    "BuiltinError: invalid arguments to builtin: join"
                )),
            }
        }
        _ => Err(interpreter_error!(
            "BuiltinError: invalid arguments to builtin: join"
        )),
    }
}

fn split_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 2 {
        return Err(interpreter_error!("split expects two arguments"));
    }
    let v = &args[0];
    let sep = &args[1];

    let sep = match sep.stringify() {
        Ok(s) => s,
        Err(_) => return Err(interpreter_error!("invalid separator for split")),
    };

    match v {
        Value::String(s) => {
            if s.is_empty() {
                return Ok(Value::Array(vec![Value::String("".to_string())]));
            };
            let strings = s
                .split(&sep)
                .filter(|v| !v.is_empty())
                .map(|v| Value::String(v.to_string()))
                .collect();
            Ok(Value::Array(strings))
        }
        _ => Err(interpreter_error!(
            "BuiltinError: invalid arguments to builtin: split"
        )),
    }
}

fn from_now_builtin(args: &[Value]) -> Result<Value> {
    todo!()
}

fn typeof_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("typeof expects one argument"));
    }

    let v = &args[0];

    let type_ = match v {
        Value::String(_) => "string",
        Value::Number(_) => "number",
        Value::Bool(_) => "boolean",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
        Value::Null => "null",
        Value::Function(_) => "function",
        _ => {
            return Err(interpreter_error!(
                "BuiltinError: invalid arguments to builtin: split"
            ))
        }
    };

    Ok(Value::String(type_.to_string()))
}

fn defined_builtin(args: &[Value]) -> Result<Value> {
    todo!()
}
