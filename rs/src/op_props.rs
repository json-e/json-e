use anyhow::Result;
use nom::{
    branch::alt,
    bytes::complete::tag,
    character::complete::{alpha1, alphanumeric1, multispace0},
    combinator::{map_res, opt, recognize},
    multi::many0,
    sequence::{pair, tuple},
    IResult,
};

fn ident(input: &str) -> IResult<&str, &str> {
    let (input, _) = multispace0(input)?;
    recognize(pair(
        alt((alpha1, tag("_"))),
        many0(alt((alphanumeric1, tag("_")))),
    ))(input)
}

fn each(input: &str) -> IResult<&str, (&str, Option<&str>)> {
    fn to_result<'a>(
        input: (&str, &'a str, Option<(&str, &'a str)>, &str),
    ) -> Result<(&'a str, Option<&'a str>), ()> {
        Ok((input.1, input.2.map(|x| x.1)))
    }
    map_res(
        tuple((tag("each("), ident, opt(tuple((tag(","), ident))), tag(")"))),
        to_result,
    )(input)
}

/// Parse the each(..) property of $map, or return None if no match
pub(crate) fn parse_each(input: &str) -> Option<(&str, Option<&str>)> {
    match each(input) {
        Ok(("", r)) => Some(r),
        _ => None,
    }
}

fn each_three(input: &str) -> IResult<&str, (&str, &str, Option<&str>)> {
    fn to_result<'a>(
        input: (&str, &'a str, &str, &'a str, Option<(&str, &'a str)>, &str),
    ) -> Result<(&'a str, &'a str, Option<&'a str>), ()> {
        Ok((input.1, input.3, input.4.map(|x| x.1)))
    }
    map_res(
        tuple((tag("each("), ident, tag(","), ident, opt(tuple((tag(","), ident))), tag(")"))),
        to_result,
    )(input)
}

/// Parse the each(..) property of $reduce, or return None if no match
pub(crate) fn parse_each_three(input: &str) -> Option<(&str, &str, Option<&str>)> {
    match each_three(input) {
        Ok(("", r)) => Some(r),
        _ => None,
    }
}

fn by(input: &str) -> IResult<&str, &str> {
    fn to_result<'a>(input: (&str, &'a str, &str)) -> Result<&'a str> {
        Ok(input.1)
    }
    map_res(tuple((tag("by("), ident, tag(")"))), to_result)(input)
}

/// Parse the by(..) property of sort, or return None if no match
pub(crate) fn parse_by(input: &str) -> Option<&str> {
    match by(input) {
        Ok(("", r)) => Some(r),
        _ => None,
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn not_each() {
        assert_eq!(parse_each("uhh"), None);
    }

    #[test]
    fn single_var() {
        assert_eq!(parse_each("each(x)"), Some(("x", None)));
    }

    #[test]
    fn single_long_var() {
        assert_eq!(parse_each("each(exes)"), Some(("exes", None)));
    }

    #[test]
    fn two_vars() {
        assert_eq!(parse_each("each(x,y)"), Some(("x", Some("y"))));
    }

    #[test]
    fn two_longer_vars() {
        assert_eq!(parse_each("each(x123,y123)"), Some(("x123", Some("y123"))));
    }

    #[test]
    fn three_vars() {
        assert_eq!(parse_each("each(x,y,z)"), None);
    }

    #[test]
    fn not_each_three() {
        assert_eq!(parse_each_three("uhh"), None);
    }

    #[test]
    fn single_var_three() {
        assert_eq!(parse_each_three("each(x)"),  None);
    }

    #[test]
    fn two_vars_three() {
        assert_eq!(parse_each_three("each(x,y)"), Some(("x", "y", None)));
    }

    #[test]
    fn two_longer_vars_three() {
        assert_eq!(parse_each_three("each(x123,y123)"), Some(("x123", "y123", None)));
    }

    #[test]
    fn three_vars_three() {
        assert_eq!(parse_each_three("each(x,y,z)"), Some(("x", "y", Some("z"))));
    }

    #[test]
    fn three_longer_vars_three() {
        assert_eq!(parse_each_three("each(x123,y123,z1234)"), Some(("x123", "y123", Some("z1234"))));
    }

    #[test]
    fn by_ok() {
        assert_eq!(parse_by("by(x)"), Some("x"));
    }

    #[test]
    fn not_by() {
        assert_eq!(parse_by("by(b)a"), None);
    }

    #[test]
    fn by_many() {
        assert_eq!(parse_by("by(x,y)"), None);
    }
}
