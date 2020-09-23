#![allow(unused_variables)]
use crate::interpreter::{self, Context};
use crate::value::{Function, Object, Value};
use anyhow::{bail, Result};
use serde_json::Value as SerdeValue;
use std::convert::TryInto;
use std::fmt::Write;

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

/// Render the given JSON-e template with the given context.
pub fn render(template: &SerdeValue, context: &SerdeValue) -> Result<SerdeValue> {
    let template: Value = template.into();
    // TODO: builtins should be a lazy-static Context that is a parent to this one
    let mut builtins = Context::new();
    builtins.insert("abs", Value::Function(Function(abs_builtin)));
    let context = Context::from_serde_value(context, Some(&builtins))?;

    match _render(&template, &context) {
        // note that this will convert DeletionMarker into Null
        Ok(v) => Ok(v.try_into()?),
        Err(e) => Err(e),
    }
}

/// Inner, recursive render function.
fn _render(template: &Value, context: &Context) -> Result<Value> {
    /// render a value, shaping the result such that it can be used with
    /// `.filter_map(..).colect::<Result<_>>`.
    fn render_or_deletion_marker(v: &Value, context: &Context) -> Option<Result<Value>> {
        match _render(v, context) {
            Ok(Value::DeletionMarker) => None,
            Ok(rendered) => Some(Ok(rendered)),
            Err(e) => Some(Err(e)),
        }
    }

    Ok(match template {
        Value::Number(_) | Value::Bool(_) | Value::Null => (*template).clone(),
        Value::String(s) => Value::String(interpolate(s, context)?),
        Value::Array(elements) => Value::Array(
            elements
                .into_iter()
                .filter_map(|e| render_or_deletion_marker(e, context))
                .collect::<Result<Vec<Value>>>()?,
        ),
        Value::Object(o) => {
            // first, see if this is a operator invocation
            for (k, v) in o.iter() {
                if k.chars().next() == Some('$') {
                    if let Some(rendered) = maybe_operator(k, v, o, context)? {
                        return Ok(rendered);
                    }
                }
            }

            // apparently not, so recursively render the content
            let mut result = Object::new();
            for (k, v) in o.iter() {
                match _render(v, context)? {
                    Value::DeletionMarker => {}
                    v => {
                        result.insert(interpolate(k, context)?, v);
                    }
                };
            }
            Value::Object(result)
        }

        // `template` has been converted from JSON and cannot contain DeletionMarker or Function
        Value::DeletionMarker | Value::Function(_) => unreachable!(),
    })
}

/// Perform string interpolation on the given string.
fn interpolate(mut source: &str, context: &Context) -> Result<String> {
    // shortcut the common no-interpolation case
    if source.find('$') == None {
        return Ok(source.into());
    }

    let mut result = String::new();

    while source.len() > 0 {
        if let Some(offset) = source.find('$') {
            // If this is an un-escaped `${`, interpolate..
            if let Some(s) = source.get(offset..offset + 2) {
                if s == "${" {
                    result.push_str(source.get(..offset).unwrap());
                    let expr = source.get(offset + 2..).unwrap();
                    let (parsed, remainder) = interpreter::parse_partial(expr)?;
                    if remainder.get(0..1) != Some("}") {
                        bail!("unterminated ${..} expression");
                    }
                    let eval_result = interpreter::evaluate(&parsed, context)?;

                    // XXX temporary
                    let eval_result: Value = eval_result.into();

                    match eval_result {
                        Value::Number(n) => write!(&mut result, "{}", n)?,
                        Value::Bool(true) => result.push_str("true"),
                        Value::Bool(false) => result.push_str("false"),
                        // null interpolates to an empty string
                        Value::Null => {}
                        Value::String(s) => result.push_str(&s),
                        _ => bail!("interpolation of '{}' produced an array or object", expr),
                    }

                    source = &remainder[1..];
                    continue;
                }
            }

            // If this is an escape (`$${`), un-escape it
            if let Some(s) = source.get(offset..offset + 3) {
                if s == "$${" {
                    result.push_str(source.get(..offset + 1).unwrap());
                    source = source.get(offset + 2..).unwrap();
                    continue;
                }
            }

            // otherwise, carry on..
            result.push_str(source.get(..offset + 1).unwrap());
            source = source.get(offset + 1..).unwrap();
        } else {
            // remainder of the string contains no interpolations..
            result.push_str(source);
            source = "";
        }
    }

    Ok(result)
}

