#![allow(unused_variables)]
#![allow(dead_code)]

use anyhow::{anyhow, Result};
use serde_json::Value;
use std::collections::HashMap;

pub(crate) struct Context<'a> {
    content: HashMap<String, Value>,
    parent: Option<&'a Context<'a>>,
}

/// Context for expression evaluation.
impl<'a> Context<'a> {
    /// Create a new, empty context.
    pub(crate) fn new() -> Context<'a> {
        Context {
            content: HashMap::new(),
            parent: None,
        }
    }

    /// Create a child context, which will defer to the parent context when a value
    /// is not defined.
    pub(crate) fn child(&'a self) -> Context<'a> {
        Context {
            content: HashMap::new(),
            parent: Some(self),
        }
    }

    /// Create a context from a JSON value, which must be an object.
    pub(crate) fn from_value(value: &'_ Value, parent: Option<&'a Context>) -> Result<Context<'a>> {
        let mut c = Context {
            content: HashMap::new(),
            parent,
        };

        if let Value::Object(o) = value {
            for (k, v) in o.iter() {
                c.insert(k, v.clone());
            }
        } else {
            return Err(anyhow!("Context is not an Object"));
        }

        Ok(c)
    }

    /// Insert a value into this context.
    pub(crate) fn insert<K: Into<String>>(&mut self, k: K, v: Value) {
        self.content.insert(k.into(), v);
    }

    /// Get a value from this context (or its parents)
    pub(crate) fn get<'b>(&'b self, k: &'_ str) -> Option<&'b Value> {
        match self.content.get(k) {
            Some(v) => Some(v),
            None => match self.parent {
                Some(p) => p.get(k),
                None => None,
            },
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_get_not_found() {
        let c = Context::new();
        assert_eq!(c.get("xyz"), None);
    }

    #[test]
    fn test_get_found() {
        let mut c = Context::new();
        c.insert("abc", json!(null));
        assert_eq!(c.get("abc"), Some(&json!(null)));
    }

    #[test]
    fn test_get_parent() {
        let mut c1 = Context::new();
        c1.insert("abc", json!(null));
        c1.insert("def", json!(true));
        let mut c2 = c1.child();
        c2.insert("def", json!(false));
        c2.insert("ghi", json!("hi"));
        assert_eq!(c2.get("abc"), Some(&json!(null)));
        assert_eq!(c2.get("def"), Some(&json!(false)));
        assert_eq!(c2.get("ghi"), Some(&json!("hi")));
    }
}
