#![allow(unused_variables)]
use crate::interpreter::{self, Context};
use crate::util::is_truthy;
use crate::value::{Object, Value};
use anyhow::{bail, Result};
use serde_json::Value as SerdeValue;
use std::convert::TryInto;
use std::fmt::Write;

/// Render the given JSON-e template with the given context.
pub fn render(template: &SerdeValue, context: &SerdeValue) -> Result<SerdeValue> {
    let template: Value = template.into();
    // TODO: builtins should be a lazy-static Context that is a parent to this one
    let context = Context::from_serde_value(context, None)?;

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
        // `template` has been converted from JSON and cannot contain None
        Value::DeletionMarker => unreachable!(),
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
    todo!()
}

fn flatten_deep_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
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

    let prop = if is_truthy(&eval_result.into()) {
        "then"
    } else {
        "else"
    };
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
    // Convert to a Serde Value and let it do the JSON-ificiation.
    let v: SerdeValue = v.try_into()?;
    Ok(Value::String(serde_json::to_string(&v)?))
}

fn let_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    todo!()
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
    todo!()
}

#[cfg(test)]
mod tests {
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
}