/// Evaluate the given expression and return the resulting Value
fn evaluate(expression: &str, context: &Context) -> Result<Value> {
    let parsed = interpreter::parse_all(expression)?;
    interpreter::evaluate(&parsed, context).map(|v| v.into())
}

/// The given object may be an operator: it has the given key that starts with `$`.  If so,
/// this function evaluates the operator and return Ok(Some(result)) or an error in
/// evaluation.  Otherwise, it returns Ok(None) indicating that this is a "normal" object.
fn maybe_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Option<Value>> {
    match operator {
        "$eval" => Ok(Some(eval_operator(operator, value, object, context)?)),
        "$flatten" => Ok(Some(flatten_operator(operator, value, object, context)?)),
        "$flattenDeep" => Ok(Some(flatten_deep_operator(
            operator, value, object, context,
        )?)),
        "$fromNow" => Ok(Some(from_now_operator(operator, value, object, context)?)),
        "$if" => Ok(Some(if_operator(operator, value, object, context)?)),
        "$json" => Ok(Some(json_operator(operator, value, object, context)?)),
        "$let" => Ok(Some(let_operator(operator, value, object, context)?)),
        "$map" => Ok(Some(map_operator(operator, value, object, context)?)),
        "$match" => Ok(Some(match_operator(operator, value, object, context)?)),
        "$switch" => Ok(Some(switch_operator(operator, value, object, context)?)),
        "$merge" => Ok(Some(merge_operator(operator, value, object, context)?)),
        "$mergeDeep" => Ok(Some(merge_deep_operator(operator, value, object, context)?)),
        "$reverse" => Ok(Some(reverse_operator(operator, value, object, context)?)),
        "$sort" => Ok(Some(sort_operator(operator, value, object, context)?)),

        // if the operator isn't recognized, just treat this as a normal object
        _ => Ok(None),
    }
}

/// Check for undefined properties for an operator, returning an appropriate error message if
/// found; the check function is called for each value other than the operator.
#[inline(always)]
fn check_operator_properties<F>(operator: &str, object: &Object, check: F) -> Result<()>
where
    F: Fn(&str) -> bool,
{
    // if the object only has one key, we already have it (the operator)
    if object.len() == 1 {
        return Ok(());
    }

    // TODO: avoid this allocation unless necessary
    let mut unknown = Vec::new();

    for (k, _) in object.iter() {
        if k == operator {
            continue;
        }
        if !check(k) {
            unknown.push(k.as_ref());
        }
    }

    if unknown.len() > 0 {
        unknown.sort();
        Err(template_error!(
            "{} has undefined properties: {}",
            operator,
            unknown.join(" ")
        ))?;
    }

    Ok(())
}

fn eval_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;
    if let Value::String(expr) = value {
        Ok(evaluate(expr, context)?)
    } else {
        Err(template_error!("$eval must be given a string expression"))
    }
}

fn flatten_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;
    if let Value::Array(ref mut items) = _render(value, context)? {
        let mut resitems = Vec::new();
        for mut item in items.drain(..) {
            if let Value::Array(ref mut subitems) = item {
                for subitem in subitems.drain(..) {
                    resitems.push(subitem);
                }
            } else {
                resitems.push(item);
            }
        }
        Ok(Value::Array(resitems))
    } else {
        Err(template_error!("$flatten value must evaluate to an array"))
    }
}

