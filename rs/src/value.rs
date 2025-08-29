#![allow(dead_code)]
use anyhow::{Error, Result};
use serde_json::{Map, Number, Value as SerdeValue};
use std::collections::BTreeMap;
use std::convert::{TryFrom, TryInto};
use std::fmt;

use crate::interpreter::Context;

/// shorthand for object values
pub(crate) type Object = BTreeMap<String, Value>;

/// A custom function (built-in or user-provided)
#[derive(Clone)]
pub(crate) struct Function {
    name: &'static str,
    f: fn(&Context, &[Value]) -> Result<Value>,
}

impl fmt::Debug for Function {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Function({}, ..)", self.name)
    }
}

impl PartialEq for Function {
    fn eq(&self, other: &Self) -> bool {
        self.f as *const () == other.f as *const () && self.name == other.name
    }
}

impl Function {
    pub(crate) fn new(name: &'static str, f: fn(&Context, &[Value]) -> Result<Value>) -> Function {
        Function { name, f }
    }

    pub(crate) fn call(&self, context: &Context, args: &[Value]) -> Result<Value> {
        (self.f)(context, args)
    }
}

/// Internal representation of a JSON value.  This has a few advantages:
///  - can contain functions as first-class objects
///  - can represent a deletion marker
///  - a Number variant suitable for arithmetic
#[derive(Debug, PartialEq, Clone)]
pub(crate) enum Value {
    // Normal JSON types
    Null,
    String(String),
    Number(f64),
    Bool(bool),
    Object(Object),
    Array(Vec<Value>),

    // lack of a value (for an $if without then, for example); this is
    // converted to `null` in JSON.
    DeletionMarker,

    // A built-in or user-provided function
    Function(Function),
}

impl Value {
    /// Serialize this value to a JSON string.
    pub(crate) fn to_json(&self) -> Result<String> {
        let v: SerdeValue = self.try_into()?;
        Ok(serde_json::to_string(&v)?)
    }

    pub(crate) fn is_null(&self) -> bool {
        match self {
            Value::Null => true,
            _ => false,
        }
    }

    pub(crate) fn is_string(&self) -> bool {
        match self {
            Value::String(_) => true,
            _ => false,
        }
    }

    pub(crate) fn is_number(&self) -> bool {
        match self {
            Value::Number(_) => true,
            _ => false,
        }
    }

    pub(crate) fn is_bool(&self) -> bool {
        match self {
            Value::Bool(_) => true,
            _ => false,
        }
    }

    pub(crate) fn is_object(&self) -> bool {
        match self {
            Value::Object(_) => true,
            _ => false,
        }
    }

    pub(crate) fn is_array(&self) -> bool {
        match self {
            Value::Array(_) => true,
            _ => false,
        }
    }

    pub(crate) fn is_deletion_marker(&self) -> bool {
        match self {
            Value::DeletionMarker => true,
            _ => false,
        }
    }

    /// A reference to the string, if this is a String variant
    pub(crate) fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(s) => Some(s.as_ref()),
            _ => None,
        }
    }

    /// The numeric value, if this is a Number variant
    // TODO: &f64???
    pub(crate) fn as_f64(&self) -> Option<&f64> {
        match self {
            Value::Number(n) => Some(n),
            _ => None,
        }
    }

    /// The JSON-e-defined stringification of this value
    pub(crate) fn stringify(&self) -> Result<String> {
        Ok(match self {
            Value::Null => "null".to_owned(),
            Value::String(s) => s.clone(),
            Value::Number(n) => format!("{}", n),
            Value::Bool(b) if *b => "true".to_owned(),
            Value::Bool(b) if !*b => "false".to_owned(),
            // typically callers will ensure this does not occur
            _ => Err(template_error!("cannot stringify value"))?,
        })
    }
}

/// Utility function to turn an f64 into a serde Number, using the simplest form.
/// This conservatively assumes values outside (-u32::MAX..u32::MAX) are best
/// represented as floats
fn f64_to_serde_number(value: f64) -> Result<Number> {
    if value.fract() == 0.0 {
        if value < 0.0 && value > -(u32::MAX as f64) {
            return Ok((value as i64).into());
        } else if value >= 0.0 && value < u32::MAX as f64 {
            return Ok((value as u64).into());
        }
    }
    // the failure conditions here are NaN and Infinity, which we do not see
    Number::from_f64(value).ok_or_else(|| template_error!("{value} cannot be represented in JSON"))
}

impl From<&Value> for bool {
    fn from(value: &Value) -> bool {
        match value {
            Value::Number(n) => *n != 0.0,
            Value::Bool(b) => *b,
            Value::Null => false,
            Value::String(s) => s.len() > 0,
            Value::Array(a) => !a.is_empty(),
            Value::Object(o) => !o.is_empty(),
            Value::DeletionMarker => false,
            Value::Function(_) => true,
        }
    }
}

