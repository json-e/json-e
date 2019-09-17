#![allow(dead_code)]

use crate::errors::Error;
use regex;
use std::collections::HashMap;
use std::fmt::Write;

struct Tokenizer {
    token_types: Vec<String>,
    regex: regex::Regex,
}

#[derive(Debug, Eq, PartialEq)]
struct Token {
    token_type: String,
    value: String,
    start: usize,
    end: usize,
}

impl Tokenizer {
    pub fn new(
        ignore: String,
        patterns: HashMap<String, String>,
        token_types: Vec<String>,
    ) -> Tokenizer {
        let re = Tokenizer::build_regex_string(ignore, patterns, &token_types).unwrap();

        let regex = regex::Regex::new(&re).unwrap();

        Tokenizer { token_types, regex }
    }

    fn build_regex_string(
        ignore: String,
        patterns: HashMap<String, String>,
        token_types: &[String],
    ) -> Result<String, std::fmt::Error> {
        let mut re = String::new();

        write!(&mut re, "^(?:")?;

        write!(&mut re, "({})", ignore)?;

        for t in token_types {
            match patterns.get(t) {
                Some(p) => write!(&mut re, "|({})", p)?,
                None => write!(&mut re, "|({})", regex::escape(t))?,
            }
        }

        write!(&mut re, ")")?;

        Ok(re)
    }

    pub fn tokenize(self: &Self, source: String, offset: usize) -> Result<Vec<Token>, Error> {
        let mut last_end = offset;
        let mut tokens = vec![];

        loop {
            let token = self.next(&source, last_end)?;
            match token {
                Some(t) => {
                    last_end = t.end;
                    tokens.push(t);
                }
                None => return Ok(tokens),
            }
        }
    }

    fn index_of_not_undefined(captures: &regex::Captures, index: usize) -> Option<usize> {
        let mut result: Option<usize> = None;
        for (i, cap) in captures.iter().enumerate().skip(index) {
            if cap.is_some() {
                result = Some(i);
                return result;
            }
        }

        result
    }

    // Return the next token after the given offset, or None if no tokens remain
    // in the string.
    pub fn next(self: &Self, source: &str, mut offset: usize) -> Result<Option<Token>, Error> {
        let mut i: usize;

        loop {
            match self.regex.captures(&source[offset..]) {
                None => {
                    if (&source[offset..] != "") {
                        // no match, but there's input left, so we have an error
                        return Err(Error::SyntaxError(format!(
                            "unexpected EOF for {} at {}",
                            &source,
                            &source[offset..]
                        )));
                    } else {
                        // we've parsed the whole string
                        return Ok(None);
                    }
                }
                Some(ref m) => {
                    i = Tokenizer::index_of_not_undefined(m, 1).unwrap();
                    offset += m.get(0).unwrap().end();

                    // if it's not an ignored expression, return it
                    if i != 1 {
                        return Ok(Some(Token {
                            token_type: self.token_types[i - 2].clone(),
                            value: m.get(i).unwrap().as_str().to_string(),
                            start: offset - m.get(0).unwrap().end(),
                            end: offset,
                        }));
                    }
                }
            }
        }
    }
}

mod tests {
    use crate::errors::Error;
    use crate::tokenizer::Token;
    use crate::tokenizer::Tokenizer;
    use std::collections::HashMap;

    fn build_tokenizer() -> Tokenizer {
        let mut hashmap = HashMap::new();
        hashmap.insert("number".to_string(), "[0-9]+".to_string());
        hashmap.insert("identifier".to_string(), "[a-z]+".to_string());
        hashmap.insert("snowman".to_string(), "☃".to_string());

        Tokenizer::new(
            "[ ]+".to_string(),
            hashmap,
            vec![
                "number".to_string(),
                "identifier".to_string(),
                "+".to_string(),
                "snowman".to_string(),
            ],
        )
    }

    #[test]
    fn build_regex_positive_string() {
        let re = Tokenizer::build_regex_string(
            "ign".to_string(),
            HashMap::new(),
            &vec!["abc".to_string(), "def".to_string()],
        )
        .unwrap();

        assert_eq!(re, "^(?:(ign)|(abc)|(def))")
    }

    #[test]
    fn build_regex_positive_hashmap() {
        let mut hashmap = HashMap::new();
        hashmap.insert("number".to_string(), "[0-9]+".to_string());
        hashmap.insert("identifier".to_string(), "[a-z]+".to_string());

        let re = Tokenizer::build_regex_string(
            "ign".to_string(),
            hashmap,
            &vec!["number".to_string(), "identifier".to_string()],
        )
        .unwrap();

        assert_eq!(re, "^(?:(ign)|([0-9]+)|([a-z]+))")
    }

    #[test]
    fn build_regex_positive_escape() {
        let re = Tokenizer::build_regex_string(
            "ign".to_string(),
            HashMap::new(),
            &vec!["*+?".to_string()],
        )
        .unwrap();

        assert_eq!(re, "^(?:(ign)|(\\*\\+\\?))")
    }

