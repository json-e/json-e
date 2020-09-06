#![allow(unused_variables)]
use crate::errors::Error;
use crate::interpreter::Interpreter;
use failure::{bail, Fallible};
use lazy_static::lazy_static;
use serde_json::{map::Map, Value};
use std::collections::HashMap;
use std::fmt::Write;

lazy_static! {
    static ref INTERPRETER: Interpreter = Interpreter::new();
}

// shorthand for a JSON object
type Object = Map<String, Value>;

/// Render the given JSON-e template with the given context.
pub fn render(template: &Value, context: &Value) -> Fallible<Value> {
    // Unwrap the Option from _render, replacing None with Null
    match _render(template, context) {
        Ok(Some(v)) => Ok(v),
        Ok(None) => Ok(Value::Null),
        Err(e) => Err(e),
    }
}

/// Inner, recursive render function.  This returns an Option, where None is treated as a deletion
/// marker.  For example, `{$if: false, then: 10}` returns a deletion marker.  Deletion markers
/// in arrays and objects are omitted.  The parent `render` function converts deletion markers
/// at the top level into a JSON `null`.
fn _render(template: &Value, context: &Value) -> Fallible<Option<Value>> {
    Ok(Some(match template {
        Value::Number(_) | Value::Bool(_) | Value::Null => template.clone(),
        Value::String(s) => Value::from(interpolate(s, context)?),
        Value::Array(elements) => Value::Array(
            elements
                .into_iter()
                .filter_map(|e| _render(e, context).transpose())
                .collect::<Fallible<Vec<Value>>>()?,
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
            let mut result = Map::new();
            for (k, v) in o.iter() {
                if let Some(v) = _render(v, context)? {
                    result.insert(interpolate(k, context)?, v);
                }
            }
            Value::Object(result)
        }
    }))
}

/// Perform string interpolation on the given string.
fn interpolate(mut source: &str, context: &Value) -> Fallible<String> {
    let mut result = String::new();

    // TODO: lots of this could be get_unchecked, if the compiler isn't figuring that out..

    while source.len() > 0 {
        if let Some(offset) = source.find('$') {
            // If this is an un-escaped `${`, interpolate..
            if let Some(s) = source.get(offset..offset + 2) {
                if s == "${" {
                    // TODO: need a way to parse a single expression and return the end offset
                    let mut expr = source.get(offset + 2..).unwrap();
                    if let Some(end) = expr.find('}') {
                        result.push_str(source.get(..offset).unwrap());
                        source = expr.get(end + 1..).unwrap();
                        expr = expr.get(..end).unwrap();

                        let eval_result = evaluate(expr, context)?;
                        match eval_result {
                            Value::Number(n) => write!(&mut result, "{}", n)?,
                            Value::Bool(true) => result.push_str("true"),
                            Value::Bool(false) => result.push_str("false"),
                            // null interpolates to an empty string
                            Value::Null => {}
                            Value::String(s) => result.push_str(&s),
                            _ => bail!("interpolation of '{}' produced an array or object", expr),
                        }

                        continue;
                    }
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
fn evaluate(expression: &str, context: &Value) -> Fallible<Value> {
    // convert the context into a HashMap (TODO: this is wasteful, and Map is keyed by Strings so
    // not terrible to use directly)
    let mut hmcontext: HashMap<String, Value> = HashMap::new();

    if let Value::Object(o) = context {
        for (k, v) in o.iter() {
            hmcontext.insert(k.into(), v.clone());
        }
    } else {
        panic!("Context is not an Object");
    }

    // TODO: take context by reference
    Ok(INTERPRETER.parse(expression, hmcontext)?)
}

/// The given object may be an operator: it has the given key that starts with `$`.  If so,
/// this function evaluates the operator and return Ok(Some(result)) or an error in
/// evaluation.  Otherwise, it returns Ok(None) indicatig that this is a "normal" object.
fn maybe_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Option<Value>>> {
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

/// Determine if the given value meets the JSON-e definition of "truthy"
fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Number(n) => n.as_f64() != Some(0f64),
        Value::Bool(b) => *b,
        Value::Null => false,
        Value::String(s) => s.len() > 0,
        Value::Array(a) => !a.is_empty(),
        Value::Object(o) => !o.is_empty(),
    }
}

/// Check for undefined properties for an operator, returning an appropriate error message if
/// found; the check function is called for each value other than the operator.
#[inline(always)]
fn check_operator_properties<F>(operator: &str, object: &Object, check: F) -> Fallible<()>
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
        Err(Error::TemplateError(format!(
            "{} has undefined properties: {}",
            operator,
            unknown.join(" ")
        )))?;
    }

    Ok(())
}

fn eval_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    check_operator_properties(operator, object, |_| false)?;
    let expr = value
        .as_str()
        .ok_or_else(|| Error::TemplateError(format!("$eval must be given a string expression")))?;
    Ok(Some(evaluate(expr, context)?))
}

fn flatten_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn flatten_deep_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn from_now_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn if_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    check_operator_properties(operator, object, |prop| prop == "then" || prop == "else")?;

    let eval_result = match value {
        Value::String(s) => evaluate(&s, context)?,
        _ => bail!("$if can evaluate string expressions only"),
    };

    let prop = if is_truthy(&eval_result) {
        "then"
    } else {
        "else"
    };
    match object.get(prop) {
        None => Ok(None),
        Some(val) => Ok(_render(val, context)?),
    }
}

fn json_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    check_operator_properties(operator, object, |_| false)?;
    // TODO: `.dump` writes Object properties by insertion order, not lexically;
    // need to override this?  https://github.com/maciejhirsz/json-rust/issues/189
    todo!(); // Ok(Some(Value::from(value.dump())))
}

fn let_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn map_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn match_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn switch_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn merge_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn merge_deep_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn reverse_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

fn sort_operator(
    operator: &str,
    value: &Value,
    object: &Object,
    context: &Value,
) -> Fallible<Option<Value>> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::is_truthy;
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
    fn test_is_truthy() {
        let tests = vec![
            (json!(null), false),
            (json!([]), false),
            (json!([1]), true),
            (json!({}), false),
            (json!({"x": false}), true),
            (json!(""), false),
            (json!("short string"), true),
            (
                json!("very very very very very very very very long (enough) string"),
                true,
            ),
            (json!(0), false),
            (json!(0.0), false),
            (json!(-0.0), false),
            (json!(-1.0), true),
            (json!(false), false),
            (json!(true), true),
        ];

        for (value, expected) in tests {
            assert_eq!(
                is_truthy(&value),
                expected,
                "{:?} should be {}",
                value,
                expected
            );
        }
    }

    mod interpolate {
        use super::super::interpolate;
        use serde_json::json;

        #[test]
        fn plain_string() {
            let context = json!({});
            assert_eq!(
                interpolate("a string", &context).unwrap(),
                String::from("a string")
            );
        }

        #[test]
        fn interpolation_in_middle() {
            let context = json!({});
            assert_eq!(
                interpolate("a${13}b", &context).unwrap(),
                String::from("a13b")
            );
        }
    }
}
