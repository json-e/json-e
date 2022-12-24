#![allow(unused_variables)]
use crate::builtins::BUILTINS;
use crate::fromnow::{from_now, now};
use crate::interpreter::{self, Context};
use crate::op_props::{parse_by, parse_each};
use crate::value::{Object, Value};
use anyhow::{bail, Result};
use serde_json::Value as SerdeValue;
use std::borrow::Cow;
use std::convert::TryInto;
use std::fmt::Write;

/// Render the given JSON-e template with the given context.
pub fn render(template: &SerdeValue, context: &SerdeValue) -> Result<SerdeValue> {
    let template: Value = template.into();
    let context = Context::from_serde_value(context, Some(&BUILTINS))?;

    // set "now" in context to a single current time for the duration of the render
    let mut context = context.child();
    context.insert("now", Value::String(now()));

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
                // apply interpolation to key
                // this allows keys that start with an interpolation to work
                let interpolated = interpolate(&k, context)?;
                let mut chars = interpolated.chars();
                if chars.next() == Some('$') && chars.next() != Some('$') {
                    if let Some(rendered) = maybe_operator(k, v, o, context)? {
                        return Ok(rendered);
                    }
                }
            }

            // apparently not, so recursively render the content
            let mut result = Object::new();
            for (k, v) in o.iter() {
                // un-escape escaped operators
                let k = if k.starts_with("$$") { &k[1..] } else { &k[..] };
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
                        // Hide '{' in this error message from the formatting machinery in bail macro
                        let msg = "unterminated ${..} expression";
                        bail!(msg);
                    }
                    let eval_result = interpreter::evaluate(&parsed, context)?;

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

        // if the operator isn't recognized, then it should be escaped
        _ => Err(template_error!(
            "$<identifier> is reserved; use $$<identifier> ({})",
            operator
        )),
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
    check_operator_properties(operator, object, |prop| prop == "from")?;
    let reference: Cow<str>;

    // if "from" is specified, use that as the reference time
    if let Some(val) = object.get("from") {
        match _render(val, context)? {
            Value::String(ref s) => {
                reference = Cow::Owned(s.to_string());
            }
            _ => {
                return Err(template_error!("$fromNow expects a string"));
            }
        };
    } else {
        // otherwise, use `now` from context, which must exist
        match context.get("now") {
            None => unreachable!(), // this is set in render()
            Some(Value::String(ref s)) => reference = Cow::Borrowed(s),
            _ => return Err(template_error!("context value `now` must be a string")),
        };
    }

    match _render(value, context)? {
        Value::String(s) => Ok(Value::String(from_now(&s, reference.as_ref())?)),
        _ => Err(template_error!("$fromNow expects a string")),
    }
}

fn if_operator(operator: &str, value: &Value, object: &Object, context: &Context) -> Result<Value> {
    check_operator_properties(operator, object, |prop| prop == "then" || prop == "else")?;

    let eval_result = match value {
        Value::String(s) => evaluate(&s, context)?,
        _ => return Err(template_error!("$if can evaluate string expressions only")),
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
    check_operator_properties(operator, object, |p| parse_each(p).is_some())?;
    if object.len() != 2 {
        return Err(template_error!("$map must have exactly two properties"));
    }

    // Unwraps here are safe because the presence of the `each(..)` is checked above.
    let each_prop = object.keys().filter(|k| k != &"$map").next().unwrap();

    let (value_var, index_var) = parse_each(each_prop)
        .ok_or_else(|| template_error!("$map requires each(identifier[,identifier]) syntax"))?;

    let each_tpl = object.get(each_prop).unwrap();

    let mut value = _render(value, context)?;

    match value {
        Value::Object(ref o) => {
            let mut result = Object::new();

            for (k, v) in o.iter() {
                let mut subcontext = context.child();

                if let Some(index_var) = index_var {
                    // if each has two arguments, it gets (val, key)
                    subcontext.insert(index_var, Value::String(k.to_string()));
                    subcontext.insert(value_var, v.clone());
                } else {
                    // otherwise, it gets ({val: val, key: key})
                    let mut arg = Object::new();
                    arg.insert("key".to_string(), Value::String(k.to_string()));
                    arg.insert("val".to_string(), v.clone());
                    subcontext.insert(value_var, Value::Object(arg));
                }

                let rendered = _render(each_tpl, &subcontext)?;

                if let Value::Object(r) = rendered {
                    for (rk, rv) in r {
                        result.insert(rk, rv);
                    }
                } else {
                    return Err(template_error!(
                        "$map on objects expects each(..) to evaluate to an object"
                    ));
                }
            }
            Ok(Value::Object(result))
        }
        Value::Array(ref mut a) => {
            let mapped = a
                .drain(..)
                .enumerate()
                .map(|(i, v)| {
                    let mut subcontext = context.child();
                    subcontext.insert(value_var, v);
                    if let Some(index_var) = index_var {
                        subcontext.insert(index_var, Value::Number(i as f64));
                    }
                    _render(each_tpl, &subcontext)
                })
                .filter(|v| match v {
                    Ok(Value::DeletionMarker) => false,
                    _ => true,
                })
                .collect::<Result<Vec<_>>>()?;
            Ok(Value::Array(mapped))
        }
        _ => Err(template_error!(
            "$map value must evaluate to an array or object"
        )),
    }
}

fn match_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;
    if let Value::Object(ref obj) = value {
        let mut res = vec![];
        for (cond, val) in obj {
            if let Ok(cond) = evaluate(&cond, context) {
                if !bool::from(cond) {
                    continue;
                }
                res.push(_render(val, context)?);
            } else {
                bail!(template_error!("parsing error in condition"));
            }
        }
        Ok(Value::Array(res))
    } else {
        Err(template_error!("$match can evaluate objects only"))
    }
}

