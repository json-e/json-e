extern crate json;

use json::JsonValue;

#[derive(Debug)]
pub enum JsonEOutput {
    Data(JsonValue),
    DeleteMarker,
}

fn render(template: &JsonValue, context: &JsonValue) -> JsonEOutput {
    let m = match template {
        JsonValue::Number(_) | JsonValue::Boolean(_) | JsonValue::Null => template.clone(),
        JsonValue::String(s) => interpolate(s, context),
        JsonValue::Array(elements) => {
            JsonValue::Array(
                elements
                    .into_iter()
                    .map(|e| render(e, context))
                    .filter(|e| match e {
                        JsonEOutput::Data(jv) => true,
                        JsonEOutput::DeleteMarker => false,
                    })
                    .collect::<Vec<JsonValue>>())
        },
        _ => template.clone(),
    };


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

        assert_eq!(template, render(&template, &context))
    }

    #[test]
    fn render_gets_number() {
        let template = json::parse("200").unwrap();

        let context = json::parse("{}").unwrap();

        assert_eq!(template, render(&template, &context))
    }

    #[test]
    fn render_gets_boolean() {
        let template = json::parse("true").unwrap();

        let context = json::parse("{}").unwrap();

        assert_eq!(template, render(&template, &context))
    }

    #[test]
    fn render_gets_null() {
        let template = json::parse("null").unwrap();

        let context = json::parse("{}").unwrap();

        assert_eq!(template, render(&template, &context))
    }


}