fn flatten_deep_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;

    fn flatten_deep(mut value: Value, accumulator: &mut Vec<Value>) {
        if let Value::Array(ref mut items) = value {
            for item in items.drain(..) {
                flatten_deep(item, accumulator);
            }
        } else {
            accumulator.push(value);
        }
    }

    if let value @ Value::Array(_) = _render(value, context)? {
        let mut resitems = Vec::new();
        flatten_deep(value, &mut resitems);
        Ok(Value::Array(resitems))
    } else {
        Err(template_error!("$flatten value must evaluate to an array"))
    }
}

fn from_now_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn if_operator(operator: &str, value: &Value, object: &Object, context: &Context) -> Result<Value> {
    check_operator_properties(operator, object, |prop| prop == "then" || prop == "else")?;

    let eval_result = match value {
        Value::String(s) => evaluate(&s, context)?,
        _ => bail!("$if can evaluate string expressions only"),
    };

    let prop = if eval_result.into() { "then" } else { "else" };
    match object.get(prop) {
        None => Ok(Value::DeletionMarker),
        Some(val) => Ok(_render(val, context)?),
    }
}

fn json_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;
    let v = _render(value, context)?;
    Ok(Value::String(v.to_json()?))
}

fn let_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |p| p == "in")?;

    if !value.is_object() {
        return Err(template_error!("$let value must be an object"));
    }

    let value = _render(value, context)?;

    if let Value::Object(o) = value {
        let mut child_context = context.child();
        for (k, v) in o.iter() {
            if !is_identifier(k) {
                return Err(template_error!(
                    "top level keys of $let must follow /[a-zA-Z_][a-zA-Z0-9_]*/"
                ));
            }
            child_context.insert(k, v.clone());
        }

        if let Some(in_tpl) = object.get("in") {
            Ok(_render(in_tpl, &child_context)?)
        } else {
            Err(template_error!("$let operator requires an `in` clause"))
        }
    } else {
        Err(template_error!("$let value must be an object"))
    }
}

fn map_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn match_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn switch_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn merge_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn merge_deep_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn reverse_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
}

fn sort_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |p| p.starts_with("by("))?;

    if let Value::Array(arr) = _render(value, context)? {
        // short-circuit a zero-length array, so we can later assume at least one item
        if arr.len() == 0 {
            return Ok(Value::Array(arr));
        }

        if object.len() == 1 {
            return sort_operator_without_by(operator, arr, object, context);
        }
        todo!()
    } else {
        Err(template_error!(
            "$sorted values to be sorted must have the same type"
        ))
    }
}

fn sort_operator_without_by(
    operator: &str,
    mut arr: Vec<Value>,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    let make_err = || {
        Err(template_error!(
            "$sorted values to be sorted must have the same type"
        ))
    };
    match arr[0] {
        Value::String(_) => {
            for i in &arr {
                if !i.is_string() {
                    return make_err();
                }
            }

            arr.sort_by(|a, b| {
                // unwraps are ok because we checked the types above
                let a = a.as_str().unwrap();
                let b = b.as_str().unwrap();
                a.cmp(b)
            });
            Ok(Value::Array(arr))
        }
        Value::Number(_) => {
            for i in &arr {
                if !i.is_number() {
                    return make_err();
                }
            }

            arr.sort_by(|a, b| {
                // unwraps are ok because we checked the types above
                let a = a.as_f64().unwrap();
                let b = b.as_f64().unwrap();
                // unwrap is ok because we do not deal with NaN
                a.partial_cmp(b).unwrap()
            });
            Ok(Value::Array(arr))
        }
        _ => make_err(),
    }
}

/// Recognize identifier strings for $let
fn is_identifier(identifier: &str) -> bool {
    let mut chars = identifier.chars();

    if let Some(c) = chars.next() {
        if !c.is_ascii_alphabetic() {
            return false;
        }
    } else {
        return false;
    }

    for c in chars {
        if !c.is_ascii_alphanumeric() && c != '_' {
            return false;
        }
    }

    return true;
}

#[cfg(test)]
mod tests {
    use super::is_identifier;
    use crate::render;
    use serde_json::json;