    #[test]
    fn constructor_positive() {
        let t = Tokenizer::new("ign".to_string(), HashMap::new(), vec!["*+?".to_string()]);
    }

    #[test]
    fn index_of_not_undefined_nonempty_captures() {
        let regex = regex::Regex::new("^(?:(ign)|([0-9]+)|([a-z]+))").unwrap();
        let captures = regex.captures("abckdf").unwrap();
        // should yield
        // 0: Some("abckdf") (the whole string matched)
        // 1: None
        // 2: None
        // 3: Some("abckdf")
        let index = Tokenizer::index_of_not_undefined(&captures, 1);
        assert_eq!(index, Some(3));
    }

    #[test]
    fn index_of_not_undefined_middle_matches() {
        let regex = regex::Regex::new("^(?:(ign)|([0-9]+)|([a-z]+))").unwrap();
        let captures = regex.captures("1234").unwrap();
        // should yield
        // 0: Some("1234") (the whole string matched)
        // 1: None
        // 2: Some("1234")
        // 3: None
        let index = Tokenizer::index_of_not_undefined(&captures, 1);
        assert_eq!(index, Some(2));
    }

    #[test]
    fn next_positive() {
        let tokenizer = build_tokenizer();

        assert_eq!(
            tokenizer.next("abc", 0),
            Ok(Some(Token {
                token_type: "identifier".to_string(),
                value: "abc".to_string(),
                start: 0,
                end: 3
            }))
        )
    }

    #[test]
    fn next_positive_whitespace() {
        let tokenizer = build_tokenizer();

        assert_eq!(
            tokenizer.next("  abc ", 0),
            Ok(Some(Token {
                token_type: "identifier".to_string(),
                value: "abc".to_string(),
                start: 2,
                end: 5
            }))
        )
    }

    #[test]
    fn next_positive_symbol() {
        let tokenizer = build_tokenizer();

        assert_eq!(
            tokenizer.next("  +abc ", 0),
            Ok(Some(Token {
                token_type: "+".to_string(),
                value: "+".to_string(),
                start: 2,
                end: 3
            }))
        )
    }

    #[test]
    fn next_positive_number() {
        let tokenizer = build_tokenizer();

        assert_eq!(
            tokenizer.next(" 2 +abc ", 0),
            Ok(Some(Token {
                token_type: "number".to_string(),
                value: "2".to_string(),
                start: 1,
                end: 2
            }))
        )
    }

    #[test]
    fn next_negative_unrecognized() {
        let tokenizer = build_tokenizer();

        assert_eq!(
            tokenizer.next(" * +abc ", 0),
            Err(Error::SyntaxError(
                "unexpected EOF for  * +abc  at * +abc ".to_string()
            ))
        )
    }

    #[test]
    fn next_negative_empty() {
        let tokenizer = build_tokenizer();

        assert_eq!(tokenizer.next("", 0), Ok(None))
    }

    #[test]
    fn next_positive_emoji() {
        let tokenizer = build_tokenizer();

        assert_eq!(
            tokenizer.next("☃", 0),
            Ok(Some(Token {
                token_type: "snowman".to_string(),
                value: "☃".to_string(),
                start: 0,
                end: 3, // snowman is 3 bytes long in utf-8
            }))
        )
    }

    #[test]
    fn tokenize_positive_string_of_tokens_with_whitespace() {
        let tokenizer = build_tokenizer();

        let result = tokenizer.tokenize("  +☃1234 abdk ☃".to_string(), 0).unwrap();
        let expected: Vec<Token> = vec![
            Token {
                token_type: "+".to_string(),
                value: "+".to_string(),
                start: 2,
                end: 3,
            },
            Token {
                token_type: "snowman".to_string(),
                value: "☃".to_string(),
                start: 3,
                end: 6,
            },
            Token {
                token_type: "number".to_string(),
                value: "1234".to_string(),
                start: 6,
                end: 10,
            },
            Token {
                token_type: "identifier".to_string(),
                value: "abdk".to_string(),
                start: 11,
                end: 15,
            },
            Token {
                token_type: "snowman".to_string(),
                value: "☃".to_string(),
                start: 16,
                end: 19,
            },
        ];
        assert_eq!(result, expected);
    }

    #[test]
    fn tokenize_negative_empty_string() {
        let tokenizer = build_tokenizer();

        let result = tokenizer.tokenize("".to_string(), 0).unwrap();
        let expected: Vec<Token> = vec![];
        assert_eq!(result, expected);
    }

    #[test]
    fn tokenize_negative_syntax_error() {
        let tokenizer = build_tokenizer();

        let result = tokenizer.tokenize("abc !!!!".to_string(), 0);
        assert_eq!(
            result,
            Err(Error::SyntaxError(
                "unexpected EOF for abc !!!! at !!!!".to_string()
            ))
        )
    }
}
