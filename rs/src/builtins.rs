use crate::fromnow::from_now;
use crate::interpreter::Context;
use crate::value::{Function, Value};
use anyhow::Result;
use lazy_static::lazy_static;

lazy_static! {
    pub(crate) static ref BUILTINS: Context<'static> = {
        let mut builtins = Context::new();
        builtins.insert("abs", Value::Function(Function::new("abs", abs_builtin)));
        builtins.insert("str", Value::Function(Function::new("str", str_builtin)));
        builtins.insert("len", Value::Function(Function::new("len", len_builtin)));
        builtins.insert("min", Value::Function(Function::new("min", min_builtin)));
        builtins.insert("max", Value::Function(Function::new("max", max_builtin)));
        builtins.insert("sqrt", Value::Function(Function::new("sqrt", sqrt_builtin)));
        builtins.insert("ceil", Value::Function(Function::new("ceil", ceil_builtin)));
        builtins.insert(
            "floor",
            Value::Function(Function::new("floor", floor_builtin)),
        );
        builtins.insert(
            "lowercase",
            Value::Function(Function::new("lowercase", lowercase_builtin)),
        );
        builtins.insert(
            "uppercase",
            Value::Function(Function::new("uppercase", uppercase_builtin)),
        );
        builtins.insert(
            "number",
            Value::Function(Function::new("number", number_builtin)),
        );
        builtins.insert(
            "strip",
            Value::Function(Function::new("strip", strip_builtin)),
        );
        builtins.insert("range", Value::Function(Function::new("range", range_builtin)));
        builtins.insert(
            "rstrip",
            Value::Function(Function::new("rstrip", rstrip_builtin)),
        );
        builtins.insert(
            "lstrip",
            Value::Function(Function::new("lstrip", lstrip_builtin)),
        );
        builtins.insert("join", Value::Function(Function::new("join", join_builtin)));
        builtins.insert(
            "split",
            Value::Function(Function::new("split", split_builtin)),
        );
        builtins.insert(
            "fromNow",
            Value::Function(Function::new("fromNow", from_now_builtin)),
        );
        builtins.insert(
            "typeof",
            Value::Function(Function::new("typeof", typeof_builtin)),
        );
        builtins.insert(
            "defined",
            Value::Function(Function::new("defined", defined_builtin)),
        );
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

fn abs_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::abs)
}

fn str_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
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

fn len_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
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

fn min_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    array_arithmetic(args, |a, b| if a < b { a } else { b })
}

fn max_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    array_arithmetic(args, |a, b| if a < b { b } else { a })
}

fn sqrt_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::sqrt)
}

fn ceil_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::ceil)
}

fn floor_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_arithmetic(args, f64::floor)
}

fn lowercase_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_string(args, str::to_lowercase)
}

fn uppercase_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_string(args, str::to_uppercase)
}

fn number_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("number expects one argument"));
    }
    let v = &args[0];
    let num: f64 = match v {
        Value::String(s) => match s.parse() {
            Ok(num) => num,
            Err(_) => return Err(interpreter_error!("string can't be converted to number")),
        },
        _ => return Err(interpreter_error!("invalid arguments to builtin: number")),
    };
    Ok(Value::Number(num))
}

fn strip_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_string(args, |s| str::trim(s).to_owned())
}

fn range_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
   if args.len() < 2 || args.len() > 3 {
        return Err(interpreter_error!("range requires two arguments and optionally supports a third"));
    }
    let start = &args[0];
    let start: i64 = match start {
        Value::Number(n) => n.round() as i64,
        _ => return Err(interpreter_error!("invalid arguments to builtin: range")),
    };
    let stop = &args[1];
    let stop: i64 = match stop {
        Value::Number(n) => n.round() as i64,
        _ => return Err(interpreter_error!("invalid arguments to builtin: range")),
    };
    let step: usize = match args.get(2) {
        // If step is not provided by the user, it defaults to 1.
        None => 1,
        Some(val) => match val {
            Value::Number(n) => n.round() as usize,
            _ => return Err(interpreter_error!("invalid arguments to builtin: range")),
        }
    };

    let range = (start..stop).step_by(step).map(|i| Value::Number(i as f64)).collect();
    Ok(Value::Array(range))
}

fn rstrip_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_string(args, |s| str::trim_end(s).to_owned())
}

fn lstrip_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
    unary_string(args, |s| str::trim_start(s).to_owned())
}

fn join_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
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

fn split_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
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

fn from_now_builtin(context: &Context, args: &[Value]) -> Result<Value> {
    if args.len() != 1 && args.len() != 2 {
        return Err(interpreter_error!("from_now expects one or two arguments"));
    }

    let v = &args[0];

    let reference = if args.len() == 2 {
        match &args[1] {
            Value::String(s) => s.to_owned(),
            _ => {
                return Err(interpreter_error!(
                    "BuiltinError: invalid arguments to builtin: fromNow"
                ))
            }
        }
    } else {
        match context.get("now") {
            None => unreachable!(), // this is set in render()
            Some(Value::String(s)) => s.to_owned(),
            _ => return Err(interpreter_error!("context value `now` must be a string")),
        }
    };

    match v {
        Value::String(s) => Ok(Value::String(from_now(&s, &reference)?)),
        _ => Err(interpreter_error!(
            "BuiltinError: invalid arguments to builtin: fromNow"
        )),
    }
}

fn typeof_builtin(_context: &Context, args: &[Value]) -> Result<Value> {
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

fn defined_builtin(context: &Context, args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("builtin expects one argument"));
    }
    let v = &args[0];

    match v {
        Value::String(s) => Ok(Value::Bool(context.get(s).is_some())),
        _ => Err(interpreter_error!(
            "BuiltinError: invalid arguments to builtin: split"
        )),
    }
}
