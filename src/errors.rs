use failure::Fail;

#[derive(Debug, Fail, Eq, PartialEq, Clone)]
pub enum Error {
    #[fail(display = "Invalid Parser Error: {}", _0)]
    InvalidParserError(String),

    #[fail(display = "Syntax Error: {}", _0)]
    SyntaxError(String),
}

impl From<std::num::ParseIntError> for Error {
    fn from(error: std::num::ParseIntError) -> Self {
        Error::SyntaxError("Invalid integer".to_string())
    }
}

impl From<std::num::ParseFloatError> for Error {
    fn from(error: std::num::ParseFloatError) -> Self {
        Error::SyntaxError("Invalid number".to_string())
    }
}