fn switch_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    if let Value::Object(ref obj) = value {
        let mut res = None;
        let mut unrendered_default = None;
        for (cond, val) in obj {
            // if the condition is `$default`, stash it for later
            if cond == "$default" {
                unrendered_default = Some(val);
                continue;
            }
            // try to evaluate the condition
            if let Ok(cond) = evaluate(&cond, context) {
                if !bool::from(cond) {
                    continue;
                }
                if res.is_some() {
                    bail!(template_error!(
                        "$switch can only have one truthy condition"
                    ))
                }
                res = Some(val);
            } else {
                bail!(template_error!("parsing error in condition"));
            }
        }

        if let Some(res) = res {
            _render(res, context)
        } else if let Some(unrendered_default) = unrendered_default {
            _render(unrendered_default, context)
        } else {
            Ok(Value::DeletionMarker)
        }
    } else {
        Err(template_error!("$switch can evaluate objects only"))
    }
}

fn merge_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;
    if let Value::Array(items) = _render(value, context)? {
        let mut new_obj = std::collections::BTreeMap::new();
        for item in items {
            if let Value::Object(mut obj) = item {
                new_obj.append(&mut obj);
            } else {
                return Err(template_error!(
                    "$merge value must evaluate to an array of objects"
                ));
            }
        }
        Ok(Value::Object(new_obj))
    } else {
        Err(template_error!(
            "$merge value must evaluate to an array of objects"
        ))
    }
}

fn merge_deep_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    fn merge_deep(a: &Value, b: &Value) -> Value {
        match (a, b) {
            (Value::Array(a), Value::Array(b)) => {
                let mut a = a.clone();
                a.append(&mut b.clone());
                Value::Array(a)
            }
            (Value::Object(a), Value::Object(b)) => {
                let mut a = a.clone();
                let b = b.clone();
                for (k, mut v) in b {
                    if a.contains_key(&k) {
                        a.insert(k.to_string(), merge_deep(a.get(&k).unwrap(), &mut v));
                    } else {
                        a.insert(k.to_string(), v);
                    }
                }
                Value::Object(a)
            }
            _ => b.clone(),
        }
    }

    check_operator_properties(operator, object, |_| false)?;
    if let Value::Array(items) = _render(value, context)? {
        let mut new_obj = Value::Object(std::collections::BTreeMap::new());
        for item in items {
            if let Value::Object(_) = item {
                new_obj = merge_deep(&new_obj, &item);
            } else {
                return Err(template_error!(
                    "$mergeDeep value must evaluate to an array of objects"
                ));
            }
        }
        Ok(new_obj)
    } else {
        Err(template_error!(
            "$mergeDeep value must evaluate to an array of objects"
        ))
    }
}

fn reverse_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |_| false)?;
    if let Value::Array(items) = _render(value, context)? {
        Ok(Value::Array(items.into_iter().rev().collect()))
    } else {
        Err(template_error!("$reverse value must evaluate to an array"))
    }
}

fn sort_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Context,
) -> Result<Value> {
    check_operator_properties(operator, object, |p| parse_by(p).is_some())?;

    let make_err = || {
        Err(template_error!(
            "$sorted values to be sorted must have the same type"
        ))
    };

    if let Value::Array(arr) = _render(value, context)? {
        // short-circuit a zero-length array, so we can later assume at least one item
        if arr.len() == 0 {
            return Ok(Value::Array(arr));
        }

        if object.len() == 1 {
            return sort_operator_without_by(operator, arr, object, context);
        }

        // sort by
        // Unwraps here are safe because the presence of the `by(..)` is checked above.
        let by_props: Vec<_> = object.keys().filter(|k| k != &"$sort").collect();
        if by_props.len() > 1 {
            return Err(template_error!("only one by(..) is allowed"));
        }

        let by_var = parse_by(by_props[0])
            .ok_or_else(|| template_error!("$sort requires by(identifier) syntax"))?;

        let by_expr = if let Value::String(expr) = object.get(by_props[0]).unwrap() {
            expr
        } else {
            return Err(interpreter_error!("invalid expression in $sorted by"));
        };

        let mut subcontext = context.child();

        // We precompute everything, eval_pairs is a pair with the value after
        // evaluating the by expression and the original value, so that we can sort
        // on the first and only take the second when building the final result.
        // This could be optimized by exiting early if there is an invalid combination of
        // types.
        let mut eval_pairs: Vec<(Value, Value)> = arr
            .iter()
            .map(|item| {
                subcontext.insert(by_var, item.clone());
                (evaluate(by_expr, &subcontext).unwrap(), item.clone())
            })
            .collect();

        if eval_pairs.iter().all(|(e, _v)| e.is_string()) {
            // sort strings
            eval_pairs.sort_by(|a, b| {
                // unwraps are ok because we checked the types above
                let a = a.0.as_str().unwrap();
                let b = b.0.as_str().unwrap();
                a.cmp(b)
            });
        } else if eval_pairs.iter().all(|(e, _v)| e.is_number()) {
            // sort numbers
            eval_pairs.sort_by(|a, b| {
                // unwraps are ok because we checked the types above
                let a = a.0.as_f64().unwrap();
                let b = b.0.as_f64().unwrap();
                // unwrap is ok because we do not deal with NaN
                a.partial_cmp(b).unwrap()
            });
        } else {
            // either a mix of types or unsortable values
            return make_err();
        }
        let result = eval_pairs
            .into_iter()
            .map(|(_evaluation, item)| item)
            .collect();
        return Ok(Value::Array(result));
    } else {
        make_err()
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
pub(crate) fn is_identifier(identifier: &str) -> bool {
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
