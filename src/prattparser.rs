use crate::errors::Error;
use crate::tokenizer::Token;
use crate::tokenizer::Tokenizer;
use json::JsonValue;
use std::collections::HashMap;

pub struct PrattParser<'a, T> {
    tokenizer: Tokenizer<'a>,
    precedence_map: HashMap<&'a str, usize>,
    prefix_rules: HashMap<&'a str, fn(&Token, &mut Context<T>) -> Result<T, Error>>,
    infix_rules: HashMap<&'a str, fn(&T, &Token, &mut Context<T>) -> Result<T, Error>>,
}

impl<'a, T> PrattParser<'a, T> {
    pub fn new(
        ignore: &str,
        patterns: HashMap<&str, &str>,
        token_types: Vec<&'a str>,
        precedence: Vec<Vec<&'a str>>,
        prefix_rules: HashMap<&'a str, fn(&Token, &mut Context<T>) -> Result<T, Error>>,
        infix_rules: HashMap<&'a str, fn(&T, &Token, &mut Context<T>) -> Result<T, Error>>,
    ) -> Result<PrattParser<'a, T>, Error> {
        let tokenizer = Tokenizer::new(ignore, patterns, token_types);
        let mut precedence_map: HashMap<&'a str, usize> = HashMap::new();

        for (i, row) in precedence.iter().enumerate() {
            for kind in row.iter() {
                precedence_map.insert(kind, i + 1);
            }
        }

        for kind in infix_rules.keys() {
            if !precedence_map.contains_key(kind) {
                return Err(Error::InvalidParserError(format!(
                    "token {} must have a precedence",
                    kind
                )));
            }
        }

        Ok(PrattParser {
            tokenizer,
            precedence_map,
            prefix_rules,
            infix_rules,
        })
    }

    pub fn parse(
        self: &Self,
        source: &str,
        context: HashMap<&'a str, &'a str>,
        offset: usize,
    ) -> Result<T, Error> {
        let mut ctx = Context::new(self, source, context, offset);

        ctx.parse(None) // todo javascript calls attempt
    }
}

pub struct Context<'a, 'v, T> {
    parser: &'a PrattParser<'a, T>,
    source: &'v str,
    context: HashMap<&'a str, &'a str>, // todo find a better name
    next: Result<Option<Token<'a, 'v>>, Error>,
}

impl<'a, 'v, T> Context<'a, 'v, T> {
    pub fn new(
        parser: &'a PrattParser<'a, T>,
        source: &'v str,
        context: HashMap<&'a str, &'a str>,
        offset: usize,
    ) -> Context<'a, 'v, T> {
        let next = parser.tokenizer.next(source, offset);
        Context {
            source,
            parser,
            next,
            context,
        }
    }

    pub fn attempt(
        self: &mut Self,
        is_type_allowed: fn(&'a str) -> bool,
    ) -> Result<Option<Token<'a, 'v>>, Error> {
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
            // if a tokenizer error occurrs, all calls to attempt() after that will return the
            // error, so we must copy it.
            Err(ref err) => return Err((*err).clone()),
        }
    }

