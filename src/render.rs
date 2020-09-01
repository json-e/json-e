use crate::errors::Error;
use failure::Fallible;
use json::object::Object;
use json::JsonValue;

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
        JsonValue::String(s) => JsonValue::from(interpolate(s, context)),
        JsonValue::Short(s) => JsonValue::from(interpolate(s.as_str(), context)),
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
                    if let Some(result) = maybe_operator(k, v, o)? {
                        println!("found op {:?}", result);
                        return Ok(Some(result));
                    }
                }
            }

            // apparently not, so recursively render the content
            let mut result = Object::new();
            for (k, v) in o.iter() {
                if let Some(v) = _render(v, context)? {
                    result.insert(k, v);
                }
            }
            JsonValue::Object(result)
        }
    }))
}

fn interpolate(template: &str, _context: &JsonValue) -> String {
    template.to_string()
}

/// The given object may be an operator: it has the given key that starts with `$`.  If so,
/// this function evaluates the operator and return Ok(Some(result)) or an error in
/// evaluation.  Otherwise, it returns Ok(None) indicatig that this is a "normal" object.
fn maybe_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    println!("maybe_operator {:?}, {:?}", operator, object);
    match operator {
        "$eval" => eval_operator(operator, value, object),
        "$flatten" => flatten_operator(operator, value, object),
        "$flattenDeep" => flatten_deep_operator(operator, value, object),
        "$fromNow" => from_now_operator(operator, value, object),
        "$if" => if_operator(operator, value, object),
        "$json" => json_operator(operator, value, object),
        "$let" => let_operator(operator, value, object),
        "$map" => map_operator(operator, value, object),
        "$match" => match_operator(operator, value, object),
        "$switch" => switch_operator(operator, value, object),
        "$merge" => merge_operator(operator, value, object),
        "$mergeDeep" => merge_deep_operator(operator, value, object),
        "$reverse" => reverse_operator(operator, value, object),
        "$sort" => sort_operator(operator, value, object),

        // if the operator isn't recognized, just treat this as a normal object
        _ => Ok(None),
    }
}

/// Check for undefined properties for an operator, returning an appropriate error message if
/// found; the check function is called for each value other than the operator.
#[inline(always)]
fn check_operator_properties<F>(operator: &str, object: &Object, check: F) -> Fallible<()>
where
    F: Fn(&str) -> bool,
{
    // TODO: avoid this allocation unless necessary
    let mut unknown = Vec::new();

    // if the object only has one key, we already have it (the operator)
    if object.len() == 1 {
        return Ok(());
    }

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
    _value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    check_operator_properties(operator, object, |_| false)?;
    // TODO
    Ok(Some(JsonValue::Null))
}

fn flatten_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn flatten_deep_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn from_now_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn if_operator(operator: &str, value: &JsonValue, object: &Object) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn json_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    check_operator_properties(operator, object, |_| false)?;
    Ok(Some(JsonValue::from(value.dump())))
}

fn let_operator(operator: &str, value: &JsonValue, object: &Object) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn map_operator(operator: &str, value: &JsonValue, object: &Object) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn match_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn switch_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn merge_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn merge_deep_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn reverse_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

fn sort_operator(
    operator: &str,
    value: &JsonValue,
    object: &Object,
) -> Fallible<Option<JsonValue>> {
    todo!()
}

#[cfg(test)]
mod tests {
    use crate::render;
    use json::JsonValue;

    #[test]
    fn json() {
        let template = json::parse(r#"{"$json": {"abc": "123"}}"#).unwrap();
        let context = json::parse(r#"{}"#).unwrap();
        assert_eq!(
            json::parse(r#""{\"abc\":\"123\"}""#).unwrap(),
            render(&template, &context).unwrap()
        )
    }

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
}