    #[test]
    fn render_returns_correct_template() {
        let template = json!({"code": 200});
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_number() {
        let template = json!(200);
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_boolean() {
        let template = json!(true);
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_null() {
        let template = json!(null);
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_string() {
        let template = "tiny string".into();
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_array() {
        let template = json!([1, 2, 3]);
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_object() {
        let template = json!({"a":1, "b":2});
        let context = json!({});
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_array_drops_deletion_markers() {
        let template = json!([1, {"$if": "false", "then": 1}, 3]);
        let context = json!({});
        assert_eq!(render(&template, &context).unwrap(), json!([1, 3]))
    }

    #[test]
    fn render_obj_drops_deletion_markers() {
        let template = json!({"v": {"$if": "false", "then": 1}, "k": "sleutel"});
        let context = json!({});
        assert_eq!(
            render(&template, &context).unwrap(),
            json!({"k": "sleutel"})
        )
    }

    mod check_operator_properties {
        use super::super::{check_operator_properties, Object};
        use crate::value::Value;

        fn map(mut keys: Vec<&str>) -> Object {
            let mut map = Object::new();
            for key in keys.drain(..) {
                map.insert(key.into(), Value::Null);
            }
            map
        }

        #[test]
        fn single_property_is_ok() -> anyhow::Result<()> {
            check_operator_properties("$foo", &map(vec!["$foo"]), |_| false)
        }

        #[test]
        fn allowed_properties_are_ok() -> anyhow::Result<()> {
            check_operator_properties("$foo", &map(vec!["$foo", "a", "b"]), |k| {
                k == "a" || k == "b"
            })
        }

        #[test]
        fn missing_allowed_properties_are_ok() -> anyhow::Result<()> {
            check_operator_properties("$foo", &map(vec!["$foo", "b"]), |k| k == "a" || k == "b")
        }

        #[test]
        fn disalloewd_properties_not_ok() {
            assert_template_error!(
                check_operator_properties("$foo", &map(vec!["$foo", "nosuch"]), |k| k == "a"),
                "$foo has undefined properties: nosuch",
            );
        }

        #[test]
        fn disalloewd_properties_sorted() {
            assert_template_error!(
                check_operator_properties("$foo", &map(vec!["$foo", "a", "b", "c", "d"]), |k| k
                    == "a"),
                "$foo has undefined properties: b c d",
            );
        }
    }

    mod interpolate {
        use super::super::interpolate;

        use crate::interpreter::Context;
        #[test]
        fn plain_string() {
            let context = Context::new();
            assert_eq!(
                interpolate("a string", &context).unwrap(),
                String::from("a string")
            );
        }

        #[test]
        fn interpolation_in_middle() {
            let context = Context::new();
            assert_eq!(
                interpolate("a${13}b", &context).unwrap(),
                String::from("a13b")
            );
        }

        #[test]
        fn escaped_interpolation() {
            let context = Context::new();
            assert_eq!(
                interpolate("a$${13}b", &context).unwrap(),
                String::from("a${13}b")
            );
        }

        #[test]
        fn double_escaped_interpolation() {
            let context = Context::new();
            assert_eq!(
                interpolate("a$$${13}b", &context).unwrap(),
                String::from("a$${13}b")
            );
        }

        #[test]
        fn multibyte_unicode_interpolation_escape() {
            let context = Context::new();
            assert_eq!(interpolate("a$☃", &context).unwrap(), String::from("a$☃"));
        }

        #[test]
        fn unterminated_interpolation() {
            let context = Context::new();
            assert!(interpolate("a${13+14", &context).is_err());
        }
    }

    #[test]
    fn test_is_identifier() {
        assert!(!is_identifier(""));
        assert!(!is_identifier("1"));
        assert!(!is_identifier("2b"));
        assert!(!is_identifier("-"));
        assert!(is_identifier("a"));
        assert!(is_identifier("abc"));
        assert!(is_identifier("abc123"));
        assert!(is_identifier("abc_123"));
        assert!(!is_identifier("abc-123"));
    }
}