    pub fn require(
        self: &mut Self,
        is_type_allowed: fn(&'a str) -> bool,
    ) -> Result<Token<'a, 'v>, Error> {
        match self.attempt(|_| true) {
            Ok(ot) => match ot {
                Some(t) => {
                    if is_type_allowed(t.token_type) {
                        Ok(t)
                    } else {
                        Err(Error::SyntaxError("Unexpected token error".to_string()))
                    }
                }
                None => Err(Error::SyntaxError("unexpected end of input".to_string())),
            },
            Err(e) => Err(e),
        }
    }

    pub fn parse(self: &mut Self, precedence_type: Option<&str>) -> Result<T, Error> {
        let precedence = match precedence_type {
            Some(p) => *self.parser.precedence_map.get(p).unwrap(),
            //.expect("precedence_type has no precedence"),
            None => 0,
        };
        let token = self.require(|ty| true)?;
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

                                let token = self.require(|ty| true)?;
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
                Err(Error::SyntaxError(format!(
                    "Found: {} token, expected one of: {}",
                    token.value,
                    prefix_rules.join(", ")
                )))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::errors::Error;
    use crate::errors::Error::SyntaxError;
    use crate::prattparser::{Context, PrattParser};
    use crate::tokenizer::Token;
    use std::collections::HashMap;

    fn build_parser() -> PrattParser<'static, usize> {
        let mut patterns = HashMap::new();
        patterns.insert("number", "[.0-9]+");
        patterns.insert("identifier", "[a-z]+");
        patterns.insert("snowman", "☃");

        let mut prefix: HashMap<&str, fn(&Token, &mut Context<usize>) -> Result<usize, Error>> =
            HashMap::new();
        prefix.insert("identifier", |_token, _context| Ok(10));
        prefix.insert("number", |token, _context| {
            Ok(token.value.parse::<usize>()?)
        });

        let mut infix: HashMap<
            &str,
            fn(&usize, &Token, &mut Context<usize>) -> Result<usize, Error>,
        > = HashMap::new();
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

        let mut prefix: HashMap<&str, fn(&Token, &mut Context<usize>) -> Result<usize, Error>> =
            HashMap::new();
        prefix.insert("identifier", |_token, _context| Ok(10));
        prefix.insert("number", |token, _context| {
            Ok(token.value.parse::<usize>().unwrap())
        });

        let mut infix: HashMap<
            &str,
            fn(&usize, &Token, &mut Context<usize>) -> Result<usize, Error>,
        > = HashMap::new();
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
            .err(),
            Some(Error::InvalidParserError(
                "token snowman must have a precedence".to_string()
            ))
        );
    }

    #[test]
    fn positive_attempt() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "123", HashMap::new(), 0);

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

        let mut context = Context::new(&pp, "123", HashMap::new(), 0);

        assert_eq!(context.attempt(|ty| ty == "identifier").unwrap(), None);
    }

    #[test]
    fn attempt_allowed_after_not_allowed_type() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "123", HashMap::new(), 0);

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

        let mut context = Context::new(&pp, "   ", HashMap::new(), 0);

        assert_eq!(context.attempt(|_| true).unwrap(), None);
    }

    #[test]
    fn attempt_invalid_syntax() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "🍎 ", HashMap::new(), 0);

        assert_eq!(
            context.attempt(|_| true),
            Err(Error::SyntaxError(
                "unexpected EOF for 🍎  at 🍎 ".to_string()
            ))
        );
    }

    #[test]
    fn require_positive() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "abc", HashMap::new(), 0);

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

        let mut context = Context::new(&pp, "   ", HashMap::new(), 0);

        assert_eq!(
            context.require(|_| true),
            Err(Error::SyntaxError("unexpected end of input".to_string()))
        );
    }

    #[test]
    fn require_invalid_syntax() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "🍎 ", HashMap::new(), 0);

        assert_eq!(
            context.require(|_| true),
            Err(Error::SyntaxError(
                "unexpected EOF for 🍎  at 🍎 ".to_string()
            ))
        );
    }

    #[test]
    fn require_unexpected_token() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "☃️", HashMap::new(), 0);

        assert_eq!(
            context.require(|ty| ty == "identifier"),
            Err(Error::SyntaxError("Unexpected token error".to_string()))
        );
    }

    #[test]
    fn parse_negative_no_prefix_rules() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "+ 10", HashMap::new(), 0);
        assert_eq!(
            context.parse(None).err(),
            Some(Error::SyntaxError(
                "Found: + token, expected one of: identifier, number".to_string()
            ))
        );
    }

    #[test]
    fn parse_number() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2", HashMap::new(), 0);

        assert_eq!(context.parse(None).unwrap(), 2);
    }

    #[test]
    fn parse_number_should_error() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2.7", HashMap::new(), 0);

        assert_eq!(
            context.parse(None).err(),
            Some(SyntaxError("Invalid integer".to_string()))
        );
    }

    #[test]
    fn parse_addition() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2 + 3", HashMap::new(), 0);

        assert_eq!(context.parse(None).unwrap(), 5);
    }

    #[test]
    fn parse_snowmaning() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2 ☃ 3", HashMap::new(), 0);

        assert_eq!(context.parse(None).unwrap(), 6);
    }

    #[test]
    fn parse_check_precedence() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "1 + 2 ☃ 3", HashMap::new(), 0);

        assert_eq!(context.parse(None).unwrap(), 7);
    }

    #[test]
    fn parse_check_reverse_precedence() {
        let pp = build_parser();

        let mut context = Context::new(&pp, "2 ☃ 3 + 4", HashMap::new(), 0);

        assert_eq!(context.parse(None).unwrap(), 10);
    }
}