impl From<Value> for bool {
    fn from(value: Value) -> bool {
        (&value).into()
    }
}

impl From<&SerdeValue> for Value {
    fn from(value: &SerdeValue) -> Value {
        match value {
            SerdeValue::Null => Value::Null,
            SerdeValue::String(s) => Value::String(s.into()),
            // the failure conditions here are parse errors on an arbitrary-precision
            // value; ignorable since we dont' currently support arbitrary precision
            SerdeValue::Number(n) => Value::Number(n.as_f64().unwrap()),
            SerdeValue::Bool(b) => Value::Bool(*b),
            SerdeValue::Object(o) => {
                Value::Object(o.iter().map(|(k, v)| (k.into(), v.into())).collect())
            }
            SerdeValue::Array(a) => Value::Array(a.iter().map(|v| v.into()).collect()),
        }
    }
}

impl From<SerdeValue> for Value {
    fn from(value: SerdeValue) -> Value {
        (&value).into()
    }
}

impl TryFrom<&Value> for SerdeValue {
    type Error = Error;

    fn try_from(value: &Value) -> Result<SerdeValue> {
        Ok(match value {
            Value::Null => SerdeValue::Null,
            Value::String(s) => SerdeValue::String(s.into()),
            Value::Number(n) => SerdeValue::Number(f64_to_serde_number(*n)?),
            Value::Bool(b) => SerdeValue::Bool(*b),
            Value::Object(o) => SerdeValue::Object(
                o.iter()
                    .map(|(k, v)| Ok((k.into(), SerdeValue::try_from(v)?)))
                    .collect::<Result<Map<String, SerdeValue>>>()?,
            ),
            Value::Array(a) => SerdeValue::Array(
                a.iter()
                    .map(|v| SerdeValue::try_from(v))
                    .collect::<Result<Vec<SerdeValue>>>()?,
            ),
            Value::DeletionMarker => SerdeValue::Null,
            Value::Function(_) => {
                Err(template_error!("cannot represent JSON-e functions as JSON"))?
            }
        })
    }
}

impl TryFrom<Value> for SerdeValue {
    type Error = Error;

    fn try_from(value: Value) -> Result<SerdeValue> {
        SerdeValue::try_from(&value)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use serde_json::json;
    use std::convert::TryInto;
    use Value::*;

    #[test]
    fn conversions() {
        // These floats are chosen such that they exercise the assumption that
        // integer values outside (-u32::MAX..u32::MAX) are best represented as
        // floats.
        let small_float = (-100_000_000_000_000 as i64) as f64;
        let big_float = (100_000_000_000_000 as i64) as f64;

        let serde_value = json!({
            "the": "quick",
            "brown": ["fox", 2, 3.5, -5, small_float, big_float],
            "over": true,
            "the": false,
            "lazy": 0,
            "dog": null,
        });

        let jsone_value = Object(
            vec![
                ("the".to_string(), String("quick".to_string())),
                (
                    "brown".to_string(),
                    Array(vec![
                        String("fox".to_string()),
                        Number(2.0),
                        Number(3.5),
                        Number(-5.0),
                        Number(small_float),
                        Number(big_float),
                    ]),
                ),
                ("over".to_string(), Bool(true)),
                ("the".to_string(), Bool(false)),
                ("lazy".to_string(), Number(0.0)),
                ("dog".to_string(), Null),
            ]
            .drain(..)
            .collect(),
        );

        let converted: Value = (&serde_value).into();
        assert_eq!(converted, jsone_value);

        let converted: SerdeValue = (&jsone_value).try_into().unwrap();
        assert_eq!(converted, serde_value);
    }

    #[test]
    fn convert_ref() {
        let serde_value = json!(true);
        let converted: Value = (&serde_value).into();
        assert_eq!(converted, Value::Bool(true));
    }

    #[test]
    fn convert_value() {
        let serde_value = json!(true);
        let converted: Value = serde_value.into();
        assert_eq!(converted, Value::Bool(true));
    }

    #[test]
    fn test_is_truthy() {
        let obj = vec![("x".to_string(), Null)].drain(..).collect();
        let long = "very very very very very very very very very very long string".to_string();
        let tests = vec![
            (Null, false),
            (Array(vec![]), false),
            (Array(vec![Number(1.0)]), true),
            (Object(super::Object::new()), false),
            (Object(obj), true),
            (String("".to_string()), false),
            (String("short string".to_string()), true),
            (String(long), true),
            (Number(0.0), false),
            (Number(1.0), true),
            (Number(-1.0), true),
            (Bool(false), false),
            (Bool(true), true),
            (DeletionMarker, false),
        ];

        for (value, expected) in tests {
            let got: bool = (&value).into();
            assert_eq!(got, expected, "{:?} should be {}", value, expected);
        }
    }
}
