#![allow(dead_code)]
use crate::tokenizer::Token;
use crate::tokenizer::Tokenizer;
use anyhow::{anyhow, Result};
use std::collections::HashMap;

pub(crate) struct PrattParser<'a, T, C> {
    tokenizer: Tokenizer<'a>,
    precedence_map: HashMap<&'a str, usize>,
    prefix_rules: HashMap<&'a str, fn(&Token, &mut Context<T, C>) -> Result<T>>,
    infix_rules: HashMap<&'a str, fn(&T, &Token, &mut Context<T, C>) -> Result<T>>,
}

impl<'a, T, C> PrattParser<'a, T, C> {
    pub(crate) fn new(
        ignore: &str,
        patterns: HashMap<&str, &str>,
        token_types: Vec<&'a str>,
        precedence: Vec<Vec<&'a str>>,
        prefix_rules: HashMap<&'a str, fn(&Token, &mut Context<T, C>) -> Result<T>>,
        infix_rules: HashMap<&'a str, fn(&T, &Token, &mut Context<T, C>) -> Result<T>>,
    ) -> Result<PrattParser<'a, T, C>> {
        let tokenizer = Tokenizer::new(ignore, patterns, token_types);
        let mut precedence_map: HashMap<&'a str, usize> = HashMap::new();

        for (i, row) in precedence.iter().enumerate() {
            for kind in row.iter() {
                precedence_map.insert(kind, i + 1);
            }
        }

        for kind in infix_rules.keys() {
            if !precedence_map.contains_key(kind) {
                return Err(anyhow!("token {} must have a precedence", kind));
            }
        }

        Ok(PrattParser {
            tokenizer,
            precedence_map,
            prefix_rules,
            infix_rules,
        })
    }

    pub(crate) fn parse(self: &Self, source: &str, context: C, offset: usize) -> Result<T> {
        let mut ctx = Context::new(self, source, context, offset);

        ctx.parse(None) // todo javascript calls attempt
    }
}

pub(crate) struct Context<'a, 'v, T, C> {
    parser: &'a PrattParser<'a, T, C>,
    source: &'v str,
    pub context: C, // todo find a better name
    next: Result<Option<Token<'a, 'v>>>,
}

impl<'a, 'v, T, C> Context<'a, 'v, T, C> {
    pub(crate) fn new(
        parser: &'a PrattParser<'a, T, C>,
        source: &'v str,
        context: C,
        offset: usize,
    ) -> Context<'a, 'v, T, C> {
        let next = parser.tokenizer.next(source, offset);
        Context {
            source,
            parser,
            next,
            context,
        }
    }

    pub(crate) fn attempt(
        self: &mut Self,
        // TODO: come up with better name (checks whether token is of interest)
        is_type_allowed: impl Fn(&'a str) -> bool,
    ) -> Result<Option<Token<'a, 'v>>> {
        match self.next {
            Ok(ref mut t) => {
                if let Some(ref token) = t {
                    // no match, so leave the next token in place
                    if !is_type_allowed(token.token_type) {
                        return Ok(None);
                    }
                }
                match t.take() {
                    Some(token) => {
                        self.next = self.parser.tokenizer.next(self.source, token.end);
                        return Ok(Some(token));
                    }
                    None => return Ok(None),
                }
            }
            Err(ref mut err) => {
                // if a tokenizer error is returned once, but we need to leave an error in place
                // in case attempt() is called again.
                let mut e = anyhow!("attempt() called after {}", err);
                std::mem::swap(&mut e, err);
                return Err(e);
            }
        }
    }

    pub(crate) fn require(
        self: &mut Self,
        is_type_allowed: impl Fn(&'a str) -> bool,
    ) -> Result<Token<'a, 'v>> {
        match self.attempt(|_| true) {
            Ok(ot) => match ot {
                Some(t) => {
                    if is_type_allowed(t.token_type) {
                        Ok(t)
                    } else {
                        Err(syntax_error!("Unexpected token error"))
                    }
                }
                None => Err(syntax_error!("unexpected end of input")),
            },
            Err(e) => Err(e),
        }
    }

    pub(crate) fn parse(self: &mut Self, precedence_type: Option<&str>) -> Result<T> {
        let precedence = match precedence_type {
            Some(p) => *self.parser.precedence_map.get(p).unwrap(),
            //.expect("precedence_type has no precedence"),
            None => 0,
        };
        let token = self.require(|_| true)?;
        let prefix_rule = self.parser.prefix_rules.get(token.token_type);
        match prefix_rule {
            Some(rule) => {
                let mut left = rule(&token, self)?;
                loop {
                    if let Ok(Some(ref next)) = self.next {
                        if let Some(infix_rule) = self.parser.infix_rules.get(next.token_type) {
                            if let Some(next_precedence) =
                                self.parser.precedence_map.get(next.token_type)
                            {
                                if &precedence >= next_precedence {
                                    break;
                                }

                                let token = self.require(|_| true)?;
                                left = infix_rule(&left, &token, self)?;
                                continue;
                            }
                        }
                    }
                    break;
                }

                Ok(left)
            }
            None => {
                let mut prefix_rules = self
                    .parser
                    .prefix_rules
                    .keys()
                    .cloned()
                    .collect::<Vec<&str>>();
                prefix_rules.sort();
                Err(syntax_error!(
                    "Found: {} token, expected one of: {}",
                    token.value,
                    prefix_rules.join(", ")
                )
                .into())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::prattparser::{Context, PrattParser};
    use crate::tokenizer::Token;
    use anyhow::Result;
    use std::collections::HashMap;

    fn build_parser() -> PrattParser<'static, usize, ()> {
        let mut patterns = HashMap::new();
        patterns.insert("number", "[.0-9]+");
        patterns.insert("identifier", "[a-z]+");
        patterns.insert("snowman", "☃");

        let mut prefix: HashMap<&str, fn(&Token, &mut Context<usize, ()>) -> Result<usize>> =
            HashMap::new();
        prefix.insert("identifier", |_token, _context| Ok(10));
        prefix.insert("number", |token, _context| {
            Ok(token.value.parse::<usize>()?)
        });

        let mut infix: HashMap<&str, fn(&usize, &Token, &mut Context<usize, ()>) -> Result<usize>> =
            HashMap::new();
        infix.insert("snowman", |left, _token, context| {
            let right = context.parse(Some("snowman")).unwrap();
            Ok(left * right)
        });
        infix.insert("+", |left, _token, context| {
            let right = context.parse(Some("+")).unwrap();
            Ok(left + right)
        });

        let pp = PrattParser::new(
            "[ ]+",
            patterns,
            vec!["number", "identifier", "+", "snowman"],
            vec![vec!["+"], vec!["snowman"]],
            prefix,
            infix,
        )
        .unwrap();

        pp
    }

    #[test]
    fn negative_constructor_no_precedence() {
        let mut patterns = HashMap::new();
        patterns.insert("number", "[0-9]+");
        patterns.insert("identifier", "[a-z]+");
        patterns.insert("snowman", "☃");

        let mut prefix: HashMap<&str, fn(&Token, &mut Context<usize, ()>) -> Result<usize>> =
            HashMap::new();
        prefix.insert("identifier", |_token, _context| Ok(10));
        prefix.insert("number", |token, _context| {
            Ok(token.value.parse::<usize>().unwrap())
        });

        let mut infix: HashMap<&str, fn(&usize, &Token, &mut Context<usize, ()>) -> Result<usize>> =
            HashMap::new();
        infix.insert("snowman", |left, _token, context| {
            let right = context.parse(Some("snowman")).unwrap();
            Ok(left * right)
        });
        infix.insert("+", |left, _token, context| {
            let right = context.parse(Some("+")).unwrap();
            Ok(left + right)
        });

        assert_eq!(
            PrattParser::new(
                "[ ]+",
                patterns,
                vec!["number", "identifier", "+", "snowman"],
                vec![vec!["+"]],
                prefix,
                infix,
            )
            .err()
            .unwrap()
            .to_string(),
            String::from("token snowman must have a precedence"),
        );
    }

    #[test]
    fn positive_attempt() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "123", (), 0);

        assert_eq!(
            context.attempt(|_| true).unwrap().unwrap(),
            Token {
                token_type: "number",
                value: "123",
                start: 0,
                end: 3
            }
        );
    }

    #[test]
    fn attempt_not_allowed_type() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "123", (), 0);

        assert_eq!(context.attempt(|ty| ty == "identifier").unwrap(), None);
    }

