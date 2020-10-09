use anyhow::{anyhow, Result};
use chrono::{DateTime, Duration, Utc};
use nom::{
    branch::alt,
    bytes::complete::tag,
    character::complete::{digit1, multispace0},
    combinator::{map_res, opt},
    error::ParseError,
    sequence::{pair, tuple},
    IResult,
};
use std::sync::atomic::{AtomicBool, Ordering};

const SIMPLIFIED_EXTENDED_ISO_8601: &str = "%Y-%m-%dT%H:%M:%S%.3fZ";
static USE_TEST_TIME: AtomicBool = AtomicBool::new(false);

/// Get the current time, as a properly-formatted string
pub(crate) fn now() -> String {
    // when testing, we use a fixed value for "now"
    if USE_TEST_TIME.load(Ordering::Acquire) {
        return "2017-01-19T16:27:20.974Z".to_string();
    }
    format!("{}", Utc::now().format(SIMPLIFIED_EXTENDED_ISO_8601))
}

/// Use the test time (2017-01-19T16:27:20.974Z) as the current time for all
/// subsequent operations.  This is only useful in testing this library.
pub fn use_test_now() {
    USE_TEST_TIME.store(true, Ordering::Release);
}

/// Calculate a time offset from a reference time.
///
/// Date-times are are specified in simplified extended ISO format (ISO 8601) with zero timezone offset;
/// this is the format used by the JS `Date.toISOString()` function, and has the form
/// `YYYY-MM-DDTHH:mm:ss(.sss)?Z`, where the decimal portion of the seconds is optional.
pub(crate) fn from_now(offset: &str, reference: &str) -> Result<String> {
    let reference: DateTime<Utc> = reference.parse()?;
    let dur = parse_duration(offset)
        .ok_or_else(|| anyhow!("String '{}' isn't a time expression", offset))?;
    Ok(format!(
        "{}",
        (reference + dur).format(SIMPLIFIED_EXTENDED_ISO_8601)
    ))
}

fn int(input: &str) -> IResult<&str, i64> {
    fn to_int(input: (&str, &str)) -> Result<i64, ()> {
        Ok(input.0.parse().map_err(|_| ())?)
    }
    map_res(tuple((digit1, multispace0)), to_int)(input)
}

/// chomp trailing whitespace
// from https://github.com/Geal/nom/blob/master/doc/nom_recipes.md#whitespace
fn ws<'a, F: 'a, O, E: ParseError<&'a str>>(inner: F) -> impl Fn(&'a str) -> IResult<&'a str, O, E>
where
    F: Fn(&'a str) -> IResult<&'a str, O, E>,
{
    map_res(pair(inner, multispace0), |input| Ok(input.0) as Result<O>)
}

fn sign(input: &str) -> IResult<&str, bool> {
    fn to_bool(input: &str) -> Result<bool, ()> {
        Ok(input == "-")
    }
    map_res(ws(alt((tag("-"), tag("+")))), to_bool)(input)
}

fn years(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        // "a year" is not a precise length of time, but fromNow assumes 365 days
        Ok(Duration::days(input.0 * 365))
    }
    map_res(
        tuple((int, alt((tag("years"), tag("year"), tag("yr"), tag("y"))))),
        to_duration,
    )(input)
}

fn months(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        // "a month" is not a precise length of time, but fromNow assumes 30 days
        Ok(Duration::days(input.0 * 30))
    }
    map_res(
        tuple((int, alt((tag("months"), tag("month"), tag("mo"))))),
        to_duration,
    )(input)
}

fn weeks(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        Ok(Duration::weeks(input.0))
    }
    map_res(
        tuple((int, alt((tag("weeks"), tag("week"), tag("wk"), tag("w"))))),
        to_duration,
    )(input)
}

fn days(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        Ok(Duration::days(input.0))
    }
    map_res(
        tuple((int, alt((tag("days"), tag("day"), tag("d"))))),
        to_duration,
    )(input)
}

fn hours(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        Ok(Duration::hours(input.0))
    }
    map_res(
        tuple((int, alt((tag("hours"), tag("hour"), tag("h"))))),
        to_duration,
    )(input)
}

fn minutes(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        Ok(Duration::minutes(input.0))
    }
    map_res(
        tuple((
            int,
            alt((tag("minutes"), tag("minute"), tag("min"), tag("m"))),
        )),
        to_duration,
    )(input)
}

fn seconds(input: &str) -> IResult<&str, Duration> {
    fn to_duration(input: (i64, &str)) -> Result<Duration, ()> {
        Ok(Duration::seconds(input.0))
    }
    map_res(
        tuple((
            int,
            alt((tag("seconds"), tag("second"), tag("sec"), tag("s"))),
        )),
        to_duration,
    )(input)
}

