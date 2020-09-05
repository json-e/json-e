#![allow(unused_variables)]
use crate::errors::Error;
use crate::interpreter::Interpreter;
use failure::{bail, Fallible};
use json::object::Object;
use json::JsonValue;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::fmt::Write;

lazy_static! {
    static ref INTERPRETER: Interpreter = Interpreter::new();
}

/// Render the given JSON-e template with the given context.
pub fn render(template: &JsonValue, context: &JsonValue) -> Fallible<JsonValue> {
    // Unwrap the Option from _render, replacing None with Null
    match _render(template, context) {
        Ok(Some(v)) => Ok(v),
        Ok(None) => Ok(JsonValue::Null),
        Err(e) => Err(e),
    }
}

/// Inner, recursive render function.  This returns an Option, where None is treated as a deletion
/// marker.  For example, `{$if: false, then: 10}` returns a deletion marker.  Deletion markers
/// in arrays and objects are omitted.  The parent `render` function converts deletion markers
/// at the top level into a JSON `null`.
fn _render(template: &JsonValue, context: &JsonValue) -> Fallible<Option<JsonValue>> {
    Ok(Some(match template {
        JsonValue::Number(_) | JsonValue::Boolean(_) | JsonValue::Null => template.clone(),
        JsonValue::String(s) => JsonValue::from(interpolate(s, context)?),
        JsonValue::Short(s) => JsonValue::from(interpolate(s.as_str(), context)?),
        JsonValue::Array(elements) => JsonValue::Array(
            elements
                .into_iter()
                .filter_map(|e| _render(e, context).transpose())
                .collect::<Fallible<Vec<JsonValue>>>()?,
        ),
        JsonValue::Object(o) => {
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
                if let Some(v) = _render(v, context)? {
                    result.insert(&interpolate(k, context)?, v);
                }
            }
            JsonValue::Object(result)
        }
    }))
}

/// Perform string interpolation on the given string.
fn interpolate(mut source: &str, context: &JsonValue) -> Fallible<String> {
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
                            JsonValue::Number(n) => write!(&mut result, "{}", n)?,
                            JsonValue::Boolean(true) => result.push_str("true"),
                            JsonValue::Boolean(false) => result.push_str("false"),
                            // null interpolates to an empty string
                            JsonValue::Null => {}
                            JsonValue::String(s) => result.push_str(&s),
                            JsonValue::Short(s) => result.push_str(s.as_str()),
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

/// Evaluate the given expression and return the resulting JsonValue
fn evaluate(expression: &str, context: &JsonValue) -> Fallible<JsonValue> {
    // convert the context into a HashMap (TODO: this is wasteful)
    let mut hmcontext = HashMap::new();

    if let JsonValue::Object(o) = context {
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
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<Option<JsonValue>>> {
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
fn is_truthy(value: &JsonValue) -> bool {
    match value {
        JsonValue::Number(n) => !n.is_zero(),
        JsonValue::Boolean(b) => *b,
        JsonValue::Null => false,
        JsonValue::String(s) => s.len() > 0,
        JsonValue::Short(s) => s.len() > 0,
        JsonValue::Array(a) => !a.is_empty(),
        JsonValue::Object(o) => !o.is_empty(),
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
            unknown.push(k);
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
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    check_operator_properties(operator, object, |_| false)?;
    let expr = value
        .as_str()
        .ok_or_else(|| Error::TemplateError(format!("$eval must be given a string expression")))?;
    Ok(Some(evaluate(expr, context)?))
}

fn flatten_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn flatten_deep_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn from_now_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn if_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    check_operator_properties(operator, object, |prop| prop == "then" || prop == "else")?;

    let eval_result = match value {
        JsonValue::String(s) => evaluate(&s, context)?,
        JsonValue::Short(s) => evaluate(s.as_str(), context)?,
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
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    check_operator_properties(operator, object, |_| false)?;
    // TODO: `.dump` writes Object properties by insertion order, not lexically;
    // need to override this?  https://github.com/maciejhirsz/json-rust/issues/189
    Ok(Some(JsonValue::from(value.dump())))
}

fn let_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn map_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn match_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn switch_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn merge_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn merge_deep_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn reverse_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn sort_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
    context: &JsonValue,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::is_truthy;
    use crate::render;
    use json::JsonValue;

    #[test]
    fn render_returns_correct_template() {
        let template = json::parse(r#"{"code": 200}"#).unwrap();
        let context = json::parse("{}").unwrap();
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_number() {
        let template = json::parse("200").unwrap();
        let context = json::parse("{}").unwrap();
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_boolean() {
        let template = json::parse("true").unwrap();
        let context = json::parse("{}").unwrap();
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_null() {
        let template = json::parse("null").unwrap();
        let context = json::parse("{}").unwrap();
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_string() {
        // longer than json::short::MAX_LEN
        let template = json::parse(r#""this is a very very very very long string""#).unwrap();

        assert!(match template {
            JsonValue::String(_) => true,
            _ => false,
        });

        let context = json::parse("{}").unwrap();

        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_short() {
        // shorter than json::short::MAX_LEN
        let template = "tiny".into();
        assert!(match template {
            JsonValue::Short(_) => true,
            _ => false,
        });

        let context = json::parse("{}").unwrap();

        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_array() {
        let template = json::parse(r#"[1, 2, 3]"#).unwrap();
        let context = json::parse("{}").unwrap();
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_object() {
        let template = json::parse(r#"{"a":1, "b":2}"#).unwrap();
        let context = json::parse("{}").unwrap();
        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn test_is_truthy() {
        let tests = vec![
            (json::parse(r#"null"#), false),
            (json::parse(r#"[]"#), false),
            (json::parse(r#"[1]"#), true),
            (json::parse(r#"{}"#), false),
            (json::parse(r#"{"x": false}"#), true),
            (json::parse(r#""""#), false),
            (json::parse(r#""short string""#), true),
            (
                json::parse(r#""very very very very very very very very long (enough) string""#),
                true,
            ),
            (json::parse(r#"0"#), false),
            (json::parse(r#"0.0"#), false),
            (json::parse(r#"-0.0"#), false),
            (json::parse(r#"-1.0"#), true),
            (json::parse(r#"false"#), false),
            (json::parse(r#"true"#), true),
        ];

        for (value, expected) in tests {
            let value = value.unwrap();
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
        use json;

        #[test]
        fn plain_string() {
            let context = json::parse("{}").unwrap();
            assert_eq!(
                interpolate("a string", &context).unwrap(),
                String::from("a string")
            );
        }

        #[test]
        fn interpolation_in_middle() {
            let context = json::parse("{}").unwrap();
            assert_eq!(
                interpolate("a${13}b", &context).unwrap(),
                String::from("a13b")
            );
        }
    }
}
