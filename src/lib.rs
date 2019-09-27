extern crate json;
extern crate regex;

mod errors;
mod prattparser;
mod tokenizer;

use json::JsonValue;

fn render(template: &JsonValue, context: &JsonValue) -> Option<JsonValue> {
    let m = match template {
        JsonValue::Number(_) | JsonValue::Boolean(_) | JsonValue::Null => template.clone(),
        JsonValue::String(s) => JsonValue::from(interpolate(s, context)),
        JsonValue::Short(s) => JsonValue::from(interpolate(s.as_str(), context)),
        JsonValue::Array(elements) => JsonValue::Array(
            elements
                .into_iter()
                .filter_map(|e| render(e, context))
                .collect::<Vec<JsonValue>>(),
        ),
        JsonValue::Object(o) => JsonValue::Object(
            o.iter()
                .filter_map(|(k, v)| match render(v, context) {
                    Some(v) => Some((k, v)),
                    None => None,
                })
                .fold(json::object::Object::new(), |mut acc, (k, v)| {
                    acc.insert(k, v);
                    acc
                }),
        ),
    };

    Some(m)
}

fn interpolate(template: &str, _context: &JsonValue) -> String {
    template.to_string()
}

mod tests {
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
}
