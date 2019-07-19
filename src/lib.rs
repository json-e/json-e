extern crate json;

use json::JsonValue;

fn render(template: &JsonValue, context: &JsonValue) -> Option<JsonValue> {
    let m = match template {
        JsonValue::Number(_) | JsonValue::Boolean(_) | JsonValue::Null => template.clone(),
        JsonValue::String(s) => interpolate(s, context),
        JsonValue::Array(elements) => {
            JsonValue::Array(
                elements
                    .into_iter()
                    .filter_map(|e| render(e, context))
                    .collect::<Vec<JsonValue>>())
        },
        JsonValue::Object(o) => {
            JsonValue::Object(
                o
                    .iter()
                    .filter_map(|(k, v)| {
                        match render(v, context) {
                            Some(v) => Some((k, v)),
                            None => None
                        }
                    })
                    .fold(json::object::Object::new(), |mut acc, (k, v)| {
                        acc.insert(k, v);
                        acc
                    }))
        }
        _ => template.clone(),
    };

    Some(m)
}

fn interpolate(template: &String, _context: &JsonValue) -> JsonValue {
    json::parse("{}").unwrap()
}

mod tests {
    use crate::render;

    #[test]
    fn render_returns_correct_template() {
        let template = json::parse(
            r#"{"code": 200}"#
        ).unwrap();

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
        let template = json::parse(r#""this is a string""#).unwrap();

        let context = json::parse("{}").unwrap();

        assert_eq!(template, render(&template, &context).unwrap())
    }

    #[test]
    fn render_gets_array() {
        let template = json::parse(r#"["a", "b", "c"]"#).unwrap();

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
