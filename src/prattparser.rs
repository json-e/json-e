use crate::errors::Error;
use crate::tokenizer::Token;
use crate::tokenizer::Tokenizer;
use std::collections::HashMap;

pub struct PrattParser<'a> {
    tokenizer: Tokenizer<'a>,
    precedence_map: HashMap<&'a str, usize>,
    prefix_rules: HashMap<&'a str, fn(&Token, &Context) -> usize>,
    infix_rules: HashMap<&'a str, fn(&Token, &Context) -> usize>,
}

impl<'a> PrattParser<'a> {
    pub fn new(
        ignore: &str,
        patterns: HashMap<&str, &str>,
        token_types: Vec<&'a str>,
        precedence: Vec<Vec<&'a str>>,
        prefix_rules: HashMap<&'a str, fn(&Token, &Context) -> usize>,
        infix_rules: HashMap<&'a str, fn(&Token, &Context) -> usize>,
    ) -> PrattParser<'a> {
        let tokenizer = Tokenizer::new(ignore, patterns, token_types);
        let mut precedence_map: HashMap<&'a str, usize> = HashMap::new();

        for (i, row) in precedence.iter().enumerate() {
            for kind in row.iter() {
                precedence_map.insert(kind, i + 1);
            }
        }

        for kind in infix_rules.keys() {
            if !precedence_map.contains_key(kind) {
                // TODO: return a Result
                panic!("token must have a precedence");
            }
        }

        PrattParser {
            tokenizer,
            precedence_map,
            prefix_rules,
            infix_rules,
        }
    }
}

pub struct Context<'a, 'v> {
    parser: &'a PrattParser<'a>,
    source: &'v str,
    context: HashMap<&'a str, &'a str>,
    next: Result<Option<Token<'a, 'v>>, Error>,
}

impl<'a, 'v> Context<'a, 'v> {
    pub fn new(
        parser: &'a PrattParser,
        source: &'v str,
        context: HashMap<&'a str, &'a str>,
        offset: usize,
    ) -> Context<'a, 'v> {
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
            Ok(ref t) => match t {
                Some(token) => {
                    if !is_type_allowed(token.token_type) {
                        return Ok(None);
                    }
                    let new_token = (*token).clone();
                    self.next = self.parser.tokenizer.next(self.source, token.end);
                    return Ok(Some(new_token));
                }
                None => return Ok(None),
            },
            // if a tokenizer error occurrs, all calls to attempt() after that will return the
            // error, so we must copy it.
            Err(ref err) => return Err((*err).clone()),
        }
    }
}

mod tests {
    use crate::prattparser::{Context, PrattParser};
    use crate::tokenizer::Token;
    use std::collections::HashMap;

    #[test]
    fn positive_constructor() {
        let mut patterns = HashMap::new();
        patterns.insert("number", "[0-9]+");
        patterns.insert("identifier", "[a-z]+");
        patterns.insert("snowman", "☃");

        let mut prefix: HashMap<&str, fn(&Token, &Context) -> usize> = HashMap::new();
        prefix.insert("snowman", |token, context| 10);

        let mut infix: HashMap<&str, fn(&Token, &Context) -> usize> = HashMap::new();
        infix.insert("snowman", |token, context| 10);
        infix.insert("+", |token, context| 10);

        let pp = PrattParser::new(
            "[ ]+",
            patterns,
            vec!["number", "identifier", "+", "snowman"],
            vec![vec!["snowman"], vec!["+"]],
            prefix,
            infix,
        );
    }
}
