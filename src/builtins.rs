use crate::interpreter::Context;
use crate::value::{Function, Value};
use anyhow::Result;
use lazy_static::lazy_static;

lazy_static! {
    pub(crate) static ref BUILTINS: Context<'static> = {
        let mut builtins = Context::new();
        builtins.insert("abs", Value::Function(Function(abs_builtin)));
        builtins
    };
}

fn abs_builtin(args: &[Value]) -> Result<Value> {
    if args.len() != 1 {
        return Err(interpreter_error!("abs expects one argument"));
    }

    if let Some(arg) = args[0].as_f64() {
        return Ok(Value::Number(arg.abs()));
    } else {
        return Err(interpreter_error!("abs expects a numeric argument"));
    }
}
