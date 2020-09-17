use crate::value::Value;

/// Determine if the given value meets the JSON-e definition of "truthy"
pub(crate) fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Number(n) => *n != 0.0,
        Value::Bool(b) => *b,
        Value::Null => false,
        Value::String(s) => s.len() > 0,
        Value::Array(a) => !a.is_empty(),
        Value::Object(o) => !o.is_empty(),
        Value::DeletionMarker => false,
    }
}

/// Determine if the two values are equal.  This wraps Value::eq to also consider equivalent integer
/// and floating point numbers as equal
pub(crate) fn is_equal(l: &Value, r: &Value) -> bool {
    l == r
}

#[cfg(test)]
mod test {
    use super::*;
    use serde_json::json;

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
                is_truthy(&(&value).into()),
                expected,
                "{:?} should be {}",
                value,
                expected
            );
        }
    }
}
