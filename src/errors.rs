use thiserror::Error;

/// Construct a new syntax error, as an anyhow::Error
macro_rules! syntax_error {
    ($err:expr $(,)?) => ({
        anyhow::Error::new($crate::errors::SyntaxError($err.to_string()))
    });
    ($fmt:expr, $($arg:tt)*) => {
        anyhow::Error::new($crate::errors::SyntaxError(format!($fmt, $($arg)*)))
    };
}

/// Construct a new interpreter error, as an anyhow::Error
macro_rules! interpreter_error {
    ($err:expr $(,)?) => ({
        anyhow::Error::new($crate::errors::InterpreterError($err.to_string()))
    });
    ($fmt:expr, $($arg:tt)*) => {
        anyhow::Error::new($crate::errors::InterpreterError(format!($fmt, $($arg)*)))
    };
}

/// Construct a new template error, as an anyhow::Error
macro_rules! template_error {
    ($err:expr $(,)?) => ({
        anyhow::Error::new($crate::errors::TemplateError($err.to_string()))
    });
    ($fmt:expr, $($arg:tt)*) => {
        anyhow::Error::new($crate::errors::TemplateError(format!($fmt, $($arg)*)))
    };
}

/// Utility for asserting that an anyhow::Result contains a syntax error
#[cfg(test)]
macro_rules! assert_syntax_error {
    ($left:expr, $right:expr) => ({
        assert_eq!(
            $left.expect_err("Expected an error, got").downcast_ref::<$crate::errors::SyntaxError>().expect("Expected a SyntaxError"),
            &$crate::errors::SyntaxError($right.to_string())
        );
    });
    ($left:expr, $right:expr,) => ({
        assert_syntax_error!($left, $right)
    });
    ($left:expr, $right:expr, $($arg:tt)+) => ({
        assert_eq!(
            $left.expect_err("Expected an error, got").downcast_ref::<$crate::errors::SyntaxError>().expect("Expected a SyntaxError"),
            &$crate::errors::SyntaxError($right.to_string()),
            $($arg)*
        );
    });
}

/// Utility for asserting that an anyhow::Result contains an interpreter error
#[cfg(test)]
macro_rules! assert_interpreter_error {
    ($left:expr, $right:expr) => ({
        assert_eq!(
            $left.expect_err("Expected an error, got").downcast_ref::<$crate::errors::InterpreterError>().expect("Expected a InterpreterError"),
            &$crate::errors::InterpreterError($right.to_string())
        );
    });
    ($left:expr, $right:expr,) => ({
        assert_interpreter_error!($left, $right)
    });
    ($left:expr, $right:expr, $($arg:tt)+) => ({
        assert_eq!(
            $left.expect_err("Expected an error, got").downcast_ref::<$crate::errors::InterpreterError>().expect("Expected a InterpreterError"),
            &$crate::errors::InterpreterError($right.to_string()),
            $($arg)*
        );
    });
}

/// Utility for asserting that an anyhow::Result contains an template error
#[cfg(test)]
macro_rules! assert_template_error {
    ($left:expr, $right:expr) => ({
        assert_eq!(
            $left.expect_err("Expected an error, got").downcast_ref::<$crate::errors::TemplateError>().expect("Expected a TemplateError"),
            &$crate::errors::TemplateError($right.to_string())
        );
    });
    ($left:expr, $right:expr,) => ({
        assert_template_error!($left, $right)
    });
    ($left:expr, $right:expr, $($arg:tt)+) => ({
        assert_eq!(
            $left.expect_err("Expected an error, got").downcast_ref::<$crate::errors::TemplateError>().expect("Expected a TemplateError"),
            &$crate::errors::TemplateError($right.to_string()),
            $($arg)*
        );
    });
}

/// A SyntaxError indicates something wrong with the syntax of a JSON-e expression.
#[derive(Debug, Error, Eq, PartialEq, Clone)]
#[error("Syntax Error: {0}")]
pub struct SyntaxError(pub(crate) String);

/// An InterpreterError indicates something that failed during evaluation of a JSON-e expression.
#[derive(Debug, Error, Eq, PartialEq, Clone)]
#[error("Interpreter Error: {0}")]
pub struct InterpreterError(pub(crate) String);

/// An TemplateError indicates something that failed during evaluation of a JSON-e expression.
#[derive(Debug, Error, Eq, PartialEq, Clone)]
#[error("TemplateError: {0}")]
pub struct TemplateError(pub(crate) String);
