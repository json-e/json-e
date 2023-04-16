use nom::{character::complete::multispace0, error::ParseError, sequence::delimited, IResult};

/// chomp whitespace at either end of a combinator
// from https://github.com/Geal/nom/blob/master/doc/nom_recipes.md#whitespace
pub(crate) fn ws<'a, F, O, E: ParseError<&'a str>>(
    inner: F,
) -> impl FnMut(&'a str) -> IResult<&'a str, O, E>
where
    F: FnMut(&'a str) -> IResult<&'a str, O, E>,
{
    delimited(multispace0, inner, multispace0)
}