    #[test]
    fn attempt_allowed_after_not_allowed_type() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "123", (), 0);

        assert_eq!(context.attempt(|ty| ty == "identifier").unwrap(), None);
        assert_eq!(
            context.attempt(|ty| ty == "number").unwrap(),
            Some(Token {
                token_type: "number",
                value: "123",
                start: 0,
                end: 3
            })
        );
    }

    #[test]
    fn attempt_end_of_string() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "   ", (), 0);

        assert_eq!(context.attempt(|_| true).unwrap(), None);
    }

    #[test]
    fn attempt_invalid_syntax() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "🍎 ", (), 0);

        assert_syntax_error!(context.attempt(|_| true), "unexpected EOF for 🍎  at 🍎 ");
    }

    #[test]
    fn require_positive() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "abc", (), 0);

        assert_eq!(
            context.require(|_| true).unwrap(),
            Token {
                token_type: "identifier",
                value: "abc",
                start: 0,
                end: 3
            }
        )
    }

    #[test]
    fn require_end_of_string() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "   ", (), 0);

        assert_syntax_error!(context.require(|_| true), "unexpected end of input");
    }

    #[test]
    fn require_invalid_syntax() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "🍎 ", (), 0);

        assert_syntax_error!(context.require(|_| true), "unexpected EOF for 🍎  at 🍎 ");
    }

    #[test]
    fn require_unexpected_token() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "☃️", (), 0);

        assert_syntax_error!(
            context.require(|ty| ty == "identifier"),
            "Unexpected token error"
        );
    }

    #[test]
    fn parse_negative_no_prefix_rules() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "+ 10", (), 0);
        assert_syntax_error!(
            context.parse(None),
            "Found: + token, expected one of: identifier, number"
        );
    }

    #[test]
    fn parse_number() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2", (), 0);

        assert_eq!(context.parse(None).unwrap(), 2);
    }

    #[test]
    fn parse_number_should_error() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2.7", (), 0);

        assert_eq!(
            context
                .parse(None)
                .expect_err("Expected an error")
                .to_string(),
            // This error comes from parse::<usize>()
            "invalid digit found in string".to_string()
        );
    }

    #[test]
    fn parse_addition() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2 + 3", (), 0);

        assert_eq!(context.parse(None).unwrap(), 5);
    }

    #[test]
    fn parse_snowmaning() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2 ☃ 3", (), 0);

        assert_eq!(context.parse(None).unwrap(), 6);
    }

    #[test]
    fn parse_check_precedence() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "1 + 2 ☃ 3", (), 0);

        assert_eq!(context.parse(None).unwrap(), 7);
    }

    #[test]
    fn parse_check_reverse_precedence() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2 ☃ 3 + 4", (), 0);

        assert_eq!(context.parse(None).unwrap(), 10);
    }
}
