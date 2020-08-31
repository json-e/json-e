use json::{number::Number, parse, JsonValue};
use std::collections::HashSet;
use std::env;
use std::fs::read_to_string;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use yaml_rust::{Yaml, YamlLoader};

fn main() {
    // request to be re-run whenever specification.yml changes
    println!("cargo:rerun-if-changed=specification.yml");

    let spec = read_to_string("specification.yml").unwrap();
    let spec = YamlLoader::load_from_str(&spec).unwrap();

    let out_dir = env::var("OUT_DIR").unwrap();
    let test_path = Path::new(&out_dir).join("test_spec.rs");
    println!("cargo:warning=Updating {:?}", test_path);
    let mut test_file = File::create(&test_path).unwrap();

    writeln!(test_file, "use json;").unwrap();
    writeln!(test_file, "use json_e::render;").unwrap();

    let mut section = String::from("unknown");

    let section_key = Yaml::String("section".into());
    let title_key = Yaml::String("title".into());
    let context_key = Yaml::String("context".into());
    let template_key = Yaml::String("template".into());
    let result_key = Yaml::String("result".into());
    let error_key = Yaml::String("error".into());

    let mut test_names = HashSet::new();

    for item in spec {
        if let Yaml::Hash(ref h) = item {
            // update the section name if this is a new section
            if let Some(v) = h.get(&section_key) {
                section = String::from(v.as_str().unwrap());
                continue;
            }

            let title = h.get(&title_key).unwrap().as_str().unwrap();
            let context = h.get(&context_key).unwrap();
            let template = h.get(&template_key).unwrap();
            let result = h.get(&result_key);
            let error = h.get(&error_key);

            write_test(
                &mut test_file,
                &mut test_names,
                &section,
                title,
                context,
                template,
                result,
                error,
            );
        } else {
            panic!("YAML sub-document is not an object: {:?}", item);
        }
    }
}

/// Convert the given Yaml value to a JsonValue
fn to_json(y: &Yaml) -> JsonValue {
    match y {
        &Yaml::Real(ref v) => parse(v).unwrap(),
        &Yaml::Integer(v) if v < 0 => JsonValue::Number(Number::from_parts(false, -v as u64, 0)),
        &Yaml::Integer(v) => JsonValue::Number(Number::from_parts(true, v as u64, 0)),
        &Yaml::String(ref v) => JsonValue::String(v.into()),
        &Yaml::Boolean(ref v) => JsonValue::Boolean(*v),
        &Yaml::Array(ref v) => JsonValue::Array(v.iter().map(|y| to_json(y)).collect()),
        &Yaml::Hash(ref v) => JsonValue::Object(
            v.iter()
                .map(|(k, v)| (k.as_str().unwrap().to_string(), to_json(v)))
                .collect(),
        ),
        &Yaml::Null => JsonValue::Null,
        &Yaml::Alias(_) => todo!(),
        &Yaml::BadValue => todo!(),
    }
}

/// Convert the given Yaml value to a JSON string
fn to_json_str(y: &Yaml) -> String {
    to_json(y).dump()
}

fn write_test(
    test_file: &mut File,
    test_names: &mut HashSet<String>,
    section: &str,
    title: &str,
    context: &Yaml,
    template: &Yaml,
    result: Option<&Yaml>,
    error: Option<&Yaml>,
) {
    // invent a unique test name
    let mut test_name: String = format!("{}_{}", section, title)
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    while test_names.contains(&test_name) {
        test_name.push('_');
    }
    test_names.insert(test_name.clone());

    let context = to_json_str(context);
    let template = to_json_str(template);

    write!(
        test_file,
        r##"
#[test]
fn {test_name}() {{
    println!("{{}} - {{}}", {section:?}, {title:?});
    let context = json::parse(r#"{context}"#).unwrap();
    let template = json::parse(r#"{template}"#).unwrap();
"##,
        test_name = test_name,
        section = section,
        title = title,
        context = context,
        template = template
    )
    .unwrap();

    if let Some(result) = result {
        let result = to_json_str(result);

        write!(
            test_file,
            r##"
    let result = json::parse(r#"{result}"#).unwrap();
    assert_eq!(render(&template, &context).unwrap(), result);
}}
"##,
            result = result
        )
        .unwrap();
    } else if let Some(_error) = error {
        // TODO: check that the error message matches
        write!(
            test_file,
            r##"
    assert!(render(&template, &context).is_err());
}}
"##
        )
        .unwrap();
    } else {
        panic!("test case with neither result not error!");
    }
}
