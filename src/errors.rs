use failure::Fail;

#[derive(Debug, Fail, Eq, PartialEq, Clone)]
pub enum Error {
    #[fail(display = "Invalid Parser Error: {}", _0)]
    InvalidParserError(String),

    #[fail(display = "Syntax Error: {}", _0)]
    SyntaxError(String),
}