fn duration(input: &str) -> IResult<&str, Duration> {
    // This looks a little silly, in that it's just adding the components, but this
    // enforces that each component appears once and in the proper order.
    fn sum_duration(
        input: (
            &str,
            Option<bool>,
            Option<Duration>,
            Option<Duration>,
            Option<Duration>,
            Option<Duration>,
            Option<Duration>,
            Option<Duration>,
            Option<Duration>,
        ),
    ) -> Result<Duration, ()> {
        let mut dur = Duration::zero();
        if let Some(d) = input.2 {
            dur = dur + d;
        }
        if let Some(d) = input.3 {
            dur = dur + d;
        }
        if let Some(d) = input.4 {
            dur = dur + d;
        }
        if let Some(d) = input.5 {
            dur = dur + d;
        }
        if let Some(d) = input.6 {
            dur = dur + d;
        }
        if let Some(d) = input.7 {
            dur = dur + d;
        }
        if let Some(d) = input.8 {
            dur = dur + d;
        }
        // input.1 is true if there was a `-` in the offset
        if input.1 == Some(true) {
            dur = -dur;
        }
        Ok(dur)
    }
    map_res(
        tuple((
            multispace0,
            ws(opt(sign)),
            ws(opt(years)),
            ws(opt(months)),
            ws(opt(weeks)),
            ws(opt(days)),
            ws(opt(hours)),
            ws(opt(minutes)),
            ws(opt(seconds)),
        )),
        sum_duration,
    )(input)
}

fn parse_duration(input: &str) -> Option<Duration> {
    match duration(input) {
        Ok(("", dur)) => Some(dur),
        _ => None,
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_empty_string() {
        assert_eq!(parse_duration(""), Some(Duration::zero()));
    }

    #[test]
    fn test_1s() {
        assert_eq!(parse_duration("1s"), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_1sec() {
        assert_eq!(parse_duration("1sec"), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_1second() {
        assert_eq!(parse_duration("1second"), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_2seconds() {
        assert_eq!(parse_duration("2seconds"), Some(Duration::seconds(2)));
    }

    #[test]
    fn test_10s() {
        assert_eq!(parse_duration("10s"), Some(Duration::seconds(10)));
    }

    #[test]
    fn test_1s_space1() {
        assert_eq!(parse_duration("  1s"), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_1s_space2() {
        assert_eq!(parse_duration("1  s"), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_1s_space3() {
        assert_eq!(parse_duration("1s  "), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_1s_space4() {
        assert_eq!(parse_duration(" 1   s  "), Some(Duration::seconds(1)));
    }

    #[test]
    fn test_3m() {
        assert_eq!(parse_duration("3m"), Some(Duration::minutes(3)));
    }

    #[test]
    fn test_3min() {
        assert_eq!(parse_duration("3min"), Some(Duration::minutes(3)));
    }

    #[test]
    fn test_3minute() {
        assert_eq!(parse_duration("3minute"), Some(Duration::minutes(3)));
    }

    #[test]
    fn test_3minutes() {
        assert_eq!(parse_duration("3minutes"), Some(Duration::minutes(3)));
    }

    #[test]
    fn test_3h() {
        assert_eq!(parse_duration("3h"), Some(Duration::hours(3)));
    }

    #[test]
    fn test_4day() {
        assert_eq!(parse_duration("4day"), Some(Duration::days(4)));
    }

    #[test]
    fn test_5weeks() {
        assert_eq!(parse_duration("5 weeks"), Some(Duration::weeks(5)));
    }

    #[test]
    fn test_6mo() {
        assert_eq!(parse_duration("6 months"), Some(Duration::days(6 * 30)));
    }

    #[test]
    fn test_7yr() {
        assert_eq!(parse_duration("7 yr"), Some(Duration::days(7 * 365)));
    }

    #[test]
    fn test_all_units() {
        assert_eq!(
            parse_duration("7y6mo5w4d3h2m1s"),
            Some(
                Duration::seconds(1)
                    + Duration::minutes(2)
                    + Duration::hours(3)
                    + Duration::days(4)
                    + Duration::weeks(5)
                    + Duration::days(6 * 30)
                    + Duration::days(7 * 365)
            )
        );
    }

    #[test]
    fn test_all_units_neg() {
        assert_eq!(
            parse_duration(" - 7y6mo5w4d3h2m1s"),
            Some(
                -Duration::seconds(1)
                    - Duration::minutes(2)
                    - Duration::hours(3)
                    - Duration::days(4)
                    - Duration::weeks(5)
                    - Duration::days(6 * 30)
                    - Duration::days(7 * 365)
            )
        );
    }

    #[test]
    fn test_all_units_space() {
        assert_eq!(
            parse_duration(" 7 y 6 mo 5 w 4 d 3 h 2 m 1 s "),
            Some(
                Duration::seconds(1)
                    + Duration::minutes(2)
                    + Duration::hours(3)
                    + Duration::days(4)
                    + Duration::weeks(5)
                    + Duration::days(6 * 30)
                    + Duration::days(7 * 365)
            )
        );
    }
}
